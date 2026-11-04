import {MandarinPlayer,pronunciationKey} from './speech.js?v=human-2';
import {ReadingVoice} from './reading-voice.js?v=reading-2';
export {pronunciationKey};
const IDLE='Tap a speaker to hear Mandarin with the reading voice.';
const SILENCE='data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQgAAAAAAAAAAAAAAA==';
export class ReadingPlayer {
  constructor({Howl,onChange,voice=new ReadingVoice(),unlock=null,createUrl=bytes=>URL.createObjectURL(new Blob([bytes],{type:'audio/wav'})),revokeUrl=url=>URL.revokeObjectURL(url)}){
    Object.assign(this,{Howl,onChange,voice,createUrl,revokeUrl});this.current=null;
    this.human=new MandarinPlayer({Howl,onChange:value=>{if(this.current?.source==='human'){this.onChange({...value,source:'human'});if(value.text&&['idle','error','unavailable'].includes(value.status))this.current=null;}}});
    this.unlock=unlock??(()=>{
      if(!this.Howl)return;
      // Open/resume the shared mobile audio context inside the original tap.
      const sound=new this.Howl({src:[SILENCE],format:['wav'],volume:0,onend:()=>sound.unload(),onloaderror:()=>sound.unload()});sound.play();
    });
  }
  setClips(clips){this.human.setClips(clips);}
  hasRecording(text,pinyin){return this.human.hasRecording(text,pinyin);}
  getClip(text,pinyin){return this.human.getClip(text,pinyin);}
  canPlay(text,pinyin,source='tts'){return source==='human'?this.hasRecording(text,pinyin):Boolean(String(text).trim());}
  stop(){
    const previous=this.current;this.current=null;
    previous?.controller?.abort();clearTimeout(previous?.timer);previous?.sound?.stop();previous?.sound?.unload();if(previous?.url)this.revokeUrl(previous.url);
    this.human.stop();this.onChange({status:'idle',text:'',key:'',message:IDLE});
  }
  progress(request,event){
    if(this.current!==request)return;
    const message=event.stage==='downloading'?`Downloading reading voice · ${event.percent??0}%`:event.stage==='loading'?'Loading the reading voice…':`Preparing audio · sentence ${event.sentence} of ${event.total}…`;
    this.onChange({status:'loading',text:request.text,key:request.key,source:'tts',kind:request.kind,message});
  }
  async prepareVoice(){
    if(this.current?.kind==='setup'){this.stop();return;}
    this.stop();const request={text:'',key:'voice-setup',kind:'setup',controller:new AbortController()};this.current=request;
    this.progress(request,{stage:'loading'});
    try{
      await this.voice.prepare({download:true,signal:request.controller.signal,onProgress:event=>this.progress(request,event)});
      if(this.current!==request)return;this.current=null;this.onChange({status:'idle',key:'',text:'',message:'Reading voice ready. Tap a speaker to listen.'});
    }catch(error){this.fail(request,error);}
  }
  fail(request,error){
    if(this.current!==request||error.name==='AbortError')return;
    this.current=null;clearTimeout(request.timer);request.sound?.unload();if(request.url)this.revokeUrl(request.url);
    this.onChange({status:'error',key:request.key,text:request.text,source:request.source,kind:request.kind,needsDownload:error.name==='VoiceDownloadRequired',message:error.message});
  }
  async play(text,pinyin='',{source='tts',kind='word'}={}){
    const key=pronunciationKey(text,pinyin);
    if(this.current?.key===key&&this.current.source===source){this.stop();return;}
    this.stop();const request={text,key,source,kind,controller:new AbortController(),sound:null};this.current=request;
    if(source==='human'){this.human.play(text,pinyin);return;}
    this.unlock();this.progress(request,{stage:'loading'});
    try{
      const result=await this.voice.generate(text,pinyin,{signal:request.controller.signal,onProgress:event=>this.progress(request,event)});
      if(this.current!==request)return;
      if(!this.Howl)throw Error('The audio player could not load. Reload the app and try again.');
      request.url=this.createUrl(result.buffer);
      const finish=()=>{
        if(this.current!==request)return;
        clearTimeout(request.timer);this.current=null;request.sound?.unload();this.revokeUrl(request.url);
        this.onChange({status:'idle',text,key,source,kind,message:'Audio finished. Tap to replay.'});
      };
      request.timer=setTimeout(()=>this.fail(request,Error('Audio took too long to start. Tap again to retry.')),15000);
      request.sound=new this.Howl({src:[request.url],format:['wav'],volume:1,
        onplay:()=>{if(this.current!==request)return;clearTimeout(request.timer);this.onChange({status:'playing',text,key,source,kind,message:result.cached?'Playing saved audio… Tap again to stop.':'Playing Mandarin… Tap again to stop.'});},
        onend:finish,onloaderror:()=>this.fail(request,Error('The audio could not load. Tap again to retry.')),
        onplayerror:()=>this.fail(request,Error('Playback was blocked. Tap the speaker again and check your device volume.'))});
      if(this.current===request)request.sound.play();else request.sound.unload();
    }catch(error){this.fail(request,error);}
  }
}
