const assert=require('node:assert/strict'),fs=require('node:fs');
const createMilo=require('../dist/engine/milo-engine.js');
let events=[],rng=[],sprites=new Map(),pressed=[],randomIndex=0;
global.self=global;
self.MiloHost={emit(type,payload){events.push({type,payload});if(type==='draw'&&payload.name==='sprite_state')sprites.set(payload.args[0],payload.args);},random(){return rng.length?rng.shift():[0,.99,.2,.7,.8,.1,.4,.5,.9,.3][randomIndex++%10];},async trace(){},async wait(seconds){events.push({type:'wait',payload:seconds});},async key(){const p=sprites.get(1),s=sprites.get(2);let k='space';if(p&&s&&Math.hypot(p[3]-s[3],p[4]-s[4])>40){const dx=s[3]-p[3],dy=s[4]-p[4];k=Math.abs(dx)>=Math.abs(dy)?dx>0?'right':'left':dy>0?'up':'down';}pressed.push(k);return k;},async ask(){return 'blue';}};
(async()=>{
 const engine=await createMilo({wasmBinary:fs.readFileSync('dist/engine/milo-engine.wasm')});
 async function run(code,randoms=[]){events=[];rng=randoms.slice();sprites=new Map();pressed=[];randomIndex=0;await engine.ccall('milo_run',null,['string'],[code],{async:true});return structuredClone(events);}
 let result=await run('say random(-4, 4)\nsay random(-4, 4)\nsay random(7, 7)',[0,.999999,.5]);assert.equal(result.at(-1).type,'complete');assert.deepEqual(result.filter(e=>e.type==='output').map(e=>e.payload),['-4','4','7']);
 result=await run('show_score(0)\nplay_note(48, 0.05)\nshow_score(5)\nplay_note(84, 2)');assert.equal(result.at(-1).type,'complete');assert.deepEqual(result.filter(e=>['score','note','wait'].includes(e.type)),[{type:'score',payload:0},{type:'note',payload:{note:48,seconds:.05}},{type:'wait',payload:.05},{type:'score',payload:5},{type:'note',payload:{note:84,seconds:2}},{type:'wait',payload:2}]);
 for(const code of ['random()','random(5, 1)','random(1.5, 3)','random(true, 3)','random(-1000001, 1)','play_note(47, 0.2)','play_note(85, 0.2)','play_note(60.5, 0.2)','play_note(60, 0)','play_note(60, 3)','play_note(60, "1")','show_score(-1)','show_score(1.5)','show_score(true)','show_score(1000001)','show_score()']){result=await run(code);assert.equal(result.at(-1).type,'error',code);assert.equal(result.at(-1).payload.line,1,code);}
 const {lessons}=await import('data:text/javascript;base64,'+fs.readFileSync('dist/lessons.js').toString('base64'));
 const lesson=lessons.find(l=>l.id==='five-stars');result=await run(lesson.code);assert.equal(result.at(-1).type,'complete');
 const scores=result.filter(e=>e.type==='score').map(e=>e.payload),notes=result.filter(e=>e.type==='note').map(e=>e.payload),output=result.filter(e=>e.type==='output').map(e=>e.payload);
 assert.deepEqual(scores,[0,1,2,3,4,5]);assert.equal(notes.length,5);assert.equal(sprites.get(2)[5],false);assert(lesson.check({scores,notes,output}));assert(new Set(pressed).size>1);
 result=await run(lesson.code.replace('repeat 120','repeat 1'));assert.equal(result.at(-1).type,'complete');assert(result.some(e=>e.type==='output'&&/Try again/.test(e.payload)));
 console.log('Random inclusive bounds, score/note sequencing, invalid arguments, and five-star game win/retry paths passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
