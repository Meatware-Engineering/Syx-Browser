// Development-only timing overlay; no game files or save contents are inspected.
function installAudioDiagnostics(natives) {
  const prefix='Java_syx_browser_BrowserAudio_', original={...natives};
  const streams=new Map(), pending=new Map();
  let next=0, frames=0, lastFrames=0, longest=0, ticks=0, loads=0;
  const loadCounts=[0,0,0,0], loadNames=new Set();
  let repeatedLoads=0;
  let lastTick=performance.now();
  const started=lastTick, panel=document.createElement('pre');
  Object.assign(panel.style,{position:'fixed',top:'4px',left:'4px',zIndex:2147483647,
    background:'#111e',color:'#bff',padding:'8px',font:'14px monospace',pointerEvents:'none',maxWidth:'95vw'});
  document.body.append(panel);
  for(const [name,fn] of Object.entries(original)) {
    if(name===prefix+'dispose') {
      natives[name]=async(...args)=>{streams.clear();return fn(...args);};
    } else if(name.startsWith(prefix)) {
      natives[name]=async(...args)=>{
        if(name===prefix+'load'){
          loads++;loadCounts[args[3]]=(loadCounts[args[3]]||0)+1;
          if(typeof args[1]==='string'){const key=args[3]+':'+args[1];if(loadNames.has(key))repeatedLoads++;else loadNames.add(key);}
        }
        const token=++next, time=performance.now();
        pending.set(token,{name:name.slice(prefix.length),time});
        try {
          const result=await fn(...args);
          if(name===prefix+'load' && result && args[3]!==3)streams.set(result,args[3]);
          return result;
        } finally {longest=Math.max(longest,performance.now()-time);pending.delete(token);}
      };
    }
  }
  const swap='Java_org_lwjgl_glfw_GLFW_glfwSwapBuffers';
  natives[swap]=async(...args)=>{frames++;return original[swap](...args);};
  setInterval(async()=>{
    const now=performance.now(), fps=((frames-lastFrames)*1000/(now-lastTick)).toFixed(1);lastFrames=frames;lastTick=now;ticks++;
    const playing=[];
    for(const [id,category] of streams)if(await original[prefix+'isPlaying'](null,id)) {
      const length=await original[prefix+'length'](null,id), progress=await original[prefix+'progress'](null,id);
      playing.push(`${id}/${category===1?'music':'ambient'} ${(length*progress).toFixed(1)}s`);
    }
    panel.textContent=`DEV ${((now-started)/1000).toFixed(0)}s | heartbeat ${ticks} | frames/s ${fps} | longest audio native ${longest.toFixed(0)}ms | loads ${loads} [music ${loadCounts[1]}, ambient ${loadCounts[2]}, fx ${loadCounts[3]}] repeats ${repeatedLoads}\n`+
      `Streams: ${playing.join(' | ') || 'none playing'}\n`+
      `Pending: ${[...pending.values()].map(p=>`${p.name} ${((now-p.time)/1000).toFixed(1)}s`).join(' | ') || 'none'}`;
  },1000);
}
