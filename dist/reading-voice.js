import {workerConfigFromAssets,sentenceSpans} from './tts-lab/vendor/matcha-producer.mjs';
import {encodeWav} from './tts-lab/audio-utils.js';
import {numberedSyllable} from './pronunciation.js?v=reading-2';

export const VOICE_CACHE='hanzi-tts-trial-voice-v1'; // Reuse the approved trial download.
export const OUTPUT_CACHE='hanzi-reading-audio-v1';
const base=new URL('./tts-lab/',import.meta.url);
export const abortError=()=>new DOMException('Audio cancelled','AbortError');
export class VoiceDownloadRequired extends Error {constructor(){super('Download the reading voice once to listen offline.');this.name='VoiceDownloadRequired';}}

// Split joined or spaced marked pinyin only when one unambiguous, supported
// syllable sequence matches the Hanzi count. Never guess between two readings.
export function pinyinPhones(text,pinyin,tokens){
  if(!/^\p{Script=Han}+$/u.test(text)||!pinyin)return null;
  const input=pinyin.normalize('NFC').trim().toLowerCase().replace(/[’']/g,' '),count=[...text].length;
  if(!/^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]+$/u.test(input))return null;
  const memo=new Map();
  function split(offset,left){
    while(input[offset]===' ')offset++;
    if(!left)return offset===input.length?[[]]:[];
    const key=offset+':'+left;if(memo.has(key))return memo.get(key);
    const found=[];
    for(let end=offset+1;end<=Math.min(offset+7,input.length);end++){
      const piece=input.slice(offset,end);if(/\s/.test(piece))break;
      const marked=numberedSyllable(piece),plain=piece.replace(/ü/g,'v');
      const phone=marked??(/^[a-zv]+$/.test(plain)?plain+'5':null);
      if(!phone||!tokens.has(phone))continue;
      for(const tail of split(end,left-1)){found.push([phone,...tail]);if(found.length>1)break;}
      if(found.length>1)break;
    }
    memo.set(key,found);return found;
  }
  const possibilities=split(0,count);return possibilities.length===1?possibilities[0]:null;
}

export class VoiceWorkerClient {
  constructor(worker){
    this.worker=worker;this.pending=new Map();this.nextId=1;this.closed=false;this.progress=()=>{};
    worker.addEventListener('message',({data})=>{
      if(data.type==='download-progress'){this.progress(data);return;}
      const actions={configured:'configure',status:'status','download-complete':'download-assets',ready:'init'};
      const entry=data.requestId?this.pending.get(data.requestId):[...this.pending.values()].find(p=>p.type===actions[data.type]);
      if(!entry)return;
      if(data.type==='error')entry.reject(new Error(data.message));else entry.resolve(data);
    });
    worker.addEventListener('error',event=>this.dispose(new Error(event.message||'The reading voice could not start.')));
  }
  command(type,payload={},signal){
    if(this.closed||signal?.aborted)return Promise.reject(abortError());
    const requestId=this.nextId++;
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.pending.delete(requestId);};
      const cancel=()=>{cleanup();reject(abortError());};
      const timer=setTimeout(()=>{cleanup();reject(Error('The reading voice took too long. Please retry.'));},type==='download-assets'?300000:120000);
      this.pending.set(requestId,{type,resolve:data=>{cleanup();resolve(data);},reject:error=>{cleanup();reject(error);}});
      signal?.addEventListener('abort',cancel,{once:true});
      this.worker.postMessage({type,requestId,...payload});
    });
  }
  dispose(error=abortError()){
    if(this.closed)return;this.closed=true;
    for(const entry of [...this.pending.values()])entry.reject(error);
    this.worker.terminate();
  }
}

