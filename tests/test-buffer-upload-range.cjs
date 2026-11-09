const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
(async()=>{
const calls=[],ctx=vm.createContext({console,fake:{bufferData(...args){calls.push(args);},bufferSubData(...args){calls.push(args);}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../bridge.js'),'utf8'),ctx);vm.runInContext('gl=fake',ctx);
const n=vm.runInContext('natives',ctx),data=new Int8Array([9,9,-1,2,3,4,9,9]);
await n.Java_org_lwjgl_opengl_GL15_bufferDataByteRange(null,34962,data,2,4,35048);
assert.deepEqual([...calls[0][1]],[-1,2,3,4]);assert.equal(calls[0][1].buffer,data.buffer,'view avoids clone');assert.equal(calls[0][2],35048);
await n.Java_org_lwjgl_opengl_GL15_bufferSubDataByteRange(null,34962,17n,data,3,2);
assert.equal(calls[1][1],17);assert.deepEqual([...calls[1][2]],[2,3]);assert.equal(calls[1][2].buffer,data.buffer);
await n.Java_org_lwjgl_opengl_GL15_bufferDataByteRange(null,34962,data,8,0,35048);assert.equal(calls[2][1].byteLength,0);
console.log('Heap buffer uploads: byte range, shared storage, destination offset and empty range: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
