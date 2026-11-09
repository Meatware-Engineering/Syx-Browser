const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let time=0;const context=vm.createContext({console,ArrayBuffer,canvas:{width:800,height:600},setInterval,clearInterval});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../diagnostics/performance-diagnostics.js'),'utf8'),context);
const promise=Promise.resolve(7),failure=new Error('kept'),natives={
 Java_org_lwjgl_glfw_GLFW_glfwSwapBuffers(){time+=2;return promise;},
 Java_org_lwjgl_opengl_GL15_bufferDataBytes(_lib,target,data){time+=3;return data.length;},
 Java_org_lwjgl_opengl_GL15_bufferDataByteRange(){return 0;},
 Java_org_lwjgl_opengl_GL11_glClear(){throw failure;}, unrelated(){return 9;}
};const originals={...natives};context.natives=natives;context.fakeNow=()=>time;
const profiler=vm.runInContext('installPerformanceDiagnostics(natives,{now:fakeNow})',context);
assert.equal(natives.Java_org_lwjgl_glfw_GLFW_glfwSwapBuffers(),promise,'preserve exact Promise');time=20;natives.Java_org_lwjgl_glfw_GLFW_glfwSwapBuffers();
assert.equal(natives.Java_org_lwjgl_opengl_GL15_bufferDataBytes(null,1,new Uint8Array(12)),12);
assert.throws(()=>natives.Java_org_lwjgl_opengl_GL11_glClear(),error=>error===failure);
natives.Java_org_lwjgl_opengl_GL15_bufferDataByteRange(null,1,new Uint8Array(64),13,5,0);
time=40;const result=profiler.snapshot();assert.equal(result.frames,2);assert.equal(result.nativeCalls,5);assert.equal(result.syncNativeMs,7);assert.equal(result.uploadBytes,17);assert.equal(result.frameP50,20);assert.equal(result.canvas,'800x600');assert.equal(natives.unrelated,originals.unrelated);
profiler.reset();assert.equal(profiler.snapshot().frames,0);profiler.dispose();for(const name in originals)assert.equal(natives[name],originals[name]);
console.log('Performance diagnostic: exact returns/errors, frame/call/time/bytes counters, reset and restoration: PASS');
