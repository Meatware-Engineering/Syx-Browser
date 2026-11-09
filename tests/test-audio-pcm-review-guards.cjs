// Independent guards for the PCM stream path (audio-pcm-native.js). These pin behaviours that
// must survive future edits: a disposed restoration callback cannot start audio, and a new
// play request during a pending restoration owns the single start.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function harness(){
  const s={clock:0,decodeCalls:0,sources:[],deferred:[],timers:[],hold:false,rejectNext:false,nextMiB:8};
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
    setTimeout(fn,ms){const timer={fn,ms};s.timers.push(timer);return timer;},clearTimeout(timer){if(timer)timer.cleared=true;},
    document:{hidden:false,hasFocus:()=>true,addEventListener(){}},window:{addEventListener(){}},console:{warn(){}}});
  vm.runInContext(fs.readFileSync(process.env.AUDIO_JS||path.join(__dirname,'../audio.js'),'utf8'),ctx);
  const natives={};vm.runInContext('installAudioNatives',ctx)(natives,true,false,true);
  const api=n=>natives['Java_syx_browser_BrowserAudio_'+n];
  return {s,api,load:(name,mib=8)=>{s.nextMiB=mib;const id=api('load')(null,name,new Uint8Array([1]),2);return id;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const watchdog=setTimeout(()=>{console.error('PCM guard test timed out');process.exitCode=1;},2500);

(async()=>{
  // 1. A decode that completes after dispose must never start a source, even though its promise
  //    was attached before the reset; and the disposed id must be rejected.
  {
    const h=harness(),id=await h.load('stale',8);
    await h.api('playStream')(null,id,true);                     // buffer + source
    await h.api('stopStream')(null,id);                          // pause at 0, buffer retained
    h.s.nextMiB=8; await h.load('filler-1',128);await h.load('filler-2',128); // evicts the 8 MiB buffer
    h.s.hold=true;
    assert.equal(await h.api('playStream')(null,id,false),true,'evicted stream accepts a restore request');
    await tick();
    assert.equal(h.s.deferred.length,1);
    const before=h.s.sources.length;
    await h.api('dispose')();                                     // rejects the pending decode
    h.s.deferred.shift().res(h.s.buffer(8));                      // resolve anyway: stale success
    await tick();await tick();
    assert.equal(h.s.sources.length,before,'a stale restoration must not create a source');
    assert.equal(await h.api('isPlaying')(null,id),false);
    assert.equal(await h.api('playStream')(null,id,true),false,'disposed id stays invalid');
  }

  // 2. stopAll during restoration cancels request 1; a request issued afterwards must own the
  //    one start (no duplicate source, no stale restart flag).
  {
    const h=harness(),id=await h.load('reassign',8);
    await h.api('playStream')(null,id,true);
    h.s.clock=1.5;await h.api('stopStream')(null,id);
    h.s.nextMiB=8;await h.load('filler-1',128);await h.load('filler-2',128);
    h.s.hold=true;
    await h.api('playStream')(null,id,false);await tick();
    const before=h.s.sources.length;
    await h.api('stopAll')();
    assert.equal(await h.api('playStream')(null,id,false),true,'new restore request is accepted');
    assert.equal(h.s.deferred.length,1,'requests share the pending decode');
    h.s.deferred.shift().res(h.s.buffer(8));
    await tick();await tick();
    assert.equal(h.s.sources.length,before+1,'exactly one source starts');
    assert.deepEqual(h.s.sources.at(-1).started,[0,1.5],'it keeps the paused position');
  }
  console.log('PCM guards (stale restoration after dispose, stopAll reassignment): PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
