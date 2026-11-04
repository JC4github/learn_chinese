// Keep the released engine unchanged; adapt split static assets into its fetch API.
importScripts('./asset-chunks.js');
const originalFetch = self.fetch.bind(self);
const files = new Map(Object.entries(self.HANZI_TTS_CHUNKS).map(([path,entry])=>[new URL(path,self.location.href).href,entry]));
self.fetch = async function(input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url,self.location.href).href;
  const entry = files.get(url);
  if (!entry) return originalFetch(input,options);
  let index=0;
  const body=new ReadableStream({
    async pull(controller) {
      if(index===entry.parts.length){controller.close();return;}
      try {
        const part=entry.parts[index++],response=await originalFetch(new URL(part.url,self.location.href),options);
        if(!response.ok)throw Error(`Voice download failed (${response.status}). Try again online.`);
        const bytes=await response.arrayBuffer();
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
        if(bytes.byteLength!==part.bytes || digest!==part.sha256)throw Error('Voice file check failed. Please retry the download.');
        controller.enqueue(new Uint8Array(bytes));
      }catch(error){controller.error(error);}
    }
  });
  return new Response(body,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(entry.bytes)}});
};
importScripts('./vendor/matcha-worker.js');