export class ReadingVoice {
  constructor({fetcher=(...args)=>fetch(...args),cacheStorage=globalThis.caches,workerFactory=url=>new Worker(url),digest=bytes=>crypto.subtle.digest('SHA-256',bytes)}={}){
    Object.assign(this,{fetcher,cacheStorage,workerFactory,digest});this.client=null;this.ready=false;this.preparing=false;this.tokens=new Set();
  }
  async start(signal){
    if(this.client&&!this.client.closed)return this.client;
    const response=await this.fetcher(new URL('vendor/matcha-assets.json',base),{signal});if(!response.ok)throw Error('Open the app online once to load the reading voice files.');
    const assets=await response.json();if(signal?.aborted)throw abortError();
    const client=new VoiceWorkerClient(this.workerFactory(new URL('./reading-worker.js?v=reading-2',import.meta.url).href));this.client=client;
    const config=workerConfigFromAssets({assets,engineBaseUrl:new URL('vendor/',base).href,assetBaseUrl:new URL('assets/',base).href,runtimeBaseUrl:new URL('runtime/',base).href,cacheName:VOICE_CACHE,ort:{numThreads:1},defaultNoiseScale:0.667,pronunciationOverrides:{'妈':'ma1','麻':'ma2','马':'ma3','骂':'ma4','买':'mai3','卖':'mai4','四':'si4','十':'shi2','银行':'yin2 hang2','长大':'zhang3 da4','重庆':'chong2 qing4'}});
    config.assets.profile.networkFirst=false;
    try{await client.command('configure',{config},signal);}catch(error){client.dispose();if(this.client===client)this.client=null;throw error;}
    this.config=config;return client;
  }
  async prepare({download=false,signal,onProgress=()=>{}}={}){
    if(this.ready)return;
    this.preparing=true;
    const cancel=()=>this.unload();signal?.addEventListener('abort',cancel,{once:true});
    let client;
    try{
      client=await this.start(signal);const status=await client.command('status',{},signal);
      if(!status.complete&&!download)throw new VoiceDownloadRequired();
      client.progress=event=>onProgress({stage:status.complete?'loading':'downloading',percent:Math.round(event.loaded/event.total*100)});
      onProgress({stage:status.complete?'loading':'downloading',percent:0});
      await client.command('download-assets',{},signal);
      onProgress({stage:'loading'});await client.command('init',{},signal);
      if(signal?.aborted||this.client!==client)throw abortError();
      const cache=await this.cacheStorage.open(VOICE_CACHE),tokens=await cache.match(this.config.assets.tokens.url);
      if(!tokens)throw Error('The pronunciation dictionary could not load.');
      this.tokens=new Set((await tokens.text()).trim().split(/\r?\n/).map(line=>line.split(/\s/)[0]));this.ready=true;
    }catch(error){if(!['VoiceDownloadRequired','AbortError'].includes(error.name)&&this.client===client)this.unload();throw error;}
    finally{this.preparing=false;signal?.removeEventListener('abort',cancel);}
  }
  unload(){this.client?.dispose();this.client=null;this.ready=false;}
  async generate(text,pinyin='',{signal,onProgress=()=>{}}={}){
    text=String(text).trim();if(!text)throw Error('There is no text to read.');
    const identity=JSON.stringify({voice:'matcha-steps6-v1',text,pinyin:pinyin.normalize('NFC').toLowerCase().replace(/\s+/g,'')});
    const hash=Array.from(new Uint8Array(await this.digest(new TextEncoder().encode(identity))),v=>v.toString(16).padStart(2,'0')).join('');
    const key=new URL(`./audio/generated/${hash}.wav`,import.meta.url).href;
    let cache=null,cached=null;
    try{cache=await this.cacheStorage.open(OUTPUT_CACHE);cached=await cache.match(key);}catch{}
    if(signal?.aborted)throw abortError();
    if(cached){const buffer=await cached.arrayBuffer();if(signal?.aborted)throw abortError();return {buffer,cached:true};}
    await this.prepare({signal,onProgress});
    const phones=pinyinPhones(text,pinyin,this.tokens),spans=phones?[{text}]:sentenceSpans(text,{maxLength:72}),parts=[];let sampleRate=16000;
    for(let i=0;i<spans.length;i++){
      if(signal?.aborted)throw abortError();onProgress({stage:'generating',sentence:i+1,total:spans.length});
      const result=await this.client.command('reading-synthesize',{text:spans[i].text,phones:phones??undefined},signal);
      if(signal?.aborted)throw abortError();parts.push(new Float32Array(result.buffer));sampleRate=result.meta.sampleRate;
    }
    const buffer=encodeWav(parts,sampleRate);
    try{await cache?.put(key,new Response(buffer,{headers:{'Content-Type':'audio/wav'}}));}catch{}
    if(signal?.aborted)throw abortError();return {buffer,cached:false};
  }
}
