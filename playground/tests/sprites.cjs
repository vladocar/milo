const assert=require('node:assert/strict'),fs=require('node:fs');
const createMilo=require('../dist/engine/milo-engine.js');
let events=[],keys=[];global.self=global;
self.MiloHost={emit(type,payload){events.push({type,payload});},async trace(){},async wait(){},async key(){return keys.shift()??'space';},async ask(){return 'blue';}};
(async()=>{
 const engine=await createMilo({wasmBinary:require('node:fs').readFileSync('dist/engine/milo-engine.wasm')});
 const {createScene,applyCommand}=await import('data:text/javascript;base64,'+fs.readFileSync('dist/drawing.js').toString('base64'));
 const {lessons,examples}=await import('data:text/javascript;base64,'+fs.readFileSync('dist/lessons.js').toString('base64'));
 async function run(code,input=[]){events=[];keys=input.slice();await engine.ccall('milo_run',null,['string'],[code],{async:true});return structuredClone(events);}
 function completed(result){assert.equal(result.at(-1).type,'complete',JSON.stringify(result.at(-1)));}
 function outputs(result){return result.filter(e=>e.type==='output').map(e=>e.payload);}
 let result=await run('player = sprite("turtle")\nstar = sprite("star")\nplace(player, -100, 0)\nplace(star, 100, 0)\nsay touching(player, star)\nshift(player, 160, 0)\nsay touching(player, star)\nhide(star)\nsay touching(player, star)\nshow(star)\nsay touching(player, star)\ncolor(player, "purple")\nsay player');
 completed(result);assert.deepEqual(outputs(result),['false','true','false','true','<turtle sprite #1>']);
 const scene=createScene();for(const e of result)if(e.type==='draw')applyCommand(scene,e.payload);
 assert.equal(scene.sprites.length,2);assert.equal(scene.sprites[0].x,310);assert.equal(scene.sprites[0].color,'purple');assert.equal(scene.sprites[1].visible,true);
 result=await run('a = sprite("circle")\nb = sprite("square")\nplace(b, 40, 0)\nsay touching(a, b)\nplace(b, 40.01, 0)\nsay touching(a, b)\nplace(b, 28, 28)\nsay touching(a, b)\nplace(b, 29, 29)\nsay touching(a, b)');completed(result);assert.deepEqual(outputs(result),['true','false','true','false']);
 result=await run('a = sprite("turtle")\nb = a\nitems = [a]\nfunction paint(s)\ncolor(s, "pink")\nend\npaint(items[0])\nshift(b, 10000, -10000)\nsay a == b\nsay a == items[0]\nsay a == sprite("turtle")\nhide(a)\nsay touching(a, a)\nshow(a)\nsay touching(a, a)');completed(result);assert.deepEqual(outputs(result),['true','true','false','false','true']);
 const state=result.filter(e=>e.type==='draw'&&e.payload.name==='sprite_state'&&e.payload.args[0]===1).at(-1).payload.args;assert.deepEqual(state,[1,'turtle','pink',230,-230,true]);
 result=await run('color("blue")\nmove(30)\na = sprite("star")\nplace(a, 50, 50)\nclear()\nshift(a, 10, 0)\nmove(20)');completed(result);const drawing=createScene();for(const e of result)if(e.type==='draw')applyCommand(drawing,e.payload);assert.equal(drawing.sprites[0].x,310);assert.equal(drawing.shapes.length,1);assert.equal(drawing.y,230);assert.equal(drawing.shapes[0].color,'blue');
 for(const code of ['sprite()','sprite("cat")','sprite(1)','sprite("star", "badcolor")','place(1, 0, 0)','place(sprite("star"), 1)','shift(sprite("star"), "20", 0)','place(sprite("star"), true, 0)','shift(sprite("star"), 10001, 0)','touching(sprite("star"), "star")','hide()','show(1)','color(sprite("star"), "bad")','repeat 65\na = sprite("star")\nend']){
  result=await run(code);assert.equal(result.at(-1).type,'error',code);assert(result.at(-1).payload.line>0,code);
 }
 result=await run('a = sprite("star")');completed(result);assert.equal(result.find(e=>e.type==='draw').payload.args[0],1,'IDs and capacity reset each run');
 const lesson=lessons.find(l=>l.id==='sprites');result=await run(lesson.code,['right','right','right','right']);completed(result);
 const runInfo={keys:['right'],output:outputs(result),draw:result.filter(e=>e.type==='draw').map(e=>e.payload)};assert(lesson.check(runInfo));
 result=await run(lesson.code,Array(20).fill('space'));completed(result);assert(outputs(result).includes('Try again. Guide your turtle to the star.'));assert(!result.some(e=>e.type==='draw'&&e.payload.name==='sprite_state'&&!e.payload.args[5]));
 result=await run(examples.find(e=>e.name==='Collect the star').code,['up','up','right','right','right','right']);completed(result);assert(outputs(result).includes('You found the star!'));
 console.log('Sprites: C++ handles, collision boundaries, visibility, aliasing, colors, clamping, limits, resets, and game win/loss paths passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
