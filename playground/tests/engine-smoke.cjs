const assert=require('node:assert/strict');
const createMilo=require('../dist/engine/milo-engine.js');
let events=[],answers=[],traces=[];
global.self=global;
self.MiloHost={emit(type,payload){events.push({type,payload});},async wait(seconds){events.push({type:'wait',payload:seconds});await new Promise(resolve=>setTimeout(resolve,seconds*1000));},async key(){await new Promise(resolve=>setTimeout(resolve,5));events.push({type:'key',payload:'left'});return 'left';},async trace(line,variables){traces.push({line,variables});},async ask(prompt){events.push({type:'ask',payload:prompt});return answers.shift()??'blue';}};
(async()=>{
 const engine=await createMilo({wasmBinary:require('node:fs').readFileSync('dist/engine/milo-engine.wasm')});
 async function run(code,input=[]){events=[];traces=[];answers=input.slice();await engine.ccall('milo_run',null,['string'],[code],{async:true});return {events:structuredClone(events),traces:structuredClone(traces)};}
 let result=await run('color("blue")\nrepeat 4\nmove(120)\nturn(90)\nend');
 assert.equal(result.events.filter(e=>e.type==='draw'&&e.payload.name==='move').length,4);
 assert(result.events.some(e=>e.type==='complete'));assert(result.traces.length>=9);
 result=await run('name = ask("Name? ")\nsay "Hello", name',['Ana']);
 assert(result.events.some(e=>e.type==='ask'));assert(result.events.some(e=>e.type==='output'&&e.payload==='Hello Ana'));
 assert.deepEqual(result.events.find(e=>e.type==='complete').payload.variables,[{name:'name',value:'Ana'}]);
 result=await run('name = ask("Name? ")\nsay name',['Лена']);assert(result.events.some(e=>e.type==='output'&&e.payload==='Лена'));
 result=await run('name = "Ana"\nsay naem');assert.equal(result.events.at(-1).type,'error');assert.equal(result.events.at(-1).payload.line,2);
 result=await run('function twice(n)\nreturn n*2\nend\nsay twice(6)');assert(result.events.some(e=>e.type==='output'&&e.payload==='12'));
 result=await run('repeat 4\nsay 1');assert.equal(result.events.at(-1).type,'error');
 result=await run('go_to(-100, 50)\nfill("gold")\ndot(80)\nrectangle(100, 60)\npolygon(5, 40)\nno_fill()\ncircle(20)');
 assert(result.events.some(e=>e.type==='complete'));assert.deepEqual(result.events.filter(e=>e.type==='draw').map(e=>e.payload.name),['go_to','fill','dot','rectangle','polygon','no_fill','circle']);
 for(const code of ['go_to(1)','dot(0)','rectangle(-1, 20)','polygon(2, 50)','polygon(3.5, 20)','fill("notacolor")']){
   result=await run(code);assert.equal(result.events.at(-1).type,'error',code);assert.equal(result.events.at(-1).payload.line,1);
 }
 result=await run('say "before"\nwait(0.01)\ndirection = key()\nsay direction');
 assert.deepEqual(result.events.filter(e=>['output','wait','key'].includes(e.type)).map(e=>[e.type,e.payload]),[['output','before'],['wait',0.01],['key','left'],['output','left']]);
 assert(result.events.some(e=>e.type==='complete'));assert(result.events.find(e=>e.type==='complete').payload.variables.some(v=>v.name==='direction'&&v.value==='left'));
 for(const code of ['wait()','wait(1, 2)','wait(-1)','wait(61)','wait("1")','key(1)']){
   result=await run(code);assert.equal(result.events.at(-1).type,'error',code);assert.equal(result.events.at(-1).payload.line,1);
 }
 console.log('WebAssembly engine: drawing, input, snapshots, errors, functions and trace hooks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
