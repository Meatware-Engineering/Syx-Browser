const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const pending=[],media=[];
const watchdog=setTimeout(()=>{console.error('Playback native did not return within one second');process.exitCode=1;},1000);
class Audio {
  constructor(){this.paused=true;this.duration=1;this.events={};media.push(this);}
  addEventListener(name,fn){this.events[name]=fn;}
  load(){if(this.src)this.events.loadedmetadata();}
  play(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));}
  pause(){this.paused=true;}
  removeAttribute(){this.src='';}
}
const node=()=>({gain:{value:0},connect(){},disconnect(){}});
class AudioContext{createGain(){return node();}createMediaElementSource(){return node();}}
const context=vm.createContext({Audio,AudioContext,Blob,Uint8Array,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
  document:{addEventListener(){}},window:{addEventListener(){}},console:{warn(){}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../audio.js'),'utf8'),context);
const natives={},api=name=>natives['Java_syx_browser_BrowserAudio_'+name];
vm.runInContext('installAudioNatives',context)(natives);
(async()=>{
  const id=await api('load')(null,'music.wav',new Uint8Array([1]),1);
  const first=api('playStream')(null,id,true), second=api('playStream')(null,id,false);
  assert.equal(pending.length,1,'concurrent calls must share one media.play request');
  assert.equal(await first,true,'the native must accept playback without waiting for media.play');
  assert.equal(await second,true);
  const late=pending.shift();
  let firstResult,secondResult;
  first.then(value=>{firstResult=value;});second.then(value=>{secondResult=value;});
  await api('stopStream')(null,id);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(firstResult,true,'accepted requests stay nonblocking even when media.play never settles');
  assert.equal(secondResult,true);
  const fresh=api('playStream')(null,id,true), freshMedia=pending.shift();
  late.reject(Object.assign(new Error('late'),{name:'NotAllowedError'}));
  freshMedia.resolve();
  assert.equal(await fresh,true,'a stale rejection must not cancel a fresh play request');
  await api('stopStream')(null,id);
  await api('playStream')(null,id,true);
  assert.equal(pending.length,1);
  pending.shift(); // Safari never settles this request, even after media ends.
  media[0].events.ended();
  await api('playStream')(null,id,true);
  assert.equal(pending.length,1,'ended streams must accept a fresh play despite an unresolved old promise');
  await api('dispose')();
  console.log('Audio concurrent play and cancellation: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
