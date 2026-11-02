const assert=require('node:assert/strict'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const createMilo=require('../dist/engine/milo-engine.js');
let scene,firstInputScene,events=[],current,randomState;
global.self=global;
let applyCommand;
self.MiloHost={emit(type,payload){events.push({type,payload});if(type==='draw')applyCommand(scene,payload);},random(){randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;},async trace(){},async wait(){},async ask(prompt){if(current.id==='math-challenge'){const q=events.filter(e=>e.type==='output').at(-1).payload;const nums=q.match(/\d+/g);return String(Number(nums[0])+Number(nums[1]));}if(current.id==='forest-story')return String(prompt).includes('river')?'river':String(prompt).includes('sail')?'sail':'Alex';return current.id==='tiny-quiz'?'cat':'Alex';},async key(){firstInputScene??=structuredClone(scene);const p=scene.sprites[0],s=scene.sprites[1];if(!p||!s)return 'space';const dx=s.x-p.x,dy=p.y-s.y;if(Math.hypot(dx,dy)<=40)return 'space';return Math.abs(dx)>=Math.abs(dy)?dx>0?'right':'left':dy>0?'up':'down';}};
(async()=>{
 const {starterProjects,createStarterCopy}=await import(pathToFileURL(process.cwd()+'/dist/starter-projects.js'));
 const {createScene,applyCommand:apply}=await import(pathToFileURL(process.cwd()+'/dist/drawing.js'));applyCommand=apply;
 const {ProjectStore}=await import(pathToFileURL(process.cwd()+'/dist/project-store.js'));
 assert.equal(starterProjects.length,24);assert.equal(new Set(starterProjects.map(p=>p.id)).size,24);
 const storage={value:null,getItem(){return this.value;},setItem(key,value){this.value=value;}};
 const store=new ProjectStore(storage),old=store.save({name:'Robot friend',code:'say "My work"\n'}),starter=starterProjects.find(p=>p.id==='robot');
 const copy=createStarterCopy(store,starter),copy2=createStarterCopy(store,starter);
 assert.equal(store.get(old.id).code,'say "My work"\n');assert.equal(copy.name,'Robot friend (2)');assert.equal(copy2.name,'Robot friend (3)');assert.notEqual(copy.id,copy2.id);assert.equal(copy.code,starter.code);assert.equal(copy.thumbnail,starter.thumbnail);
 if(process.argv[2]!=='--previews')for(const p of starterProjects){assert(p.thumbnail?.startsWith('data:image/png;base64,'),p.id);assert(p.thumbnail.length<=180000,p.id);}
 const failing=new ProjectStore({getItem(){return null;},setItem(){throw Error('quota');}});assert.throws(()=>createStarterCopy(failing,starter),/storage/);
 const engine=await createMilo({wasmBinary:fs.readFileSync('dist/engine/milo-engine.wasm')});const previews=[];
 for(const project of starterProjects){current=project;events=[];scene=createScene();firstInputScene=null;randomState=12345;
   await engine.ccall('milo_run',null,['string'],[project.code],{async:true});assert.equal(events.at(-1).type,'complete',project.id+': '+JSON.stringify(events.at(-1)));
   if(project.id==='math-challenge')assert(events.some(e=>e.type==='output'&&e.payload==='You got 5 out of 5.'),'math win');
   if(project.id==='forest-story')assert(events.some(e=>e.type==='output'&&e.payload.includes('singing flowers')),'story branch');
   previews.push({id:project.id,name:project.name,category:project.category,scene:firstInputScene||scene,output:events.filter(e=>e.type==='output').map(e=>e.payload),notes:events.filter(e=>e.type==='note').map(e=>e.payload.note)});
   console.log('Starter '+project.name+': passed');
 }
 if(process.argv[2]==='--previews'){assert(process.argv[3]);fs.writeFileSync(process.argv[3],JSON.stringify(previews));}
 console.log('Twenty-four starter programs and separate-copy/name-collision/storage checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
