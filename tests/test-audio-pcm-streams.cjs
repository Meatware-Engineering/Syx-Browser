const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function harness(mebibytes=8) {
  const state={now:0,clock:0,decodeCalls:0,sources:[],nodes:[],events:{},deferred:[],delay:false,reject:false,contexts:0};
  state.buffer=()=>{const length=mebibytes*1024*1024/8;return {length,numberOfChannels:2,duration:length/48000};};
  const node=()=>{const n={gain:{value:1},pan:{value:0},connect(target){this.target=target;},disconnect(){this.disconnected=true;}};state.nodes.push(n);return n;};
  class AudioContext {
    constructor(){this.state='running';state.context=this;state.contexts++;}
    get currentTime(){return state.clock;}
    createGain(){return node();}createStereoPanner(){return node();}
    createBufferSource(){const n={...node(),playbackRate:{value:1},start(...args){this.started=args;},stop(){this.stopped=true;}};state.sources.push(n);return n;}
    decodeAudioData(){state.decodeCalls++;if(state.delay)return new Promise((resolve,reject)=>state.deferred.push({resolve,reject}));if(state.reject){state.reject=false;return Promise.reject(Error('codec failure'));}return Promise.resolve(state.buffer());}
  }
  const forbidden=()=>{throw Error('PCM mode must never use HTMLAudio, Blob URLs or media source nodes');};
  AudioContext.prototype.createMediaElementSource=forbidden;
  const ctx=vm.createContext({Date:{now:()=>state.now},setTimeout:(fn,ms)=>state.forceTimeout && ms===15000?setImmediate(fn):setTimeout(fn,ms),clearTimeout,AudioContext,Audio:forbidden,Blob:forbidden,URL:{createObjectURL:forbidden},Uint8Array,canvas:{width:1280,height:720},
    document:{hidden:false,hasFocus:()=>state.focus!==false,addEventListener(name,fn){state.events[name]=fn;}},window:{addEventListener(name,fn){state.events[name]=fn;}},console:{warn(){}}});
  vm.runInContext(fs.readFileSync(process.env.AUDIO_JS||path.join(__dirname,'../audio.js'),'utf8'),ctx);
  const natives={};vm.runInContext('installAudioNatives',ctx)(natives,true,false,true);
  const api=name=>natives['Java_syx_browser_BrowserAudio_'+name];
  return {state,api,load:(name,category=2,bytes=new Uint8Array([1]))=>api('load')(null,name,bytes,category)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const watchdog=setTimeout(()=>{console.error('PCM stream regression timed out');process.exitCode=1;},2500);
(async()=>{
  {
    const {state:s,api:a,load}=harness(48),id=await load('long-music.ogg',1);
    assert.ok(id>0);assert.ok(await a('length')(null,id)>120,'long streamed assets must be supported');
    await a('setStreamGain')(null,id,.4);await a('setGain')(null,1,.5);await a('setGain')(null,0,.8);
    await a('setStreamPosition')(null,id,640,0);await a('setStreamLoop')(null,id,true);await a('playStream')(null,id,true);
    const first=s.sources[0];assert.equal(first.loop,true);assert.equal(first.target.gain.value,.4);
    assert.equal(first.target.target.target.pan.value,1);assert.equal(first.target.target.target.target.gain.value,.5);assert.equal(s.nodes[0].gain.value,.8);
    s.context.state='suspended';assert.equal(await a('isPlaying')(null,id),true,'context suspension must not advance the music playlist');
    s.context.state='interrupted';assert.equal(await a('isPlaying')(null,id),true,'system interruption must preserve the same logical source');
    s.context.state='running';assert.equal(s.sources.length,1,'resume must not queue another track');
    s.clock=1.25;await a('stopStream')(null,id);assert.equal(first.stopped,true);assert.equal(await a('isPlaying')(null,id),false);
    await a('playStream')(null,id,false);assert.deepEqual(s.sources[1].started,[0,1.25]);
    await a('setMuteOnFocus')(null,true);s.focus=false;s.events.blur();assert.equal(s.nodes[0].gain.value,0);
    s.focus=true;s.events.focus();assert.equal(s.nodes[0].gain.value,.8);
    await a('stopAll')();assert.equal(await a('isPlaying')(null,id),false);
    await a('dispose')();assert.equal(await a('playStream')(null,id,true),false);
  }
  {
    const {state:s,api:a,load}=harness(80),ids=[];
    for(let i=0;i<3;i++){const id=await load('active-'+i);ids.push(id);await a('playStream')(null,id,true);}
    const fourth=await load('fourth');assert.ok(fourth>0,'pressure keeps a valid asset handle and duration');
    const calls=s.decodeCalls;assert.equal(await a('playStream')(null,fourth,true),false,'active buffers cannot be evicted');
    assert.equal(s.decodeCalls,calls,'pressure must not decode again every game frame');
    s.clock=1.5;await a('stopStream')(null,ids[0]);await a('playStream')(null,fourth,true);await tick();
    assert.equal(s.decodeCalls,calls+1);assert.equal(await a('isPlaying')(null,fourth),true,'an inactive buffer makes room');
    assert.equal(await a('playStream')(null,ids[0],false),false,'evicted track stays cached but cannot displace active audio');
    await a('stopStream')(null,fourth);s.delay=true;
    assert.equal(await a('playStream')(null,ids[0],false),true,'evicted track is accepted without awaiting decode');
    await tick();assert.equal(s.deferred.length,1);assert.equal(await a('isPlaying')(null,ids[0]),true,'accepted restoration must stay busy so the caller does not select another track');const count=s.sources.length;
    await a('stopAll')();s.deferred.shift().resolve(s.buffer());await tick();
    assert.equal(s.sources.length,count,'stopAll during restoration must not restart a stream');
    s.delay=false;await a('playStream')(null,ids[0],false);assert.deepEqual(s.sources.at(-1).started,[0,1.5],'eviction preserves paused position');
    await a('dispose')();const fresh=await load('after-dispose');assert.ok(fresh>0);assert.equal(await a('playStream')(null,fresh,true),true,'dispose releases budget');
  }
  {
    const {state:s,api:a,load}=harness(80),id=await load('resume-then-restart');
    await a('playStream')(null,id,true);s.clock=1.5;await a('stopStream')(null,id);
    await load('evict-1');await load('evict-2');await load('evict-3');
    s.delay=true;await a('playStream')(null,id,false);await tick();
    await a('playStream')(null,id,true);assert.equal(s.deferred.length,1,'pending requests share one decode');
    s.deferred.shift().resolve(s.buffer());await tick();assert.deepEqual(s.sources.at(-1).started,[0,0],'restart overrides an earlier pending resume');
    await a('dispose')();
  }
  {
    const {state:s,api:a,load}=harness();s.delay=true;const pending=load('cancel');await tick();
    await a('dispose')();assert.equal(await pending,0,'dispose resolves a cancelled load');
    s.deferred.shift().resolve(s.buffer());await tick();s.delay=false;s.reject=true;
    assert.equal(await load('bad-codec'),0);assert.ok(await load('retry')>0,'failure and cancellation release retained bytes');
  }
  {
    const {state:s,api:a,load}=harness(80),id=await load('timeout-restore');
    await load('room-1');await load('room-2');await load('room-3');
    s.delay=true;s.forceTimeout=true;assert.equal(await a('playStream')(null,id,true),true);
    assert.equal(await a('isPlaying')(null,id),true);await tick();await tick();
    assert.equal(await a('isPlaying')(null,id),false,'a decoder timeout must release the busy state');
    const count=s.sources.length;s.deferred.shift().resolve(s.buffer());await tick();
    assert.equal(s.sources.length,count,'late decoder success after timeout must never start a source');
    s.delay=false;s.forceTimeout=false;s.now+=1000;assert.equal(await a('playStream')(null,id,true),true);await tick();
    assert.equal(await a('isPlaying')(null,id),true,'the track remains retryable after timeout');await a('dispose')();
  }
  {
    const {state:s,api:a,load}=harness(80),old=await load('restore-failure');
    const kept1=await load('kept-1'),kept2=await load('kept-2'),kept3=await load('kept-3');
    s.delay=true;await a('playStream')(null,old,false);await tick();
    s.deferred.shift().reject(Error('decoder failed'));await tick();
    const decodes=s.decodeCalls;s.delay=false;
    for(let i=0;i<4;i++)assert.equal(await a('playStream')(null,old,false),false);
    assert.equal(s.decodeCalls,decodes,'a decoder failure must not trigger full decoding every game frame');
    await a('playStream')(null,kept1,true);await a('playStream')(null,kept2,true);await a('playStream')(null,kept3,true);
    assert.equal(s.decodeCalls,decodes,'failed restoration must not evict unrelated paused buffers');
    await a('stopAll')();s.now+=1000;assert.equal(await a('playStream')(null,old,false),true);await tick();
    assert.equal(await a('isPlaying')(null,old),true,'retry is allowed after the short failure cooldown');await a('dispose')();
  }
  {
    const {state:s,api:a,load}=harness(129),large=await load('too-large');assert.ok(large>0);
    assert.equal(await a('playStream')(null,large,true),false);assert.equal(s.decodeCalls,1,'oversized asset is not repeatedly decoded');
    assert.equal(await a('playStream')(null,large,true),false);assert.equal(s.decodeCalls,1);
    const before=s.decodeCalls;assert.equal(await load('encoded-limit',2,new Uint8Array(32*1024*1024+1)),0);assert.equal(s.decodeCalls,before,'input size is checked before decoding');
    await a('dispose')();
  }
  console.log('PCM streams: no HTMLAudio, long music/spatial/focus, bounded retention/eviction, async restoration and cancellation: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
