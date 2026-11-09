// Main-agent harness correction: initial loads must settle; a fresh explicit play after stop may start.
// Focused single-flight regressions for the PCM restoration decode.
// Uses fake audio only. Baseline audio-pcm-native.js is expected to FAIL the overlap assertions;
// audio-pcm-singleflight.js is expected to PASS them.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function harness(){
  const s={clock:0,now:0,decodeCalls:0,sources:[],deferred:[],timers:[],contexts:[],hold:false,nextMiB:8};
  s.fireTimeouts=()=>{for(const t of s.timers){if(!t.cleared){t.cleared=true;t.fn();}}};
  s.buffer=mib=>{const length=mib*1024*1024/8;return {length,numberOfChannels:2,duration:length/48000};};
  const node=()=>({gain:{value:1},pan:{value:0},connect(t){this.target=t;},disconnect(){this.disconnected=true;}});
  class AudioContext{
    constructor(){this.state='running';s.contexts.push(this);}
    get currentTime(){return s.clock;}
    createGain(){return node();}createStereoPanner(){return node();}
    createBufferSource(){const n={...node(),playbackRate:{value:1},start(...a){this.started=a;},stop(){this.stopped=true;}};s.sources.push(n);return n;}
    decodeAudioData(){s.decodeCalls++;if(s.hold)return new Promise((res,rej)=>s.deferred.push({res,rej}));return Promise.resolve(s.buffer(s.nextMiB));}
  }
  AudioContext.prototype.createMediaElementSource=()=>{throw Error('no media in PCM mode');};
  const forbidden=()=>{throw Error('PCM mode must not use HTMLAudio/Blob');};
  const ctx=vm.createContext({AudioContext,Audio:forbidden,Blob:forbidden,URL:{createObjectURL:forbidden},Uint8Array,canvas:{width:1280,height:720},
    Date:{now:()=>s.now},
    setTimeout(fn,ms){const t={fn,ms};s.timers.push(t);return t;},clearTimeout(t){if(t)t.cleared=true;},
    document:{hidden:false,hasFocus:()=>true,addEventListener(){}},window:{addEventListener(){}},console:{warn(){}}});
  vm.runInContext(fs.readFileSync(process.env.AUDIO_JS||path.join(__dirname,'../audio.js'),'utf8'),ctx);
  const natives={};vm.runInContext('installAudioNatives',ctx)(natives,true,false,true);
  const api=n=>natives['Java_syx_browser_BrowserAudio_'+n];
  return {s,api,load:(name,mib=8)=>{s.nextMiB=mib;return api('load')(null,name,new Uint8Array([1]),2);}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const watchdog=setTimeout(()=>{console.error("PCM single-flight test timed out");process.exitCode=1;},2500);

async function evicted(h){
  const id=await h.load('track',8);
  h.s.hold=false;await h.api('playStream')(null,id,true);await h.api('stopStream')(null,id);
  h.s.nextMiB=128;await h.load('fill-1',128);await h.load('fill-2',128); // evict the 8 MiB buffer
  h.s.hold=true;
  return id;
}
async function timeOutRestore(h,id,restart=true){
  assert.equal(await h.api('playStream')(null,id,restart),true,'restore accepted');
  assert.equal(await h.api('isPlaying')(null,id),true,'busy while decoding');
  h.s.fireTimeouts();await tick();await tick();
  assert.equal(await h.api('isPlaying')(null,id),false,'timeout releases busy');
  h.s.now+=1000; // leave the 1 s cooldown
}

(async()=>{
  const failures=[];
  const check=async(name,fn)=>{try{await fn();}catch(e){failures.push(name+': '+e.message);}};

  // 1. Timeout -> repeated retries while the native decode is still pending: no second decode,
  // no busy report, no source; after it settles a retry decodes and starts once.
  await check('timeout: retries refused while underlying decode pending',async()=>{
    const h=harness(),id=await evicted(h);
    await timeOutRestore(h,id,true);
    const calls=h.s.decodeCalls, sources=h.s.sources.length;
    for(let i=0;i<3;i++){
      assert.equal(await h.api('playStream')(null,id,true),false,'retry must be refused while pcmDecoding is pending');
      assert.equal(await h.api('isPlaying')(null,id),false,'a refused retry is not busy');
    }
    assert.equal(h.s.decodeCalls,calls,'no overlapping decode while the timed-out one is pending');
    assert.equal(h.s.sources.length,sources,'no source starts');
    h.s.deferred.shift().res(h.s.buffer(8)); // late success of the abandoned decode
    await tick();await tick();
    assert.equal(await h.api('playStream')(null,id,true),true,'after settlement the retry is accepted');
    assert.equal(h.s.decodeCalls,calls+1,'the retry starts exactly one new decode');
    assert.equal(await h.api('isPlaying')(null,id),true,'the retry is busy');
    h.s.deferred.shift().res(h.s.buffer(8));await tick();
    assert.equal(h.s.sources.length,sources+1,'exactly one source starts');
  });

  // 2. Late rejection of the abandoned decode also lifts the refusal; retry works after cooldown.
  await check('timeout: late reject then retry',async()=>{
    const h=harness(),id=await evicted(h);
    await timeOutRestore(h,id,false);
    const calls=h.s.decodeCalls;
    assert.equal(await h.api('playStream')(null,id,false),false,'refused while pending');
    h.s.deferred.shift().rej(Error('late codec failure'));await tick();await tick();
    assert.equal(await h.api('playStream')(null,id,false),true,'accepted after late rejection settles');
    assert.equal(h.s.decodeCalls,calls+1,'retry decodes once');
    h.s.deferred.shift().res(h.s.buffer(8));await tick();
    assert.equal(await h.api('isPlaying')(null,id),true);
  });

  // 3. stopAll clears busy while the decode is still pending; retries stay refused until it settles.
  await check('stopAll: busy cleared, no overlap, retry after settle',async()=>{
    const h=harness(),id=await evicted(h);
    await h.api('playStream')(null,id,true);
    assert.equal(await h.api('isPlaying')(null,id),true);
    await h.api('stopAll')();
    assert.equal(await h.api('isPlaying')(null,id),false,'stop clears busy');
    h.s.fireTimeouts();await tick();await tick();
    h.s.now+=1000;
    const calls=h.s.decodeCalls, sources=h.s.sources.length;
    assert.equal(await h.api('playStream')(null,id,true),false,'retry refused while abandoned decode pending');
    assert.equal(h.s.decodeCalls,calls);
    h.s.deferred.shift().res(h.s.buffer(8));await tick();await tick();
    assert.equal(h.s.sources.length,sources,'a stopped track does not autostart on the abandoned decode');
    assert.equal(await h.api('playStream')(null,id,true),true);
    assert.equal(h.s.decodeCalls,calls+1);
    h.s.deferred.shift().res(h.s.buffer(8));await tick();
    assert.equal(h.s.sources.length,sources+1,'the live retry starts exactly one source');
  });

  // 4. dispose releases the record; late settlement cannot resurrect it or leave busy state.
  await check('dispose: late settle is inert, no busy leak',async()=>{
    const h=harness(),id=await evicted(h);
    await h.api('playStream')(null,id,true);
    assert.equal(await h.api('isPlaying')(null,id),true);
    await h.api('dispose')();
    assert.equal(await h.api('isPlaying')(null,id),false);
    assert.equal(await h.api('playStream')(null,id,true),false,'disposed id stays invalid');
    h.s.deferred.shift().res(h.s.buffer(8));await tick();await tick();
    assert.equal(await h.api('isPlaying')(null,id),false);
    assert.equal(h.s.sources.length,1,'only the historical source exists');
    h.s.hold=false;
    assert.ok(await h.load('fresh')>0,'new loads still work after dispose');
  });

  if(failures.length){
    for(const failure of failures)console.error('REPRO: '+failure);
    throw new Error(failures.length+' single-flight finding(s) reproduced');
  }
  console.log('PCM single-flight (timeout retries, late settlement, stopAll, dispose): PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
