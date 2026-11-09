const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const fail=()=>{throw Error('Disabled audio must not touch browser audio or events');};
const scope=vm.createContext({Audio:fail,AudioContext:fail,document:{addEventListener:fail},window:{addEventListener:fail}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../audio.js'),'utf8'),scope);
const natives={},controller=vm.runInContext('installAudioNatives',scope)(natives,true,true);
const declarations=fs.readFileSync(path.join(__dirname,'../src/syx/browser/BrowserAudio.java'),'utf8');
const methods=[...declarations.matchAll(/native\s+(\w+)\s+(\w+)\(/g)];
assert.equal(Object.keys(natives).length,methods.length,'disabled mode must cover the entire actual Java boundary');
(async()=>{
 for(const [,type,name] of methods){
  const call=natives['Java_syx_browser_BrowserAudio_'+name];assert.equal(typeof call,'function',name);
  const value=await call(null,17,new Uint8Array([1]),2);
  if(type==='boolean')assert.equal(value,false,name);
  else if(type==='void')assert.equal(value,undefined,name);
  else if(name==='load')assert.ok(value>0,'silent asset ids prevent repeated Java file reads');
  else assert.equal(value,0,name);
 }
 controller.resume();
 const load=natives.Java_syx_browser_BrowserAudio_load,a=await load(),b=await load();assert.notEqual(a,b);
 await natives.Java_syx_browser_BrowserAudio_dispose();assert.ok(await load()>b);
 console.log('Disabled audio: all Java native signatures, cached silent ids, no audio objects/events: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
