/* Shared by the classic worker and its deterministic timing tests. */
(function(root){
  class MiloInput {
    constructor({notify,now=()=>performance.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}){
      Object.assign(this,{notify,now,schedule,cancel});this.pending=null;this.paused=false;this.serial=0;
    }
    report(){this.notify(this.pending?{id:this.pending.id,kind:this.pending.kind,seconds:this.pending.seconds,paused:this.paused}:null);}
    start(kind,seconds){
      if(this.pending)throw new Error('Another input is already waiting.');
      return new Promise(resolve=>{
        this.pending={id:++this.serial,kind,seconds,remaining:seconds*1000,resolve,timer:null};
        this.report();if(kind==='wait'&&!this.paused)this.arm();
      });
    }
    wait(seconds){return this.start('wait',seconds);}
    key(){return this.start('key',0);}
    arm(){const p=this.pending;p.started=this.now();p.timer=this.schedule(()=>this.finish(),p.remaining);}
    finish(value){const p=this.pending;if(!p||this.paused)return;p.resolve(value);this.pending=null;this.report();}
    accept(key){if(this.pending?.kind!=='key'||this.paused||!['up','down','left','right','space'].includes(key))return false;this.finish(key);return true;}
    pause(){
      if(this.paused)return;this.paused=true;
      const p=this.pending;if(p?.kind==='wait'){this.cancel(p.timer);p.remaining=Math.max(0,p.remaining-(this.now()-p.started));}
      if(p)this.report();
    }
    resume(){if(!this.paused)return;this.paused=false;if(this.pending){this.report();if(this.pending.kind==='wait')this.arm();}}
  }
  root.MiloInput=MiloInput;
  if(typeof module!=='undefined')module.exports=MiloInput;
})(typeof self!=='undefined'?self:globalThis);
