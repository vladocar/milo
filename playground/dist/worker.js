/* One fresh worker per run: Stop terminates the entire VM immediately. */
importScripts('./engine/milo-engine.js','./input-runtime.js');
const input=new MiloInput({notify:payload=>postMessage({type:'control',payload})});
let mode='run', credits=0, speed=25, waitingStep=null, waitingAnswer=null, traces=0, commands=0;
function releaseStep(){ input.resume(); if(waitingStep){ const resolve=waitingStep; waitingStep=null; resolve(); } }
self.MiloHost={
  random(){return Math.random();},
  emit(type,payload){
    if(type==='draw' && ++commands>4000) throw new Error('Try a smaller repeat number. This drawing has more than 4000 instructions.');
    postMessage({type,payload});
  },
  async trace(line,variables){
    if(++traces>4000) throw new Error('Try a smaller repeat number. This program has taken more than 4000 teaching steps.');
    postMessage({type:'trace',line,variables,paused:mode==='step' && credits===0});
    if(mode==='step'){
      if(credits>0) credits--;
      else await new Promise(resolve=>{waitingStep=resolve;});
    }
    if(mode==='run') await new Promise(resolve=>setTimeout(resolve,speed));
  },
  async wait(seconds){await input.wait(seconds);},
  async key(){return await input.key();},
  async ask(prompt){
    postMessage({type:'ask',prompt});
    return await new Promise(resolve=>{waitingAnswer=resolve;});
  }
};
const ready=createMilo({locateFile:path=>new URL('./engine/'+path,self.location.href).href,
  printErr:message=>postMessage({type:'diagnostic',message})});
self.onmessage=async ({data})=>{
  if(data.type==='start'){
    mode=data.mode||'run'; credits=mode==='step'?1:0; speed=data.speed??25;
    try{
      const engine=await ready;
      postMessage({type:'ready'});
      await engine.ccall('milo_run',null,['string'],[data.code],{async:true});
    }catch(error){postMessage({type:'error',payload:{line:0,message:error.message||String(error)}});}
  }else if(data.type==='step'){
    const withinInput=!!input.pending; mode='step'; input.resume(); if(waitingStep) releaseStep(); else if(!withinInput) credits++;
  }else if(data.type==='pause'){
    mode='step'; credits=0; input.pause();
  }else if(data.type==='continue'){
    mode='run'; credits=0; input.resume(); releaseStep();
  }else if(data.type==='key'){
    input.accept(data.key);
  }else if(data.type==='answer'){
    if(waitingAnswer){const resolve=waitingAnswer;waitingAnswer=null;resolve(data.answer);}
  }else if(data.type==='speed') speed=data.value;
};
