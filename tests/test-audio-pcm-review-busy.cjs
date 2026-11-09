// Independent races for the PCM "busy acceptance" contract: an accepted asynchronous restore must
// report busy (isPlaying true) until it starts or fails, stop must clear that busy state, the 15 s
// timeout must release it, and late decoder successes must never start audio.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function harness(){
  const s={clock:0,now:0,decodeCalls:0,sources:[],deferred:[],timers:[],hold:false,rejectNext:false,nextMiB:8};
  s.fireTimeouts=()=>{for(const timer of s.timers){if(!timer.cleared){timer.cleared=true;timer.fn();}}};
  s.buffer=mib=>{const length=mib*1024*1024/8;return {length,numberOfChannels:2,duration:length/48000};};
  const node=()=>({gain:{value:1},pan:{value:0},connect(t){this.target=t;},disconnect(){this.disconnected=true;}});
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
const watchdog=setTimeout(()=>{console.error('PCM busy test timed out');process.exitCode=1;},2500);

async function evictedTrack(h){
  const id=await h.load('track',8);
  await h.api('playStream')(null,id,true);await h.api('stopStream')(null,id);
  h.s.nextMiB=128;await h.load('fill-1',128);await h.load('fill-2',128); // evicts the 8 MiB buffer
  return id;
}

(async()=>{
  // 1. Busy acceptance is not audible playback: isPlaying true, progress 0, no source yet.
  {
    const h=harness(),id=await evictedTrack(h),before=h.s.sources.length;
    h.s.hold=true;
    assert.equal(await h.api('playStream')(null,id,false),true);
    assert.equal(await h.api('isPlaying')(null,id),true,'accepted restore reports busy');
    assert.equal(await h.api('progress')(null,id),0,'busy is not progress');
    assert.equal(h.s.sources.length,before,'busy does not create a source');
    h.s.deferred.shift().res(h.s.buffer(8));await tick();
    assert.equal(h.s.sources.length,before+1,'completion starts exactly one source');
    h.s.clock=3;
    assert.equal(await h.api('isPlaying')(null,id),true);
    assert.ok(await h.api('progress')(null,id)>0,'started playback reports real progress');
  }

  // 2. stop clears busy immediately; the still-pending decode must not start after stop.
  {
    const h=harness(),id=await evictedTrack(h),before=h.s.sources.length;
    h.s.hold=true;await h.api('playStream')(null,id,false);
    assert.equal(await h.api('isPlaying')(null,id),true);
    await h.api('stopStream')(null,id);
    assert.equal(await h.api('isPlaying')(null,id),false,'stop clears the busy state');
    h.s.deferred.shift().res(h.s.buffer(8));await tick();
    assert.equal(h.s.sources.length,before,'a stop-cancelled restore never starts');
    assert.equal(await h.api('playStream')(null,id,false),true,'the buffered track is immediately playable');
    assert.equal(h.s.sources.length,before+1);
  }

  // 3. Timeout releases busy; a late success must not start; a retry decodes again.
  {
    const h=harness(),id=await evictedTrack(h),before=h.s.sources.length;
    h.s.hold=true;await h.api('playStream')(null,id,true);
    assert.equal(await h.api('isPlaying')(null,id),true,'busy while decoding');
    h.s.fireTimeouts();await tick();await tick();
    assert.equal(await h.api('isPlaying')(null,id),false,'a decode timeout releases busy');
    assert.equal(h.s.sources.length,before,'timeout never starts audio');
    const abandoned=h.s.deferred.shift();
    abandoned.res(h.s.buffer(8));await tick();
    assert.equal(h.s.sources.length,before,'late decoder success after timeout must not start');
    const calls=h.s.decodeCalls;
    assert.equal(await h.api('playStream')(null,id,true),false,'retry inside the 1 s cooldown is refused');
    assert.equal(await h.api('isPlaying')(null,id),false,'a refused retry is not busy');
    assert.equal(h.s.decodeCalls,calls,'cooldown does not start another decode');
    h.s.now+=1000;
    assert.equal(await h.api('playStream')(null,id,true),true);
    assert.equal(h.s.decodeCalls,calls+1,'retry after cooldown and decoder settlement starts a fresh decode');
    assert.equal(await h.api('isPlaying')(null,id),true,'retry is busy again');
    h.s.deferred.forEach(d=>d.res(h.s.buffer(8)));await tick();
    assert.equal(h.s.sources.length,before+1,'only the live request starts, exactly once');
  }

  // 4. An old timeout must not clear a newer request's busy state.
  {
    const h=harness(),id=await evictedTrack(h);
    h.s.hold=true;await h.api('playStream')(null,id,false);
    const firstTimer=h.s.timers.find(t=>!t.cleared);
    h.s.fireTimeouts();await tick();
    assert.equal(await h.api('isPlaying')(null,id),false);
    const calls=h.s.decodeCalls;
    h.s.now+=1000;
    assert.equal(await h.api('playStream')(null,id,false),false,'a timed-out decoder still in flight must not be duplicated');
    assert.equal(h.s.decodeCalls,calls);
    h.s.deferred.shift().res(h.s.buffer(8));await tick();
    assert.equal(await h.api('playStream')(null,id,false),true);
    assert.equal(await h.api('isPlaying')(null,id),true);
    firstTimer.fn();await tick();                         // stale timeout fires again
    assert.equal(await h.api('isPlaying')(null,id),true,'an old timer cannot clear the new request');
    h.s.deferred.at(-1).res(h.s.buffer(8));await tick();
    assert.equal(await h.api('isPlaying')(null,id),true);
  }

  console.log('PCM busy acceptance (busy vs audible, stop/timeout release, late success, stale timer): PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
