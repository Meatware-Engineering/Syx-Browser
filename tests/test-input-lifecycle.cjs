const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class Surface {
 constructor(){this.listeners=new Map();this.width=100;this.height=100;}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 emit(type,values={}){for(const fn of [...(this.listeners.get(type)||[])])fn({code:'KeyW',key:'w',getModifierState:()=>false,preventDefault(){},...values});}
 getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}focus(){} remove(){}
}
(async()=>{
 const old=new Surface(),fresh=new Surface(),window=new Surface(),document=new Surface();document.hidden=false;
 const ctx=vm.createContext({window,document,console,old,fresh,Int32Array,setTimeout});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../bridge.js'),'utf8'),ctx);
 const api=vm.runInContext('natives',ctx),drain=async()=>Array.from(await api.Java_syx_browser_BrowserBridge_drainInput());
 vm.runInContext('canvas=old',ctx);await api.Java_syx_browser_BrowserBridge_installInputHandler();
 old.emit('keydown');await drain();old.emit('mousedown',{button:0,clientX:10,clientY:10});await drain();await drain();
 document.hidden=true;document.emit('visibilitychange');
 const hidden=[...await drain(),...await drain(),...await drain()];
 assert.deepEqual(hidden,[1,87,0,0,3,0,0,0],'hiding the page releases held keys/buttons without blur');
 document.hidden=false;document.emit('visibilitychange');assert.deepEqual(await drain(),[]);
 vm.runInContext('canvas=fresh',ctx);await api.Java_syx_browser_BrowserBridge_installInputHandler();
 old.emit('keydown');old.emit('mousedown',{button:0,clientX:90,clientY:90});
 assert.deepEqual([...await drain(),...await drain(),...await drain()],[],'replaced canvas must not retain input listeners');
 fresh.emit('keydown');assert.deepEqual(await drain(),[1,87,1,0,2,119,0,0]);
 await api.Java_syx_browser_BrowserBridge_installInputHandler();
 fresh.emit('keyup');assert.deepEqual(await drain(),[1,87,0,0],'reinstall must release the old held key');
 await api.Java_syx_browser_BrowserBridge_destroyContext();
 assert.equal([...fresh.listeners.values()].reduce((n,set)=>n+set.size,0),0,'destroy removes canvas listeners');
 assert.equal([...document.listeners.values()].reduce((n,set)=>n+set.size,0),0,'destroy removes document listener');
 assert.equal([...window.listeners.values()].reduce((n,set)=>n+set.size,0),0,'destroy removes window listeners');
 console.log('Input lifecycle: hidden release, replaced canvas isolation, destroy cleanup: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
