const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const media=[],sources=[],gains=[],panners=[],events={};
let focused=true,volumeWrites=0;
class Audio{
  constructor(){this.paused=true;this.duration=40;media.push(this);}
  get volume(){return this.level;}
  set volume(value){this.level=value;volumeWrites++;}
  addEventListener(name,fn){this[name]=fn;}
  load(){if(this.src)this.loadedmetadata();}
  pause(){this.paused=true;}
  removeAttribute(){this.src='';}
}
const node=()=>({gain:{value:0},pan:{value:0},connect(other){this.destination=other;},disconnect(){this.disconnected=true;}});
class AudioContext{
  createGain(){const n=node();gains.push(n);return n;}
  createMediaElementSource(){const n=node();sources.push(n);return n;}
  createStereoPanner(){const n=node();panners.push(n);return n;}
}
const context=vm.createContext({Audio,AudioContext,Blob,Uint8Array,canvas:{width:1280,height:720},
  URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},document:{addEventListener(name,fn){events[name]=fn;},hasFocus:()=>focused},
  window:{addEventListener(name,fn){events[name]=fn;}},console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../audio.js'),'utf8'),context);
const natives={},api=name=>natives['Java_syx_browser_BrowserAudio_'+name];
vm.runInContext('installAudioNatives',context)(natives,true);
(async()=>{
  const music=await api('load')(null,'music.wav',new Uint8Array([1]),1);
  assert.ok(music);assert.equal(sources.length,0,'direct music must bypass MediaElementAudioSourceNode');
  await api('setGain')(null,0,0.8);await api('setGain')(null,1,0.5);await api('setStreamGain')(null,music,0.4);
  assert.ok(Math.abs(media[0].volume-0.16)<1e-12,'direct music must multiply master, category and stream volume');
  const before=volumeWrites;
  await api('setStreamGain')(null,music,0.4);assert.equal(volumeWrites,before);
  await api('setMuteOnFocus')(null,true);
  focused=false;events.blur();assert.equal(media[0].volume,0);
  focused=true;events.focus();assert.ok(Math.abs(media[0].volume-0.16)<1e-12);
  await api('setStreamLoop')(null,music,true);assert.equal(media[0].loop,true);
  const ambient=await api('load')(null,'ambient.wav',new Uint8Array([1]),2);
  assert.equal(sources.length,1,'ambient must keep its Web Audio path');
  await api('setStreamPosition')(null,ambient,0,0);
  await api('setListener')(null,-12800,0);
  assert.equal(panners[0].pan.value,1);
  assert.equal(gains[gains.length-1].gain.value,1/9,'ambient distance attenuation must remain intact');
  await api('setStreamPosition')(null,music,0,0);
  assert.equal(sources.length,2,'a positional music request must retain spatial support');
  assert.equal(media[0].volume,1,'graph-routed audio must not multiply volume twice');
  assert.equal(sources[1].destination.gain.value,0.4);
  await api('dispose')();assert.equal(media[0].src,'');assert.equal(media[1].src,'');
  console.log('Direct music volume, focus mute and spatial fallback: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
