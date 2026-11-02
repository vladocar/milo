const {test}=require('node:test');const assert=require('node:assert/strict'),fs=require('node:fs');
const ready=import('data:text/javascript;base64,'+fs.readFileSync('dist/drawing.js').toString('base64'));
test('go_to uses centered coordinates without drawing or changing direction',async()=>{const {createScene,applyCommand}=await ready,s=createScene();applyCommand(s,{name:'go_to',args:[-100,50]});assert.equal(s.x,150);assert.equal(s.y,200);assert.equal(s.angle,-90);assert.equal(s.shapes.length,0);});
test('dot uses diameter and pen color',async()=>{const {createScene,applyCommand}=await ready,s=createScene();applyCommand(s,{name:'color',args:['purple']});applyCommand(s,{name:'dot',args:[80]});assert.equal(s.shapes[0].radius,40);assert.equal(s.shapes[0].color,'purple');assert.equal(s.x,250);});
test('fills are captured per shape; no_fill restores outlines',async()=>{const {createScene,applyCommand}=await ready,s=createScene();applyCommand(s,{name:'fill',args:['gold']});applyCommand(s,{name:'circle',args:[30]});applyCommand(s,{name:'rectangle',args:[80,40]});applyCommand(s,{name:'no_fill',args:[]});applyCommand(s,{name:'circle',args:[40]});assert.equal(s.shapes[0].fill,'gold');assert.equal(s.shapes[1].fill,'gold');assert.equal(s.shapes[2].fill,null);});
test('polygon vertices honor radius and turtle heading',async()=>{const {createScene,applyCommand}=await ready,s=createScene();applyCommand(s,{name:'polygon',args:[4,50]});const p=s.shapes[0].points;assert.equal(p.length,4);assert.equal(p[0].x,250);assert.equal(p[0].y,200);assert.equal(p[1].x,300);assert.equal(p[1].y,250);});
test('previous move and pen controls preserve their behavior',async()=>{const {createScene,applyCommand}=await ready,s=createScene();applyCommand(s,{name:'move',args:[100]});assert.equal(s.shapes.length,1);applyCommand(s,{name:'pen_up',args:[]});applyCommand(s,{name:'go_to',args:[0,0]});applyCommand(s,{name:'move',args:[20]});assert.equal(s.shapes.length,1);assert.equal(s.y,230);});
test('renderer fills shapes but keeps lines unfilled',async()=>{const {createScene,applyCommand,renderScene}=await ready,s=createScene();for(const command of [{name:'fill',args:['gold']},{name:'move',args:[20]},{name:'rectangle',args:[30,40]},{name:'polygon',args:[3,50]},{name:'dot',args:[20]}])applyCommand(s,command);const calls=[];const ctx=new Proxy({},{get:(t,key)=>key in t?t[key]:(...args)=>calls.push([key,...args]),set:(t,key,value)=>(t[key]=value,true)});renderScene(ctx,s);assert.equal(calls.filter(c=>c[0]==='fill').length,3);assert.equal(calls.filter(c=>c[0]==='stroke').length,3);});
test('sprite updates keep identity, drawings, pen, and other sprites intact',async()=>{
 const {createScene,applyCommand}=await ready,s=createScene();
 applyCommand(s,{name:'move',args:[30]});
 for(const args of [[1,'turtle','teal',0,0,true],[2,'star','gold',100,60,true],[1,'turtle','purple',-40,20,false]])applyCommand(s,{name:'sprite_state',args});
 assert.equal(s.sprites.length,2);assert.deepEqual(s.sprites[0],{id:1,shape:'turtle',color:'purple',x:210,y:230,visible:false});assert.equal(s.sprites[1].x,350);assert.equal(s.shapes.length,1);assert.equal(s.y,220);
 applyCommand(s,{name:'clear',args:[]});assert.equal(s.shapes.length,0);assert.equal(s.sprites.length,2);assert.equal(createScene().sprites.length,0);
});
test('shared renderer paints visible sprites above drawings and skips hidden sprites',async()=>{
 const {createScene,applyCommand,renderScene}=await ready,s=createScene();applyCommand(s,{name:'dot',args:[20]});
 for(const args of [[1,'star','gold',100,60,true],[2,'circle','pink',0,0,false]])applyCommand(s,{name:'sprite_state',args});
 const calls=[],ctx=new Proxy({},{get:(t,key)=>key in t?t[key]:(...args)=>calls.push([key,...args]),set:(t,key,value)=>(t[key]=value,true)});renderScene(ctx,s,{scale:.4});
 assert.deepEqual(calls[0],['setTransform',.4,0,0,.4,0,0]);assert.deepEqual(calls.filter(c=>c[0]==='translate'),[['translate',350,190]]);assert.equal(calls.filter(c=>c[0]==='fill').length,2);assert(calls.findIndex(c=>c[0]==='arc')<calls.findIndex(c=>c[0]==='translate'));
});
