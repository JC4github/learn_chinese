// The default voice worker lives at the app root, outside the lab's SW scope.
const readingBase=new URL('./tts-lab/',self.location.href);
importScripts(new URL('asset-chunks.js',readingBase).href);
const originalFetch=self.fetch.bind(self);
const files=new Map(Object.entries(self.HANZI_TTS_CHUNKS).map(([path,entry])=>[new URL(path,readingBase).href,entry]));
self.fetch=async function(input,options){
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,self.location.href).href,entry=files.get(url);
  if(!entry)return originalFetch(input,options);
  let index=0;
  const body=new ReadableStream({async pull(controller){
    if(index===entry.parts.length){controller.close();return;}
    try{
      const part=entry.parts[index++],response=await originalFetch(new URL(part.url,readingBase),options);
      if(!response.ok)throw Error(`Voice download failed (${response.status}). Try again online.`);
      const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
      if(bytes.byteLength!==part.bytes||hash!==part.sha256)throw Error('Voice file check failed. Please retry the download.');
      controller.enqueue(new Uint8Array(bytes));
    }catch(error){controller.error(error);}
  }});
  return new Response(body,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(entry.bytes)}});
};
let readingQueue=Promise.resolve(),readingTokens=null;
self.addEventListener('message',event=>{
  if(event.data?.type!=='reading-synthesize')return;
  event.stopImmediatePropagation();const message=event.data;
  readingQueue=readingQueue.then(async()=>{
    await initialize();let result;
    if(message.phones){
      if(!readingTokens){
        const cached=await (await caches.open(config.cacheName)).match(config.assets.tokens.url);
        if(!cached)throw Error('Pronunciation dictionary is unavailable. Prepare the voice again.');
        readingTokens=MatchaFrontend.parseTokens(await cached.text());
      }
      if(!Array.isArray(message.phones)||message.phones.length!==[...message.text].length||message.phones.some(phone=>!readingTokens.has(phone)))throw Error('Unsupported pronunciation.');
      const ids=message.phones.map(phone=>readingTokens.get(phone));
      result={...await engine.synthesizeIds(ids,{noiseScale:0.667}),tokenized:{phones:message.phones,unknown:[]}};
    }else result=await engine.synthesize(message.text,{allowUnknown:false,noiseScale:0.667});
    if(result.empty)throw Error('This text has no supported sounds.');
    postMessage({type:'result',requestId:message.requestId,buffer:result.samples.buffer,meta:{sampleRate:result.sampleRate,audioSeconds:result.audioSeconds,phones:result.tokenized.phones}},[result.samples.buffer]);
  }).catch(error=>postMessage({type:'error',action:'reading-synthesize',requestId:message.requestId,message:error.message}));
});
importScripts(new URL('vendor/matcha-worker.js',readingBase).href);
