const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const audios=[],sources=[],inputs=[],gains=[],events={},deferred=[];
let clock=0,duration=2,decodeCalls=0,delayDecode=false,rejectDecode=false,revoked=0,focused=true;
const node=()=>({gain:{value:1},pan:{value:0},connect(target){this.target=target;},disconnect(){this.disconnected=true;}});
class Audio {
  constructor(){this.paused=true;this.ended=false;this.currentTime=0;this.duration=duration;this.handlers={};audios.push(this);}
  addEventListener(name,fn){this.handlers[name]=fn;}
  load(){if(this.src)this.handlers.loadedmetadata();}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
  removeAttribute(){this.src='';}
}
class AudioContext {
  constructor(){this.state='running';}
  get currentTime(){return clock;}
  createGain(){const n=node();gains.push(n);return n;}
  createMediaElementSource(){const n=node();inputs.push(n);return n;}
  createStereoPanner(){return node();}
  createBufferSource(){const n={...node(),playbackRate:{value:1},start(...args){this.started=args;},stop(){this.stopped=true;}};sources.push(n);return n;}
  decodeAudioData(){decodeCalls++;if(delayDecode)return new Promise((resolve,reject)=>deferred.push({resolve,reject}));if(rejectDecode){rejectDecode=false;return Promise.reject(Error('decode failure'));}return Promise.resolve({duration:2});}
}
const ctx=vm.createContext({Audio,AudioContext,Blob,Uint8Array,canvas:{width:1280,height:720},
  URL:{createObjectURL:()=> 'blob:short',revokeObjectURL(){revoked++;}},
  document:{hidden:false,hasFocus:()=>focused,addEventListener(name,fn){events[name]=fn;}},
  window:{addEventListener(name,fn){events[name]=fn;}},console:{warn(){}}});
vm.runInContext(fs.readFileSync(process.env.AUDIO_JS||path.join(__dirname,'../audio.js'),'utf8'),ctx);
const natives={};vm.runInContext('installAudioNatives',ctx)(natives,true);
const api=name=>natives['Java_syx_browser_BrowserAudio_'+name],load=(name,category=2)=>api('load')(null,name,new Uint8Array([1]),category);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const watchdog=setTimeout(()=>{console.error('Short-loop native or cancelled decode did not return');process.exitCode=1;},2000);
(async()=>{
  const ambient=await load('short.wav');
  await api('setStreamGain')(null,ambient,.4);await api('setStreamPosition')(null,ambient,640,360);
  await api('setStreamLoop')(null,ambient,true);
  await tick();                    // promotion is intentionally nonblocking
  assert.equal(decodeCalls,1);assert.equal(audios[0].src,'');assert.equal(inputs[0].disconnected,true);assert.equal(revoked,1);
  assert.equal(await api('playStream')(null,ambient,true),true);
  assert.equal(sources[0].loop,true);assert.equal(sources[0].target.gain.value,.4);
  clock=.75;assert.equal(await api('progress')(null,ambient),.375);
  await api('stopStream')(null,ambient);clock=10;assert.equal(await api('progress')(null,ambient),.375);
  assert.equal(await api('isPlaying')(null,ambient),false);assert.equal(sources[0].stopped,true);
  await api('playStream')(null,ambient,false);assert.deepEqual(sources[1].started,[0,.75]);
  clock=10.5;assert.equal(await api('progress')(null,ambient),.625);
  const lateEnded=sources[1].onended;
  await api('stopStream')(null,ambient);await api('playStream')(null,ambient,true);lateEnded();
  assert.equal(await api('isPlaying')(null,ambient),true,'old source completion must not stop a replacement');
  clock=19.5;assert.equal(await api('progress')(null,ambient),.5,'progress must wrap after multiple buffer loops');
  await api('setStreamLoop')(null,ambient,false);assert.equal(sources[2].loop,false);
  assert.equal(await api('isPlaying')(null,ambient),true,'disabling loop must finish the current cycle, not end immediately');
  assert.equal(await api('progress')(null,ambient),.5);clock=20.6;
  assert.equal(await api('isPlaying')(null,ambient),false,'the remaining half-cycle must then finish');
  sources[2].onended();
  const music=await load('short-music.wav',1);
  await api('setGain')(null,0,.8);await api('setGain')(null,1,.5);await api('setStreamGain')(null,music,.4);
  await api('setStreamLoop')(null,music,true);await tick();await api('playStream')(null,music,true);
  assert.equal(sources[3].target.gain.value,.4,'direct music conversion must preserve per-stream gain');
  assert.equal(sources[3].target.target.target.gain.value,.5,'converted music must use its category bus');
  assert.equal(gains[0].gain.value,.8);
  await api('setMuteOnFocus')(null,true);focused=false;events.blur();assert.equal(gains[0].gain.value,0);
  focused=true;events.focus();assert.equal(gains[0].gain.value,.8);
  await api('setStreamPosition')(null,music,1280,0);await api('setListener')(null,0,0);
  assert.equal(sources[3].target.target.target.pan.value,1,'buffered streams must retain spatial support');
  duration=20;const long=await load('long.wav');const before=decodeCalls;
  await api('setStreamLoop')(null,long,true);assert.equal(decodeCalls,before,'long audio must remain streamed');
  assert.ok(audios.at(-1).src);assert.equal(audios.at(-1).loop,true);
  duration=2;const retry=await load('retry.wav');rejectDecode=true;
  await api('setStreamLoop')(null,retry,true);await tick();assert.ok(audios.at(-1).src,'decode failure must retain native playback');
  await api('setStreamLoop')(null,retry,true);await tick();assert.equal(audios.at(-1).src,'','conversion must be retryable');
  const pending=await load('dispose.wav');delayDecode=true;
  const first=api('setStreamLoop')(null,pending,true),second=api('setStreamLoop')(null,pending,true);
  await tick();assert.equal(deferred.length,1,'concurrent loop setters share the decode');
  const beforeSources=sources.length;await api('dispose')();await Promise.all([first,second]);
  deferred.shift().resolve({duration:2});await tick();assert.equal(sources.length,beforeSources);
  assert.equal(await api('playStream')(null,pending,true),false,'late decode must not resurrect disposed records');
  assert.ok(sources.every(s=>s.stopped||!s.onended),'disposal must retire all buffer sources');
  console.log('Short stream buffers: looping, pause/resume, gain/spatial routing and decode cancellation: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
