const test=require('node:test'),assert=require('node:assert/strict');
const MiloInput=require('../dist/input-runtime.js');
function fixture(){
 let time=0,id=0;const jobs=new Map(),events=[];
 const input=new MiloInput({notify:event=>events.push(event),now:()=>time,schedule:(fn,ms)=>{jobs.set(++id,{at:time+ms,fn});return id;},cancel:id=>jobs.delete(id)});
 return {input,events,jobs,advance(ms){time+=ms;for(const [id,job] of jobs)if(job.at<=time){jobs.delete(id);job.fn();}}};
}
test('wait resolves only after its deadline, including fractional seconds',async()=>{
 const f=fixture();let done=false;const p=f.input.wait(.25).then(()=>done=true);
 assert.equal(f.events[0].kind,'wait');f.advance(249);await Promise.resolve();assert.equal(done,false);f.advance(1);await p;assert.equal(done,true);assert.equal(f.events.at(-1),null);
});
test('pause freezes remaining time and resume completes that remainder',async()=>{
 const f=fixture();let done=false;const p=f.input.wait(1).then(()=>done=true);
 f.advance(400);f.input.pause();f.advance(5000);await Promise.resolve();assert.equal(done,false);assert.equal(f.jobs.size,0);
 f.input.resume();f.advance(599);await Promise.resolve();assert.equal(done,false);f.advance(1);await p;assert(done);
});
test('zero wait still schedules an asynchronous yield',async()=>{
 const f=fixture();let done=false;const p=f.input.wait(0).then(()=>done=true);await Promise.resolve();assert.equal(done,false);f.advance(0);await p;assert(done);
});
test('key input accepts one supported answer and discards extra or early presses',async()=>{
 const f=fixture();assert.equal(f.input.accept('up'),false);const first=f.input.key();assert.equal(f.input.accept('a'),false);assert.equal(f.input.accept('left'),true);assert.equal(f.input.accept('right'),false);assert.equal(await first,'left');
 let done=false;const second=f.input.key().then(key=>{done=true;return key;});await Promise.resolve();assert.equal(done,false);f.input.accept('space');assert.equal(await second,'space');
});
test('paused keyboard input stays pending until resumed and a new answer arrives',async()=>{
 const f=fixture();const p=f.input.key();f.input.pause();assert.equal(f.events.at(-1).paused,true);assert.equal(f.input.accept('right'),false);f.input.resume();assert.equal(f.events.at(-1).paused,false);f.input.accept('down');assert.equal(await p,'down');
});
test('default timers retain the browser global receiver',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const context=vm.createContext({});
 vm.runInContext(`var callback; var performance={now:()=>0}; function setTimeout(fn){if(this!==globalThis)throw Error('Illegal invocation');callback=fn;return 1;} function clearTimeout(){if(this!==globalThis)throw Error('Illegal invocation');} `+fs.readFileSync('dist/input-runtime.js','utf8')+`;var input=new MiloInput({notify:()=>{}});var done=input.wait(.1);input.pause();input.resume();callback();`,context);
 await context.done;
});
