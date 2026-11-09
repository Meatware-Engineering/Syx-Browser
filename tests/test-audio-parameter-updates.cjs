const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let writes=0;
const param=()=>({get value(){return this.current||0;},set value(v){writes++;this.current=v;}});
const node=()=>({gain:param(),pan:param(),connect(){},disconnect(){}});
const gainNodes=[], panNodes=[];
class Audio {
  constructor(){this.duration=1;this.paused=true;}
  addEventListener(name,callback){this[name]=callback;}
  load(){if(this.src)this.loadedmetadata();}
  pause(){}
  removeAttribute(){this.src='';}
}
class AudioContext {
  createGain(){const n=node();gainNodes.push(n);return n;}
  createMediaElementSource(){return node();}
  createStereoPanner(){const n=node();panNodes.push(n);return n;}
}
const context=vm.createContext({Audio,AudioContext,Blob,Uint8Array,canvas:{width:1280,height:720},
  URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
  document:{addEventListener(){},hasFocus:()=>true},window:{addEventListener(){}},console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../audio.js'),'utf8'),context);
const natives={};vm.runInContext('installAudioNatives',context)(natives);
const api=name=>natives['Java_syx_browser_BrowserAudio_'+name];
(async()=>{
  const id=await api('load')(null,'ambient.wav',new Uint8Array([1]),2);
  await api('setStreamPosition')(null,id,1280,720);
  await api('setListener')(null,100,100);
  await api('setStreamGain')(null,id,0.4);
  await api('setGain')(null,0,0.8);
  await api('setGain')(null,2,0.5);
  const before=writes;
  for(let i=0;i<10000;i++){
    await api('setListener')(null,100,100);
    await api('setStreamGain')(null,id,0.4);
    await api('setGain')(null,0,0.8);
    await api('setGain')(null,2,0.5);
  }
  assert.equal(writes,before,'unchanged game values must not enqueue repeated AudioParam writes');
  const oldPan=panNodes[0].pan.value;
  await api('setListener')(null,1600,100);
  assert.notEqual(panNodes[0].pan.value,oldPan,'moving the listener must still update pan');
  const movedPan=panNodes[0].pan.value;
  vm.runInContext('canvas.width=640',context);
  await api('setListener')(null,1600,100);
  assert.notEqual(panNodes[0].pan.value,movedPan,'resizing the canvas must still update pan');
  await api('dispose')();
  console.log('Audio parameter deduplication and spatial updates: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
