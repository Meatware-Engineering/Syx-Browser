const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
(async()=>{
 const state={current:null,writes:0},gl={
  createProgram(){return {};},deleteProgram(p){p.deleted=true;if(state.current!==p)p.finalized=true;},
  useProgram(p){assert.ok(!p?.finalized);if(state.current?.deleted&&state.current!==p)state.current.finalized=true;state.current=p;},
  getUniformLocation(p,name){return name==='missing'?null:{program:p,name};},
  uniform1f(location){assert.equal(state.current,location.program);assert.ok(!location.program.finalized);state.writes++;}
 };
 const ctx=vm.createContext({console,fake:gl});vm.runInContext(fs.readFileSync(process.env.BRIDGE_JS||path.join(__dirname,'../bridge.js'),'utf8'),ctx);vm.runInContext('gl=fake',ctx);
 const n=vm.runInContext('natives',ctx),call=(name,...args)=>n['Java_org_lwjgl_opengl_GL20_'+name](null,...args),count=()=>vm.runInContext('objects.size',ctx);
 const live=await call('glCreateProgram'),location=await call('getUniformLocation',live,'amount');
 assert.equal(await call('getUniformLocation',live,'missing'),-1);await call('glUniform1f',-1,1);assert.equal(state.writes,0);
 await call('glUseProgram',live);await call('glDeleteProgram',live);await call('glUniform1f',location,1);assert.equal(state.writes,1);assert.equal(count(),1,'bound deletion preserves active location');
 await call('glUseProgram',0);assert.equal(count(),0,'unbind releases deleted current-program locations');await assert.rejects(call('glUniform1f',location,1),/Unknown WebGL object/);
 const keep=await call('glCreateProgram'),kept=await call('getUniformLocation',keep,'amount');await call('glUseProgram',keep);
 for(let i=0;i<100;i++){
  const p=await call('glCreateProgram'),loc=await call('getUniformLocation',p,'amount');await call('glDeleteProgram',p);assert.equal(count(),2,'unbound program deletion cannot grow registry');await assert.rejects(call('glUniform1f',loc,1),/Unknown WebGL object/);
 }
 await call('glUniform1f',kept,1);assert.equal(state.writes,2,'other program retains its location');
 await n.Java_syx_browser_BrowserBridge_destroyContext();assert.equal(count(),0);await assert.rejects(call('glUniform1f',kept,1));
 console.log('Uniform handles: deferred deletion, 100 unbound cycles, live isolation, teardown and -1: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
