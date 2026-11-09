// Independent checks for the two newest PCM behaviours:
//  - a failed restore is refused for ~1 s (cooldown) instead of decoding again on every play;
//  - a buffered source stays logically playing while the AudioContext is suspended/interrupted,
//    because the source (not the context clock) is what will resume; only closed/stopped/ended is
//    not playing. This is the parity that keeps the caller from queueing more tracks.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function harness(){
  const s={clock:0,now:0,decodeCalls:0,sources:[],deferred:[],timers:[],contexts:[],hold:false,rejectNext:false,nextMiB:8};
  s.fireTimeouts=()=>{for(const timer of s.timers){if(!timer.cleared){timer.cleared=true;timer.fn();}}};
  s.buffer=mib=>{const length=mib*1024*1024/8;return {length,numberOfChannels:2,duration:length/48000};};
  const node=()=>({gain:{value:1},pan:{value:0},connect(t){this.target=t;},disconnect(){this.disconnected=true;}});
  class AudioContext{
    constructor(){this.state='running';s.contexts.push(this);}
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
const watchdog=setTimeout(()=>{console.error('PCM cooldown/suspended test timed out');process.exitCode=1;},2500);

async function evictedTrack(h){
  const id=await h.load('track',8);
  await h.api('playStream')(null,id,true);await h.api('stopStream')(null,id);
  h.s.nextMiB=128;await h.load('fill-1',128);await h.load('fill-2',128);
  return id;
}

(async()=>{
  // 1. A decoder timeout sets the cooldown; retries inside it are refused without decoding.
  {
    const h=harness(),id=await evictedTrack(h);
    h.s.hold=true;await h.api('playStream')(null,id,true);
    h.s.fireTimeouts();await tick();await tick();
    h.s.deferred.shift().res(h.s.buffer(8));await tick(); // native decoder settled; retry cooldown still applies
    const calls=h.s.decodeCalls;
    assert.equal(await h.api('playStream')(null,id,true),false,'retry inside cooldown is refused');
    assert.equal(h.s.decodeCalls,calls,'cooldown must not decode');
    h.s.now+=999;
    assert.equal(await h.api('playStream')(null,id,true),false,'999 ms is still inside the cooldown');
    h.s.now+=1;
    const before=h.s.sources.length;
    assert.equal(await h.api('playStream')(null,id,true),true,'cooldown expiry accepts a retry');
    assert.equal(await h.api('isPlaying')(null,id),true,'the accepted retry is busy');
    h.s.deferred.forEach(d=>d.res(h.s.buffer(8)));await tick();
    assert.equal(h.s.sources.length,before+1,'one source starts from the live retry');
  }

  // 2. A codec rejection also cooldowns, and the retry after expiry can succeed normally.
  {
    const h=harness(),id=await evictedTrack(h);
    h.s.rejectNext=true;
    assert.equal(await h.api('playStream')(null,id,true),true,'the failed attempt was accepted');
    await tick();await tick();
    assert.equal(await h.api('isPlaying')(null,id),false,'failure releases busy');
    const calls=h.s.decodeCalls;
    assert.equal(await h.api('playStream')(null,id,true),false,'immediate retry is inside the cooldown');
    assert.equal(h.s.decodeCalls,calls);
    h.s.now+=1000;
    const before=h.s.sources.length;
    assert.equal(await h.api('playStream')(null,id,true),true);
    await tick();
    assert.equal(h.s.sources.length,before+1,'successful retry starts playback');
    assert.equal(await h.api('isPlaying')(null,id),true);
  }

  // 3. Suspended/interrupted context keeps a buffered source logically playing; closed does not.
  {
    const h=harness(),id=await h.load('playing',8);
    await h.api('playStream')(null,id,false);
    h.s.clock=2;
    assert.equal(await h.api('isPlaying')(null,id),true);
    const progress=await h.api('progress')(null,id);
    h.s.contexts[0].state='suspended';
    assert.equal(await h.api('isPlaying')(null,id),true,'suspension is not a stop');
    assert.equal(await h.api('progress')(null,id),progress,'the context clock is frozen while suspended');
    h.s.contexts[0].state='interrupted';
    assert.equal(await h.api('isPlaying')(null,id),true,'interruption is not a stop');
    h.s.contexts[0].state='running';
    assert.equal(await h.api('isPlaying')(null,id),true);
    h.s.contexts[0].state='closed';
    assert.equal(await h.api('isPlaying')(null,id),false,'closed context is not playing');
    h.s.contexts[0].state='running';
    await h.api('stopStream')(null,id);
    assert.equal(await h.api('isPlaying')(null,id),false,'stop still wins over the parity rule');
  }

  // 4. Busy restoration is unaffected by suspension (no context clock needed to report busy).
  {
    const h=harness(),id=await evictedTrack(h);
    h.s.hold=true;h.s.contexts[0].state='suspended';
    await h.api('playStream')(null,id,false);
    assert.equal(await h.api('isPlaying')(null,id),true,'busy survives suspension');
    await h.api('stopStream')(null,id);
    assert.equal(await h.api('isPlaying')(null,id),false);
  }

  console.log('PCM cooldown and suspended-context parity: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
