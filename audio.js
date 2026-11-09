// Web Audio replacement for the game's OpenAL sources.
function installAudioNatives(natives, directMusic=false, disabled=false, pcmStreams=false) {
  if(disabled) {
    // Explicit diagnostic mode: never construct audio objects or touch the wedged audio service.
    // Successful silent ids keep Java's asset cache from re-reading files on every effect request.
    let nextSilentId=1;
    const silent={load:async()=>nextSilentId++,length:async()=>0,progress:async()=>0,
      playEffect:async()=>false,playStream:async()=>false,isPlaying:async()=>false};
    for(const name of ['stopStream','setStreamGain','setStreamLoop','setStreamPosition','setListener','setGain','setMuteOnFocus','stopAll','dispose'])silent[name]=async()=>{};
    for(const [name,fn] of Object.entries(silent))natives['Java_syx_browser_BrowserAudio_'+name]=fn;
    return {resume(){}};
  }
  let context, master, groups, nextId=1, generation=0, listenerX=0, listenerY=0, muteWhenHidden=false;
  const sounds=new Map(), loading=new Set(), effectVoices=new Set(), decoded=new Map(), levels=[1,1,1,1];
  const parameterValues=new WeakMap();
  // Experimental HTMLAudio-free path. Limit retained PCM and encoded inputs; inactive buffers
  // can be decoded again from their original bytes when another track needs the memory.
  let pcmBytes=0, pcmEncodedBytes=0;
  const pcmAssetLimit=128*1024*1024, pcmTotalLimit=256*1024*1024;
  function dropPcmBuffer(sound) {
    if(sound.pcm && sound.streamBuffer){pcmBytes-=sound.pcmSize;delete sound.streamBuffer;}
  }
  function canFitPcm(size) {
    if(size>pcmAssetLimit)return false;
    let retained=pcmBytes;
    for(const sound of sounds.values())if(sound.pcm && sound.streamBuffer && !sound.source && !sound.pendingBufferedPlay)retained-=sound.pcmSize;
    return retained+size<=pcmTotalLimit;
  }
  function makePcmRoom(size) {
    if(size>pcmAssetLimit)return false;
    for(const sound of sounds.values()) {
      if(pcmBytes+size<=pcmTotalLimit)break;
      if(sound.pcm && !sound.source && !sound.pendingBufferedPlay)dropPcmBuffer(sound);
    }
    return pcmBytes+size<=pcmTotalLimit;
  }
  function preparePcm(sound) {
    if(sound.streamBuffer)return Promise.resolve(true);
    if(sound.pcmPreparing)return sound.pcmPreparing;
    if(sound.pcmDecoding)return Promise.resolve(false);
    if(!sound.pcmEncoded || (sound.pcmSize && !canFitPcm(sound.pcmSize)))return Promise.resolve(false);
    const epoch=generation;
    loading.add(sound);
    sound.pcmPreparing=(async()=>{
      let timer;
      const decoding=ensure().decodeAudioData(sound.pcmEncoded.buffer.slice(0));
      // A wrapper timeout cannot cancel WebKit's decoder; don't pile another decode onto it.
      sound.pcmDecoding=decoding;
      const settled=()=>{if(sound.pcmDecoding===decoding)sound.pcmDecoding=undefined;};
      Promise.resolve(decoding).then(settled,settled);
      const bounded=new Promise((resolve,reject)=>{
        timer=setTimeout(()=>reject(new Error('PCM decode timed out')),15000);
        Promise.resolve(decoding).then(resolve,reject);
      });
      let buffer;
      try{buffer=await loadResult(sound,bounded);}finally{clearTimeout(timer);}
      if(epoch!==generation || sound.released)return false;
      const size=buffer.length*buffer.numberOfChannels*4;
      if(!Number.isSafeInteger(size) || size<=0 || !(buffer.duration>0))throw new Error('Invalid PCM stream');
      sound.pcmSize=size;sound.length=buffer.duration;
      if(size>pcmAssetLimit) {
        pcmEncodedBytes-=sound.pcmEncoded.byteLength;delete sound.pcmEncoded;
        console.warn('PCM stream exceeds 128 MiB:',sound.name);return false;
      }
      if(!makePcmRoom(size))return false;
      sound.streamBuffer=buffer;sound.pcmRetryAfter=0;pcmBytes+=size;return true;
    })().catch(error=>{
      if(epoch===generation && !sound.released && error.name!=='AbortError')sound.pcmRetryAfter=Date.now()+1000;
      throw error;
    }).finally(()=>{loading.delete(sound);sound.pcmPreparing=undefined;});
    return sound.pcmPreparing;
  }
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  function setParameter(parameter,value) {
    // Game frames often repeat the same value; avoid flooding the audio control thread.
    if(parameterValues.get(parameter)!==value){parameter.value=value;parameterValues.set(parameter,value);}
  }
  function ensure() {
    if(context) return context;
    context=new AudioContext(); master=context.createGain(); master.connect(context.destination);
    groups=levels.map((v,i)=>{const gain=context.createGain(); gain.gain.value=i===0?1:v; gain.connect(master); return gain;});
    updateMaster(); return context;
  }
  function masterLevel() { return muteWhenHidden && (document.hidden || !document.hasFocus()) ? 0 : levels[0]; }
  function updateDirectGain(sound) {
    const volume=masterLevel()*levels[sound.category]*sound.gain;
    if(sound.directVolume!==volume){sound.media.volume=volume;sound.directVolume=volume;}
  }
  function updateMaster() {
    if(master)setParameter(master.gain,masterLevel());
    if(directMusic)for(const sound of sounds.values())if(sound.direct)updateDirectGain(sound);
  }
  function resume() {
    if(context?.state==='suspended') context.resume().catch(error=>console.warn('Audio resume failed:',error));
    for(const sound of sounds.values()) if(sound.pendingPlay) attemptPlay(sound);
  }
  async function attemptPlay(sound) {
    if(sound.playPromise)return sound.playPromise;
    const attempt=sound.playAttempt=(sound.playAttempt||0)+1;
    sound.pendingPlay=false;
    const cancelled=new Promise(resolve=>{sound.cancelPlay=()=>resolve(false);});
    const playing=(async()=>{
      try {await sound.media.play();if(sound.playAttempt!==attempt)return false;sound.playing=true;return true;}
      catch(error) {
        if(sound.playAttempt===attempt) {
          if(error.name==='NotAllowedError')sound.pendingPlay=true;
          else if(error.name!=='AbortError')console.warn('Audio playback failed:',error);
        }
        return false;
      }
    })();
    sound.playPromise=Promise.race([playing,cancelled]);
    try{return await sound.playPromise;}
    finally{if(sound.playAttempt===attempt){sound.playPromise=undefined;sound.cancelPlay=undefined;}}
  }
  function streamTime(sound) {
    const time=sound.offset+(sound.playing?ensure().currentTime-sound.startedAt:0);
    return sound.loop?time%sound.length:Math.min(time,sound.length);
  }
  function startBufferedStream(sound,restart) {
    if(sound.source)return true;
    if(restart || !(sound.offset>0))sound.offset=0;
    // An offset at/after the buffer end (stop at a non-loop end before onended ran) must restart
    // from 0, matching HTMLMediaElement.play() after ended; otherwise we start an ended source.
    if(!(sound.offset<sound.length))sound.offset=0;
    const source=ensure().createBufferSource();source.buffer=sound.streamBuffer;source.loop=sound.loop;source.connect(sound.gainNode);
    source.onended=()=>{if(sound.source===source){sound.source=undefined;sound.playing=false;sound.offset=0;}source.onended=null;source.disconnect();};
    sound.startedAt=ensure().currentTime;sound.playing=true;sound.source=source;
    try{source.start(0,sound.offset);}
    catch(error) {
      // A rejected start must leave the record retryable instead of looking permanently playing.
      source.onended=null;
      try{source.disconnect();}catch(ignored){}
      if(sound.source===source){sound.source=undefined;sound.playing=false;}
      console.warn('Audio buffer start failed:',error);
      return false;
    }
    return true;
  }
  function stopStream(sound) {
    if(sound.streamBuffer || sound.pcm){
      if(sound.streamBuffer)sound.offset=streamTime(sound);
      sound.pendingBufferedPlay=undefined;sound.playing=false;
      if(sound.source){sound.source.onended=null;sound.source.stop();sound.source.disconnect();sound.source=undefined;}
      return;
    }
    sound.playAttempt=(sound.playAttempt||0)+1;sound.cancelPlay?.();sound.cancelPlay=undefined;sound.playPromise=undefined;
    sound.pendingPlay=false;sound.media.pause();sound.playing=false;
  }
  function releaseStream(sound) {
    if(!sound || (!sound.media && !sound.pcm) || sound.released)return;
    sound.released=true;
    stopStream(sound);
    if(sound.media){sound.media.removeAttribute('src');sound.media.load();}
    dropPcmBuffer(sound);
    if(sound.pcmEncoded){pcmEncodedBytes-=sound.pcmEncoded.byteLength;delete sound.pcmEncoded;}
    sound.input?.disconnect();sound.gainNode?.disconnect();sound.distance?.disconnect();sound.panner?.disconnect();
    if(sound.url)URL.revokeObjectURL(sound.url);
  }
  function loadResult(record,promise) {
    return new Promise((resolve,reject)=>{
      record.cancelLoad=()=>reject(Object.assign(new Error('Audio load cancelled'),{name:'AbortError'}));
      Promise.resolve(promise).then(resolve,reject);
    });
  }
  function position(record) {
    if (!record.panner) return;
    const width=Math.max(1,canvas?.width || 1280), height=Math.max(1,canvas?.height || 720);
    setParameter(record.panner.pan,clamp((record.x-listenerX)/(width/2),-1,1));
    // Match the original OpenAL inverse-distance model, including its listener depth and limits.
    const distance=clamp(Math.hypot((record.x-listenerX)/width,(record.y-listenerY)/height,0.5),1,5);
    setParameter(record.distance.gain,1/(1+2*(distance-1)));
  }
  function chain(category, spatial, gain) {
    const ctx=ensure(), gainNode=ctx.createGain(), distance=ctx.createGain(), panner=spatial?ctx.createStereoPanner():null;
    gainNode.gain.value=gain; gainNode.connect(distance);
    if(panner){distance.connect(panner);panner.connect(groups[category]);}else distance.connect(groups[category]);
    return {gainNode,distance,panner};
  }
  function releaseVoice(voice) {
    if(!effectVoices.delete(voice))return;
    voice.source.onended=null;voice.source.disconnect();voice.gainNode.disconnect();voice.distance.disconnect();voice.panner?.disconnect();
  }
  function get(id) { return sounds.get(id); }
  // Safari can stall short looping media elements even while their play promise is resolved.
  // Decode only requested loops up to ten seconds; long audio keeps its streaming path.
  function bufferShortLoop(sound) {
    if(sound.streamBuffer || !sound.encoded)return;
    if(sound.buffering)return sound.buffering;
    const epoch=generation;
    sound.buffering=Promise.resolve().then(async()=>{
      if(sound.released || epoch!==generation)return;
      loading.add(sound);
      try {
        const buffer=await loadResult(sound,ensure().decodeAudioData(sound.encoded.buffer.slice(0)));
        if(epoch!==generation || sound.released || get(sound.id)!==sound || !sound.loop || !(buffer.duration>0 && buffer.duration<=10))return;
        const playing=!sound.media.paused,offset=sound.media.currentTime||0;
        sound.input?.disconnect();sound.input=undefined;
        stopStream(sound);sound.media.removeAttribute('src');sound.media.load();
        if(sound.url){URL.revokeObjectURL(sound.url);sound.url=undefined;}
        if(sound.direct){Object.assign(sound,chain(sound.category,false,sound.gain));sound.direct=false;}
        sound.streamBuffer=buffer;sound.length=buffer.duration;sound.offset=offset%sound.length;delete sound.encoded;
        if(playing)startBufferedStream(sound,false);
      }catch(error){if(error.name!=='AbortError')console.warn('Short audio loop decode failed:',error);}
      finally{loading.delete(sound);sound.buffering=undefined;}
    });
    return sound.buffering;
  }
  function connectStream(sound,spatial) {
    const input=ensure().createMediaElementSource(sound.media),nodes=chain(sound.category,spatial,sound.gain);
    input.connect(nodes.gainNode);Object.assign(sound,nodes,{input,direct:false});sound.media.volume=1;
    position(sound);
  }
  async function load(_lib,name,encoded,category) {
    let record;
    const loadedGeneration=generation;
    try {
      const bytes=new Uint8Array(encoded.buffer,encoded.byteOffset,encoded.byteLength).slice();
      const id=nextId++;
      record={id,name,category,playing:false,loop:false,gain:1,offset:0,x:0,y:0};
      loading.add(record);
      if(category===3) {
        let buffer=decoded.get(name);
        if(!buffer){buffer=await loadResult(record,ensure().decodeAudioData(bytes.buffer));if(loadedGeneration!==generation)return 0;decoded.set(name,buffer);}
        record.buffer=buffer;record.length=buffer.duration;
      } else if(pcmStreams) {
        record.pcm=true;
        if(bytes.byteLength>32*1024*1024 || pcmEncodedBytes+bytes.byteLength>256*1024*1024)throw new Error('PCM encoded input limit exceeded');
        record.pcmEncoded=bytes;pcmEncodedBytes+=bytes.byteLength;
        await preparePcm(record);
        if(loadedGeneration!==generation || record.released){releaseStream(record);return 0;}
        Object.assign(record,chain(category,false,record.gain));
      } else {
        ensure(); const url=URL.createObjectURL(new Blob([bytes])), media=new Audio();
        record.media=media;record.url=url;
        media.preload='metadata'; media.src=url;
        await loadResult(record,new Promise((resolve,reject)=>{media.addEventListener('loadedmetadata',resolve,{once:true});media.addEventListener('error',()=>reject(new Error('Unsupported audio format')),{once:true});media.load();}));
        // A game reset can dispose audio while metadata is still loading.
        if(loadedGeneration!==generation){releaseStream(record);return 0;}
        record.media=media;record.url=url;record.length=media.duration;
        if(record.length>0 && record.length<=10)record.encoded=bytes;
        if(directMusic && category===1){record.direct=true;updateDirectGain(record);}
        else connectStream(record,false);
        // An unsettled play promise must not prevent replay after the stream ends.
        media.addEventListener('ended',()=>{if(!record.streamBuffer)stopStream(record);});
      }
      sounds.set(id,record); return id;
    } catch(error) {releaseStream(record);if(error.name!=='AbortError')console.warn('Could not load game audio:',name,error); return 0;}
    finally {loading.delete(record);}
  }
  natives.Java_syx_browser_BrowserAudio_load=load;
  natives.Java_syx_browser_BrowserAudio_playEffect=async (_lib,id,gain,pitch,spatial,x,y)=>{
    const asset=get(id); if(!asset?.buffer || gain<=0 || pitch<=0) return false;
    const source=ensure().createBufferSource(), nodes=chain(3,spatial,clamp(gain,0,1)), voice={...nodes,source,x,y};
    source.buffer=asset.buffer;source.playbackRate.value=pitch;source.connect(nodes.gainNode); position(voice);
    source.onended=()=>releaseVoice(voice);
    effectVoices.add(voice);source.start();return true;
  };
  natives.Java_syx_browser_BrowserAudio_playStream=async (_lib,id,restart)=>{
    const a=get(id);if(a?.streamBuffer)return startBufferedStream(a,restart);
    if(a?.pcm) {
      // An evicted track is restored in the background, never blocking a game-frame native.
      if(a.pendingBufferedPlay){a.pendingBufferedPlay.restart ||= restart;return true;}
      if(!a.pcmEncoded || (a.pcmDecoding && !a.pcmPreparing) || Date.now()<(a.pcmRetryAfter||0) || (a.pcmSize && !canFitPcm(a.pcmSize)))return false;
      const request=a.pendingBufferedPlay={restart},epoch=generation;
      void preparePcm(a).then(ready=>{
        if(ready && epoch===generation && !a.released && a.pendingBufferedPlay===request)startBufferedStream(a,request.restart);
      }).catch(error=>{if(error.name!=='AbortError')console.warn('PCM stream decode failed:',error);})
        .finally(()=>{if(a.pendingBufferedPlay===request)a.pendingBufferedPlay=undefined;});
      return true;
    }
    if(!a?.media)return false;if(!a.media.paused)return true;
    if(restart)a.media.currentTime=0;
    // Safari can start playback without settling media.play(). Never block the Java game loop on it.
    // Success means the request was accepted; isPlaying reports actual playback.
    void attemptPlay(a); return true;
  };
  natives.Java_syx_browser_BrowserAudio_stopStream=async (_lib,id)=>{const a=get(id);if(a?.media || a?.pcm)stopStream(a);};
  natives.Java_syx_browser_BrowserAudio_setStreamGain=async (_lib,id,value)=>{const a=get(id);if(!a)return;a.gain=clamp(value,0,1);if(a.direct)updateDirectGain(a);else if(a.gainNode)setParameter(a.gainNode.gain,a.gain);};
  natives.Java_syx_browser_BrowserAudio_setStreamLoop=async (_lib,id,value)=>{
    const a=get(id);if(!a?.media && !a?.pcm)return;
    const loop=!!value;
    if(a.streamBuffer || a.pcm){
      if(a.loop!==loop){if(a.streamBuffer)a.offset=streamTime(a);a.startedAt=ensure().currentTime;a.loop=loop;}
      if(a.source)a.source.loop=a.loop;
      return;
    }
    a.loop=loop;a.media.loop=value;
    if(a.loop){
      // Promotion decodes asynchronously. The game loop must never wait on it: the native call
      // returns now, playback stays on the media path until conversion takes over.
      const conversion=bufferShortLoop(a);
      if(conversion&&typeof conversion.catch==='function')conversion.catch(error=>console.warn('Short audio loop conversion failed:',error));
    }
  };
  natives.Java_syx_browser_BrowserAudio_setStreamPosition=async (_lib,id,x,y)=>{
    const a=get(id); if(!a?.media && !a?.pcm)return; a.x=x;a.y=y;
    if(a.direct){connectStream(a,true);return;}
    if(!a.panner){a.panner=ensure().createStereoPanner();a.distance.disconnect();a.distance.connect(a.panner);a.panner.connect(groups[a.category]);}
    position(a);
  };
  natives.Java_syx_browser_BrowserAudio_length=async (_lib,id)=>get(id)?.length || 0;
  natives.Java_syx_browser_BrowserAudio_progress=async (_lib,id)=>{const a=get(id);return a?.streamBuffer?streamTime(a)/a.length:a?.media && a.length ? a.media.currentTime/a.length : 0;};
  natives.Java_syx_browser_BrowserAudio_isPlaying=async (_lib,id)=>{
    const a=get(id);
    // The music caller selects another track on false. Keep an accepted restoration busy until
    // it starts or fails, so decoding cannot leave abandoned tracks that start together later.
    if(a?.pcm && a.pendingBufferedPlay)return true;
    // Suspending/interruption pauses the context clock, not the source. Reporting false there
    // makes the caller queue more tracks which all become audible when the context resumes.
    return a?.streamBuffer?!!a.source && context.state!=='closed' && (a.loop || streamTime(a)<a.length):!!a?.media && !a.media.paused && !a.media.ended;
  };
  natives.Java_syx_browser_BrowserAudio_setListener=async (_lib,x,y)=>{listenerX=x;listenerY=y;for(const v of effectVoices)position(v);for(const a of sounds.values())position(a);};
  natives.Java_syx_browser_BrowserAudio_setGain=async (_lib,category,value)=>{levels[category]=clamp(value,0,1);if(category===0)updateMaster();else{if(groups)setParameter(groups[category].gain,levels[category]);if(directMusic && category===1)for(const a of sounds.values())if(a.direct)updateDirectGain(a);}};
  natives.Java_syx_browser_BrowserAudio_setMuteOnFocus=async (_lib,value)=>{muteWhenHidden=value;updateMaster();};
  natives.Java_syx_browser_BrowserAudio_stopAll=async()=>{for(const a of sounds.values())if(a.media || a.pcm)stopStream(a);for(const v of [...effectVoices]){v.source.stop();releaseVoice(v);}};
  natives.Java_syx_browser_BrowserAudio_dispose=async()=>{generation++;for(const a of loading){a.cancelLoad?.();releaseStream(a);}await natives.Java_syx_browser_BrowserAudio_stopAll();for(const a of sounds.values())releaseStream(a);sounds.clear();decoded.clear();};
  document.addEventListener('visibilitychange',updateMaster);
  window.addEventListener('focus',updateMaster);window.addEventListener('blur',updateMaster);
  document.addEventListener('pointerdown',resume,{capture:true});document.addEventListener('keydown',resume,{capture:true});
  return {resume};
}
