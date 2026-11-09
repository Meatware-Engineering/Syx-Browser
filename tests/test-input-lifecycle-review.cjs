// Independent fake-DOM regressions for bridge.js input lifecycle.
// Sections marked REPRO assert desired behaviour and currently fail; guards pass.
// Findings: canvas replacement leaves the old canvas listening and the new one dead, and
// re-installing input while a key is held drops the keyup (stuck key). Hidden-only transitions
// do not release held input (no visibilitychange handler) even though blur does.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

class El {
  constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.listeners=new Map();this.style={};this.width=0;this.height=0;this.tabIndex=-1;}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  removeEventListener(type,fn){const list=this.listeners.get(type)||[];const index=list.indexOf(fn);if(index>=0)list.splice(index,1);}
  dispatchEvent(event){event.target=this;for(const fn of [...(this.listeners.get(event.type)||[])])fn(event);return !event.defaultPrevented;}
  appendChild(child){child.parentNode=this;this.children.push(child);return child;}
  remove(){if(this.parentNode){const list=this.parentNode.children;list.splice(list.indexOf(this),1);this.parentNode=null;}}
  getBoundingClientRect(){return {left:0,top:0,width:this.width||100,height:this.height||100};}
  getContext(){return {};}
  focus(){this.focused=true;}
}
function event(type,props={}){
  return {type,code:'',key:'',repeat:false,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,isComposing:false,
    button:0,clientX:0,clientY:0,deltaX:0,deltaY:0,defaultPrevented:false,clipboardData:null,
    preventDefault(){this.defaultPrevented=true;},getModifierState(){return false;},...props};
}
function harness(){
  const display=new El('div'), documentListeners=new Map();
  const document={hidden:false,activeElement:null,createElement:tag=>new El(tag),querySelector:sel=>sel==='#display'?display:null,
    hasFocus:()=>true,addEventListener(t,f){if(!documentListeners.has(t))documentListeners.set(t,[]);documentListeners.get(t).push(f);},
    removeEventListener(t,f){const l=documentListeners.get(t)||[];const i=l.indexOf(f);if(i>=0)l.splice(i,1);},
    dispatchEvent(e){e.target=document;for(const f of [...(documentListeners.get(e.type)||[])])f(e);return !e.defaultPrevented;}};
  const windowListeners=new Map();
  const window={innerWidth:100,innerHeight:100,
    addEventListener(t,f){if(!windowListeners.has(t))windowListeners.set(t,[]);windowListeners.get(t).push(f);},
    removeEventListener(t,f){const l=windowListeners.get(t)||[];const i=l.indexOf(f);if(i>=0)l.splice(i,1);},
    dispatchEvent(e){e.target=window;for(const f of [...(windowListeners.get(e.type)||[])])f(e);return !e.defaultPrevented;}};
  const ctx=vm.createContext({document,window,setTimeout,clearTimeout,console:{warn(){},error(){},log(){}}});
  vm.runInContext(fs.readFileSync(process.env.BRIDGE_JS||path.join(__dirname,'../bridge.js'),'utf8'),ctx);
  const natives=vm.runInContext('natives',ctx);
  return {display,document,window,natives,fire:(target,type,props)=>target.dispatchEvent(event(type,props))};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const watchdog=setTimeout(()=>{console.error('bridge input lifecycle test timed out');process.exitCode=1;},2500);
const KEY_W=87,KEY_S=83,KEY_D=68;

(async()=>{
  const failures=[];
  const check=async(name,fn)=>{try{await fn();}catch(error){failures.push(name+': '+error.message);}};

  // GUARD: canvas blur releases a held key exactly once.
  await check('guard: canvas blur releases held keys',async()=>{
    const h=harness();
    await h.natives.Java_syx_browser_BrowserBridge_createContext(null,100,100);
    const canvas=h.display.children.at(-1);
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    h.fire(canvas,'keydown',{code:'KeyW',key:'w'});
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[1,KEY_W,1,0,2,119,0,0]);
    h.fire(canvas,'blur');
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[1,KEY_W,0,0]);
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[]);
  });

  // REPRO 1: caller contract is glfwCreateWindow -> createContext, then glfwSetKeyCallback ->
  // installInputHandler. Reinstalling on the replacement canvas must not leave the previous
  // handler attached to the old canvas (the cleanup currently targets the mutable global canvas).
  await check('repro 1: replaced canvas keeps the old handler',async()=>{
    const h=harness();
    await h.natives.Java_syx_browser_BrowserBridge_createContext(null,100,100);
    const oldCanvas=h.display.children.at(-1);
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    h.fire(oldCanvas,'keydown',{code:'KeyW',key:'w'});
    await h.natives.Java_syx_browser_BrowserBridge_drainInput();
    await h.natives.Java_syx_browser_BrowserBridge_createContext(null,100,100);
    const newCanvas=h.display.children.at(-1);
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    assert.notEqual(newCanvas,oldCanvas);
    h.fire(newCanvas,'keydown',{code:'KeyS',key:'s'});
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[1,KEY_W,0,0,1,KEY_S,1,0,2,115,0,0],
      'reinstall releases the old held key before the new canvas input');
    h.fire(oldCanvas,'keydown',{code:'KeyD',key:'d'});
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[],
      'the previous canvas handler must be removed from the old canvas');
  });

  // REPRO 2: re-installing while a key is held drops that key's release forever.
  await check('repro 2: reinstall drops held-key release',async()=>{
    const h=harness();
    await h.natives.Java_syx_browser_BrowserBridge_createContext(null,100,100);
    const canvas=h.display.children.at(-1);
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    h.fire(canvas,'keydown',{code:'KeyW',key:'w'});
    await h.natives.Java_syx_browser_BrowserBridge_drainInput();
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler(); // reset/reinstall
    h.fire(canvas,'keyup',{code:'KeyW',key:'w'});
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[1,KEY_W,0,0],
      'reinstalling must release keys held by the previous handler');
    h.fire(canvas,'keydown',{code:'KeyW',key:'w'});
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[1,KEY_W,1,0,2,119,0,0],
      'the new handler still works');
  });

  // REPRO 3: a hidden-only transition (no blur) leaves input held; there is no visibility handler.
  await check('repro 3: hidden transition releases held input',async()=>{
    const h=harness();
    await h.natives.Java_syx_browser_BrowserBridge_createContext(null,100,100);
    const canvas=h.display.children.at(-1);
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    h.fire(canvas,'keydown',{code:'KeyW',key:'w'});
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[1,KEY_W,1,0,2,119,0,0]);
    h.document.hidden=true;
    h.fire(h.document,'visibilitychange');
    assert.deepEqual(Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()),[1,KEY_W,0,0],
      'becoming hidden must release held input even without a blur event');
  });

  // REPRO 4: a held mouse button and modifier are released exactly once on reinstall, and a
  // following blur/visibility sequence must not duplicate those releases.
  await check('repro 4: held mouse/modifier released once on reinstall',async()=>{
    const h=harness();
    await h.natives.Java_syx_browser_BrowserBridge_createContext(null,100,100);
    const canvas=h.display.children.at(-1);
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    h.fire(canvas,'keydown',{code:'ControlLeft',key:'Control',ctrlKey:true});
    h.fire(canvas,'mousedown',{button:0,clientX:10,clientY:10});
    for(let i=0;i<3;i++)await h.natives.Java_syx_browser_BrowserBridge_drainInput();
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    h.fire(canvas,'blur');h.fire(h.window,'blur');
    h.document.hidden=true;h.fire(h.document,'visibilitychange');
    const all=[];
    for(let i=0;i<6;i++)all.push(...Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()));
    const controlUps=all.filter((_,i)=>i%4===0&&all[i]===1&&all[i+1]===341&&all[i+2]===0).length;
    const mouseUps=all.filter((_,i)=>i%4===0&&all[i]===3&&all[i+1]===0&&all[i+2]===0).length;
    assert.equal(controlUps,1,'the held modifier keyup is released exactly once');
    assert.equal(mouseUps,1,'the held mouse button is released exactly once');
  });

  // GUARD: duplicate blur/visibility transitions emit one release, never two.
  await check('guard: duplicate blur/visibility releases once',async()=>{
    const h=harness();
    await h.natives.Java_syx_browser_BrowserBridge_createContext(null,100,100);
    const canvas=h.display.children.at(-1);
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    h.fire(canvas,'keydown',{code:'KeyW',key:'w'});
    await h.natives.Java_syx_browser_BrowserBridge_drainInput();
    h.fire(canvas,'blur');h.fire(h.window,'blur');
    h.document.hidden=true;h.fire(h.document,'visibilitychange');
    const all=[];
    for(let i=0;i<3;i++)all.push(...Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()));
    const ups=all.filter((_,i)=>i%4===0&&all[i]===1&&all[i+1]===KEY_W&&all[i+2]===0).length;
    assert.equal(ups,1,'only one keyup is emitted for the same held key');
  });

  // GUARD: ordinary blur and keyup still work after the above scenarios in a fresh harness.
  await check('guard: window blur releases key and mouse',async()=>{
    const h=harness();
    await h.natives.Java_syx_browser_BrowserBridge_createContext(null,100,100);
    const canvas=h.display.children.at(-1);
    await h.natives.Java_syx_browser_BrowserBridge_installInputHandler();
    h.fire(canvas,'keydown',{code:'KeyW',key:'w'});
    h.fire(canvas,'mousedown',{button:0,clientX:10,clientY:10});
    h.fire(h.window,'blur');
    const all=[];
    for(let i=0;i<4;i++)all.push(...Array.from(await h.natives.Java_syx_browser_BrowserBridge_drainInput()));
    const keyUps=all.filter((_,i)=>i%4===0&&all[i]===1&&all[i+1]===KEY_W&&all[i+2]===0).length;
    assert.equal(keyUps,1,'exactly one keyup is emitted on blur');
    assert.ok(all.some((_,i)=>i%4===0&&all[i]===3),'the held mouse button is released on blur');
  });

  if(failures.length){
    for(const failure of failures)console.error('REPRO: '+failure);
    throw new Error(failures.length+' bridge input lifecycle finding(s) reproduced');
  }
  console.log('Bridge input lifecycle: guards pass and repros pass (candidate fixed)');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
