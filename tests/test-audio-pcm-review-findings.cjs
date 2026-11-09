// Fixed-defect regressions for audio-pcm-native.js. Each assertion describes desired behaviour.
// This file now PASSES on the current candidate (previously exit 1):
// - failed restores honour a 1 s retry cooldown instead of decoding on every play attempt;
// - room eviction commits only after a successful decode, so a failed restore no longer drops
//   unrelated paused PCM buffers.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function harness(){
  const s={clock:0,now:0,decodeCalls:0,sources:[],deferred:[],timers:[],hold:false,rejectNext:false,nextMiB:8};
  s.fireTimeouts=()=>{for(const timer of s.timers){if(!timer.cleared){timer.cleared=true;timer.fn();}}};
  s.buffer=mib=>{const length=mib*1024*1024/8;return {length,numberOfChannels:2,duration:length/48000};};
  const node=()=>{const n={gain:{value:1},pan:{value:0},connect(t){this.target=t;},disconnect(){this.disconnected=true;}};return n;};
  class AudioContext{
    constructor(){this.state='running';}
    get currentTime(){return s.clock;}
    createGain(){return node();}createStereoPanner(){return node();}
    createBufferSource(){const n={...node(),playbackRate:{value:1},start(...a){this.started=a;},stop(){this.stopped=true;}};s.sources.push(n);return n;}
    decodeAudioData(){s.decodeCalls++;if(s.hold)return new Promise((res,rej)=>s.deferred.push({res,rej}));if(s.rejectNext){s.rejectNext=false;return Promise.reject(Error('codec'));}return Promise.resolve(s.buffer(s.nextMiB));}
  }
  AudioContext.prototype.createMediaElementSource=()=>{throw Error('no media in PCM mode');};
  const forbidden=()=>{throw Error('PCM mode must not use HTMLAudio/Blob');};
  const ctx=vm.createContext({AudioContext,Audio:forbidden,Blob:forbidden,URL:{createObjectURL:forbidden},Uint8Array,canvas:{width:1280,height:720},
    Date:{now:()=>s.now},
    setTimeout(fn,ms){const timer={fn,ms};s.timers.push(timer);return timer;},clearTimeout(timer){if(timer)timer.cleared=true;},
    document:{hidden:false,hasFocus:()=>true,addEventListener(){}},window:{addEventListener(){}},console:{warn(){}}});
  vm.runInContext(fs.readFileSync(process.env.AUDIO_JS||path.join(__dirname,'../audio.js'),'utf8'),ctx);
  const natives={};vm.runInContext('installAudioNatives',ctx)(natives,true,false,true);
  const api=n=>natives['Java_syx_browser_BrowserAudio_'+n];
  return {s,api,load:(name,mib=8)=>{s.nextMiB=mib;return api('load')(null,name,new Uint8Array([1]),2);}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const watchdog=setTimeout(()=>{console.error('PCM finding repro timed out');process.exitCode=1;},2500);

(async()=>{
  const failures=[];
  const check=async(name,fn)=>{try{await fn();}catch(error){failures.push(name+': '+error.message);}};
  // Finding 1: failed restore -> repeated full decodes on every retry.
  await check('finding 1 (retry decode storm)',async()=>{
    const h=harness(),id=await h.load('corrupt-after-evict',8);
    await h.api('playStream')(null,id,true);
    await h.api('stopStream')(null,id);
    h.s.nextMiB=128;await h.load('fill-1',128);await h.load('fill-2',128); // evicts the 8 MiB track
    h.s.hold=true;await h.api('playStream')(null,id,false);await tick();
    h.s.deferred.shift().rej(Error('codec failure'));await tick();
    const afterFailure=h.s.decodeCalls;
    h.s.hold=false;h.s.rejectNext=true;
    for(let i=0;i<3;i++){await h.api('playStream')(null,id,false);await tick();}
    assert.equal(h.s.decodeCalls,afterFailure,
      'a rejected restoration must not decode again on every play attempt');
  });
  // Finding 2: failed restore unnecessarily evicts an unrelated paused buffer.
  await check('finding 2 (failed decode evicts unrelated buffer)',async()=>{
    const h=harness();
    const b=await h.load('paused',100);
    await h.load('active',100);
    const a=await h.load('active',100); // distinct id for the second 100 MiB asset
    await h.api('playStream')(null,b,true);await h.api('stopStream')(null,b); // paused, buffered
    await h.api('playStream')(null,a,true);                                  // active, cannot be evicted
    const d=await h.load('evicted',100);
    // 300 MiB retained pressure: loading d evicted b; d is now the only inactive buffer.
    h.s.hold=true;
    assert.equal(await h.api('playStream')(null,b,false),true,'restore request accepted');
    await tick();
    h.s.deferred.shift().rej(Error('codec failure'));await tick();   // restore fails
    h.s.hold=false;h.s.nextMiB=100;
    const decodes=h.s.decodeCalls;
    await h.api('playStream')(null,d,false);await tick();
    assert.equal(h.s.decodeCalls,decodes,
      'a buffer dropped only to make room for a failed decode must remain available');
  });
  if(failures.length){
    for(const failure of failures)console.error('REGRESSION: '+failure);
    throw new Error(failures.length+' fixed PCM finding(s) regressed');
  }
  console.log('PCM findings 1-2 remain fixed (cooldown, eviction after success): PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
