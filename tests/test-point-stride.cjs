const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
(async()=>{
 const state={pointers:new Map(),divisors:new Map()};
 const gl={POINTS:0,UNSIGNED_INT:5125,ARRAY_BUFFER:34962,ARRAY_BUFFER_BINDING:34964,TRIANGLE_STRIP:5,
  createVertexArray:()=>({}),bindVertexArray(){},createBuffer:()=>({}),
  bindBuffer(target,buffer){state.buffer=buffer;},getParameter(){return state.buffer;},
  vertexAttribPointer(index,size,type,normalized,stride,pointer){state.pointers.set(index,{size,type,normalized,stride,pointer});},
  vertexAttribIPointer(index,size,type,stride,pointer){state.pointers.set(index,{size,type,stride,pointer});},
  vertexAttribDivisor(index,value){state.divisors.set(index,value);},
  drawArraysInstanced(mode,first,count,instances){state.draw={mode,first,count,instances,pointers:new Map(state.pointers),divisors:new Map(state.divisors)};}
 };
 const ctx=vm.createContext({console,glFake:gl});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../bridge.js'),'utf8'),ctx);
 vm.runInContext('gl=glFake;currentProgram={syxPointGeometry:true}',ctx);
 const api=name=>vm.runInContext('natives',ctx)['Java_org_lwjgl_opengl_'+name];
 await api('GL30_glBindVertexArray')(null,await api('GL30_glGenVertexArrays')());
 const buffer=await api('GL15_glGenBuffers')();await api('GL15_glBindBuffer')(null,34962,buffer);
 await api('GL20_glVertexAttribPointer')(null,0,2,5126,false,0,0); // 2 floats = 8 bytes
 await api('GL20_glVertexAttribPointer')(null,1,4,5121,true,0,0); // 4 bytes
 await api('GL30_glVertexAttribIPointer')(null,2,2,5122,0,0); // 2 shorts = 4 bytes
 await api('GL20_glVertexAttribPointer')(null,3,4,33640,true,0,0); // packed 2:10:10:10 = 4 bytes
 await api('GL20_glVertexAttribPointer')(null,4,2,5126,false,16,4);
 const original=new Map(state.pointers),previous=await api('GL15_glGenBuffers')();
 await api('GL15_glBindBuffer')(null,34962,previous);const previousBuffer=state.buffer;
 await api('GL20_glDrawElements')(null,0,1,5125,4); // sequential index 1
 assert.deepEqual([...state.draw.pointers.values()].map(x=>x.pointer),[8,4,4,4,20],'point start must advance tightly packed and explicit strides');
 assert.deepEqual([...state.draw.divisors.values()],[1,1,1,1,1]);
 assert.deepEqual(state.pointers,original,'original pointer/stride metadata is restored');
 assert.deepEqual([...state.divisors.values()],[0,0,0,0,0]);
 assert.equal(state.buffer,previousBuffer,'ARRAY_BUFFER binding is restored');
 console.log('Point expansion: zero/explicit/packed stride offsets and restoration: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
