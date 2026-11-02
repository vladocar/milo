const assert=require('node:assert/strict'),fs=require('node:fs');
const createMilo=require('../dist/engine/milo-engine.js');
let events=[],answers=[],waits=[],keys=[],keyQueue=[];global.self=global;
self.MiloHost={emit(type,payload){events.push({type,payload});},random(){return .75;},async trace(){},async wait(seconds){waits.push(seconds);},async key(){const key=keyQueue.shift()??'right';keys.push(key);return key;},async ask(){return answers.shift()??'purple';}};
(async()=>{
 const {lessons,examples}=await import('data:text/javascript;base64,'+fs.readFileSync('dist/lessons.js').toString('base64'));
 const engine=await createMilo({wasmBinary:require('node:fs').readFileSync('dist/engine/milo-engine.wasm')});
 const solutions={
  animation:code=>code.replace('repeat 3','repeat 6'),
  hello:code=>code+'say "My name is Alex"\n',
  variables:code=>code.replace('Ada','Alex'),
  square:code=>code.replace('teal','blue').replace('100','120'),
  pattern:code=>code.replace('repeat 6','repeat 8').replace('turn(60)','turn(45)'),
  counter:code=>code.replace('repeat 6 as count\n','repeat 6 as count\n    say count\n'),
  functions:code=>code.replace('repeat 3','repeat 6'),
  studio:code=>code+'\npen_up()\nturn(90)\nmove(150)\npen_down()\ncolor("purple")\nstar(60)\n'
 };
 async function run(code,input=[]){events=[];waits=[];keys=[];keyQueue=['left','right','up','space'];if(code.includes('show_score'))keyQueue=['right','right','up','space','space','space','space','space'];answers=input.slice();await engine.ccall('milo_run',null,['string'],[code],{async:true});assert(!events.some(e=>e.type==='error'),JSON.stringify(events.find(e=>e.type==='error')));const complete=events.find(e=>e.type==='complete');assert(complete,'Program must finish');return {code,output:events.filter(e=>e.type==='output').map(e=>e.payload),draw:events.filter(e=>e.type==='draw').map(e=>e.payload),scores:events.filter(e=>e.type==='score').map(e=>e.payload),notes:events.filter(e=>e.type==='note').map(e=>e.payload),answers:input,waits:waits.slice(),keys:keys.slice(),variables:complete.payload.variables};}
 for(const lesson of lessons){
   const input=lesson.id==='quiz'?['5']:lesson.id==='choices'?['12']:['purple'];
   await run(lesson.code,input);
   const code=solutions[lesson.id]?.(lesson.code)??lesson.code;
   const result=await run(code,input);assert(lesson.check(result),lesson.id+' challenge must accept its solution');
   console.log('Lesson '+lesson.id+': starter and challenge passed');
 }
 for(const example of examples){await run(example.code,[example.name.includes('number')?'3':'Alex']);console.log('Example '+example.name+': passed');}
})().catch(error=>{console.error(error);process.exitCode=1;});
