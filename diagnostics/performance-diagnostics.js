// Opt-in development metrics: synchronous bridge work excludes Java/runtime conversion and GPU completion.
function installPerformanceDiagnostics(natives, {now=()=>performance.now(), intervalMs=30000, render}={}) {
  const originals=new Map(), calls=new Map();
  const stencilState=new Map();
  let frames=0, lastFrame, intervals=[], start=now(), windowNumber=0;
  let lagMax=0, lagOver250=0, lastTick=now(), focusChanges=0, hiddenTicks=0;
  let focused=typeof document==='undefined'?null:document.hasFocus();
  function sampleEnvironment(){
    const time=now(), lag=Math.max(0,time-lastTick-100);lastTick=time;
    lagMax=Math.max(lagMax,lag);if(lag>250)lagOver250++;
    if(typeof document!=='undefined'){
      const current=document.hasFocus();if(current!==focused)focusChanges++;focused=current;
      if(document.hidden)hiddenTicks++;
    }
  }
  function snapshot(){
    const elapsed=now()-start, sorted=[...intervals].sort((a,b)=>a-b);
    const rows=[...calls].map(([name,value])=>({name,...value})).sort((a,b)=>b.ms-a.ms);
    return {window:++windowNumber,seconds:Number((elapsed/1000).toFixed(3)),frames,
      fps:Number((frames*1000/elapsed).toFixed(2)),frameP50:sorted.length?sorted[Math.floor((sorted.length-1)*0.5)]:null,
      frameP95:sorted.length?sorted[Math.floor((sorted.length-1)*0.95)]:null,
      frameP99:sorted.length?sorted[Math.floor((sorted.length-1)*0.99)]:null,frameMax:sorted.length?sorted[sorted.length-1]:null,
      framesOver250ms:sorted.filter(value=>value>250).length,
      eventLoopLagMax:Math.round(lagMax),eventLoopLagsOver250:lagOver250,focusChanges,hiddenTicks,
      repeatedStencilCalls:rows.reduce((n,r)=>n+r.repeated,0),
      stencilCalls:rows.filter(r=>/GL11_(?:glStencil|setStencil)(Func|Op)$/.test(r.name)).reduce((n,r)=>n+r.count,0),
      nativeCalls:rows.reduce((n,r)=>n+r.count,0),syncNativeMs:Number(rows.reduce((n,r)=>n+r.ms,0).toFixed(2)),
      frequent:[...rows].sort((a,b)=>b.count-a.count).slice(0,3).map(r=>({name:r.name,count:r.count})),
      uploadBytes:rows.reduce((n,r)=>n+r.bytes,0),top:rows.slice(0,10).map(r=>({...r,ms:Number(r.ms.toFixed(2))})),
      canvas:typeof canvas!=='undefined'&&canvas?`${canvas.width}x${canvas.height}`:null};
  }
  function reset(){calls.clear();stencilState.clear();frames=0;lastFrame=undefined;intervals=[];start=now();lagMax=0;lagOver250=0;focusChanges=0;hiddenTicks=0;lastTick=now();}
  for(const [name,fn] of Object.entries(natives)){
    if(!name.startsWith('Java_org_lwjgl_')&&!name.startsWith('Java_syx_browser_BrowserBridge_'))continue;
    originals.set(name,fn);
    natives[name]=function(...args){
      const begin=now();
      try{return fn.apply(this,args);}finally{
        const ms=now()-begin, row=calls.get(name)||{count:0,ms:0,bytes:0,repeated:0};row.count++;row.ms+=ms;
        if(/GL11_(?:glStencil|setStencil)(Func|Op)$/.test(name)){
          const previous=stencilState.get(name), values=args.slice(1);
          if(previous&&values.every((v,i)=>v===previous[i]))row.repeated++;
          stencilState.set(name,values);
        }
        if(name.endsWith('BrowserBridge_createContext')||name.endsWith('BrowserBridge_destroyContext'))stencilState.clear();
        if(name.endsWith('bufferDataByteRange'))row.bytes+=args[4];
        else if(name.endsWith('bufferSubDataByteRange'))row.bytes+=args[5];
        else if(/buffer(?:Sub)?Data|tex(?:Sub)?Image2D/.test(name))for(const arg of args)if(ArrayBuffer.isView(arg))row.bytes+=arg.byteLength;
        calls.set(name,row);
        if(name==='Java_org_lwjgl_glfw_GLFW_glfwSwapBuffers'){
          frames++;if(lastFrame!==undefined&&intervals.length<4096)intervals.push(begin-lastFrame);lastFrame=begin;
        }
      }
    };
  }
  const environmentTimer=render?setInterval(sampleEnvironment,100):undefined;
  let timer;
  if(render)timer=setInterval(()=>{render(snapshot());reset();},intervalMs);
  return {snapshot,reset,dispose(){if(timer)clearInterval(timer);if(environmentTimer)clearInterval(environmentTimer);for(const [name,fn] of originals)natives[name]=fn;}};
}
