const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
(async()=>{
 const C={FRAMEBUFFER:36160,READ_FRAMEBUFFER:36008,DRAW_FRAMEBUFFER:36009,READ_FRAMEBUFFER_BINDING:36010,DRAW_FRAMEBUFFER_BINDING:36006,COLOR_ATTACHMENT0:36064,TEXTURE_2D:3553,RENDERBUFFER:36161};
 const state={};const target=t=>t===C.READ_FRAMEBUFFER?state.read:state.draw;
 const gl={...C,createFramebuffer:()=>({physical:new Map()}),createRenderbuffer:()=>({kind:'renderbuffer'}),createTexture:()=>({kind:'texture'}),
  bindFramebuffer(t,f){if(t!==C.READ_FRAMEBUFFER)state.draw=f;if(t!==C.DRAW_FRAMEBUFFER)state.read=f;},
  getParameter(p){return p===C.READ_FRAMEBUFFER_BINDING?state.read:state.draw;},
  framebufferRenderbuffer(t,a,rt,rb){if(target(t)){if(rb)target(t).physical.set(a,rb);else target(t).physical.delete(a);}},
  framebufferTexture2D(t,a,tt,tex){if(tex)target(t).physical.set(a,tex);else target(t).physical.delete(a);},
  drawBuffers(values){state.buffers=values;}
 };
 const ctx=vm.createContext({console,fake:gl});vm.runInContext(fs.readFileSync(process.env.BRIDGE_JS||path.join(__dirname,'../bridge.js'),'utf8'),ctx);vm.runInContext('gl=fake',ctx);
 const native=vm.runInContext('natives',ctx),api=n=>native['Java_org_lwjgl_opengl_'+n],obj=id=>vm.runInContext(`object(${id})`,ctx),ca=C.COLOR_ATTACHMENT0;
 const fb=await api('GL30_glGenFramebuffers')(),rb=await api('GL30_glGenRenderbuffers')();await api('GL30_glBindFramebuffer')(null,C.FRAMEBUFFER,fb);
 await api('GL30_glFramebufferRenderbuffer')(null,C.FRAMEBUFFER,ca,C.RENDERBUFFER,rb);
 await api('GL20_drawBuffers')(null,new Int32Array([ca]));
 assert.equal(obj(fb).physical.get(ca),obj(rb),'a color renderbuffer stays attached');
 await api('GL30_glFramebufferRenderbuffer')(null,C.FRAMEBUFFER,ca,C.RENDERBUFFER,0);
 await api('GL30_glFramebufferRenderbuffer')(null,C.FRAMEBUFFER,ca+1,C.RENDERBUFFER,rb);
 const tex=await api('GL11_glGenTextures')();await api('GL30_glFramebufferTexture2D')(null,C.FRAMEBUFFER,ca,C.TEXTURE_2D,tex,0);
 await api('GL20_drawBuffers')(null,new Int32Array([ca+1,ca]));
 assert.equal(obj(fb).physical.get(ca),obj(rb));assert.equal(obj(fb).physical.get(ca+1),obj(tex));
 await api('GL20_drawBuffers')(null,new Int32Array([ca,ca+1]));
 assert.equal(obj(fb).physical.get(ca),obj(tex));assert.equal(obj(fb).physical.get(ca+1),obj(rb));
 const read=await api('GL30_glGenFramebuffers')();await api('GL30_glBindFramebuffer')(null,C.READ_FRAMEBUFFER,read);
 await api('GL30_glFramebufferRenderbuffer')(null,C.READ_FRAMEBUFFER,ca,C.RENDERBUFFER,rb);
 await api('GL30_glBindFramebuffer')(null,C.DRAW_FRAMEBUFFER,read);await api('GL20_drawBuffers')(null,new Int32Array([ca]));
 assert.equal(obj(read).physical.get(ca),obj(rb),'READ_FRAMEBUFFER registration uses the read binding');
 console.log('Framebuffer color renderbuffers: identity/remap/restoration and READ target: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
