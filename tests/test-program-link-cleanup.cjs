const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
(async()=>{
 const prior={},state={current:prior,writes:[]};
 const gl={LINK_STATUS:35714,linkProgram(){},getProgramParameter:()=>true,useProgram(p){state.current=p;},getUniformLocation(p,name){return name==='syx_point_size'?null:{program:p,name};},
  uniform1f(location,value){assert.equal(state.current,location.program);state.writes.push(value);}
 };
 const ctx=vm.createContext({console,fake:gl,prior});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../shader.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(process.env.BRIDGE_JS||path.join(__dirname,'../bridge.js'),'utf8'),ctx);
 vm.runInContext('gl=fake;currentProgram=prior',ctx);
 const native=vm.runInContext('natives.Java_org_lwjgl_opengl_GL20_glLinkProgram',ctx);
 const broken=vm.runInContext("remember({syxShaders:[{source:'uniform vec3 tint = vec3(0.5);'}]})",ctx);
 await assert.rejects(native(null,broken),/Unsupported uniform initializer/);
 assert.equal(state.current,prior,'an initializer error must restore the previous program');
 const good=vm.runInContext("remember({syxShaders:[{source:'uniform float value = 0.25;'}]})",ctx);
 await native(null,good);assert.deepEqual(state.writes,[0.25]);assert.equal(state.current,prior);
 console.log('Program link initialization: binding restored after rejection and successful defaults: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
