export class MiloSound {
  constructor({enabled=true,createContext=()=>new (window.AudioContext||window.webkitAudioContext)(),onStatus=()=>{}}={}){
    Object.assign(this,{enabled,createContext,onStatus});this.context=null;this.voices=new Set();
  }
  async unlock(){
    if(!this.enabled)return false;
    try{
      this.context??=this.createContext();
      if(this.context.state==='suspended')await this.context.resume();
      const ready=this.context.state==='running';this.onStatus(ready?'ready':'blocked');return ready;
    }catch{this.onStatus('unavailable');return false;}
  }
  setEnabled(enabled){this.enabled=enabled;if(!enabled)this.silence();}
  play(note,seconds){
    if(!this.enabled)return false;
    if(!this.context||this.context.state!=='running'){this.onStatus('blocked');return false;}
    this.silence();
    try{
      const ctx=this.context,oscillator=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
      oscillator.type='sine';oscillator.frequency.setValueAtTime(440*2**((note-69)/12),now);
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.08,now+.01);
      gain.gain.linearRampToValueAtTime(0,now+seconds);
      oscillator.connect(gain);gain.connect(ctx.destination);
      const voice={oscillator,gain};this.voices.add(voice);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(voice);};
      oscillator.start(now);oscillator.stop(now+seconds);this.onStatus('ready');return true;
    }catch{this.silence();this.onStatus('unavailable');return false;}
  }
  silence(){
    for(const {oscillator,gain} of this.voices){try{oscillator.stop();}catch{}oscillator.disconnect();gain.disconnect();}
    this.voices.clear();
  }
}
