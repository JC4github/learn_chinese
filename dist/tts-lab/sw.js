const CACHE='hanzi-tts-lab-shell-v3';
const SHELL=['./','./index.html','./lab.css?v=2','./lab.js?v=2','./audio-utils.js','./worker.js','./asset-chunks.js','./credits.html',
  './vendor/matcha-producer.mjs','./vendor/matcha-worker.js','./vendor/matcha-engine.js','./vendor/matcha-frontend.js','./vendor/matcha-taiwan-profile.js','./vendor/kaldifst-normalizer.js','./vendor/matcha-synthesis.js','./vendor/matcha-kaldifst-normalizer.js','./vendor/matcha-kaldifst-normalizer.wasm','./vendor/matcha-profile.runtime.json','./vendor/matcha-assets.json',
  './runtime/ort-1.27.0-wasm.min.js','./runtime/ort-1.27.0-wasm-simd-threaded.mjs','./runtime/lamejs-1.2.1.min.js','../audio/manifest.json',
  '../audio/human/7b2b070d297c3f4987cceec8.mp3','../audio/human/997053b4781a80a67e0f382e.mp3','../audio/human/6e20b152f47b0c1ff8b36032.mp3','../audio/human/7f537d357c63dd46740dbfb0.mp3'];
const shellUrls=new Set(SHELL.map(path=>new URL(path,self.location.href).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hanzi-tts-lab-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.open(CACHE).then(cache=>cache.match('./index.html'))));return;
  }
  if(shellUrls.has(url.href))event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).then(async cached=>{
    if(!cached)return fetch(request);
    const range=request.headers.get('Range');
    return range&&url.pathname.includes('/audio/human/')?referenceRange(range,cached):cached;
  }));
  // Voice models are downloaded and cached by the engine only after the user's tap.
});
async function referenceRange(range,response){
  const bytes=await response.arrayBuffer(),match=/^bytes=(\d*)-(\d*)$/.exec(range);
  const invalid=()=>new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.byteLength}`}});
  if(!match||(!match[1]&&!match[2]))return invalid();
  const start=match[1]?Number(match[1]):Math.max(0,bytes.byteLength-Number(match[2]));
  const end=match[1]&&match[2]?Math.min(Number(match[2]),bytes.byteLength-1):bytes.byteLength-1;
  if(start>end||start>=bytes.byteLength)return invalid();
  return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Range':`bytes ${start}-${end}/${bytes.byteLength}`,'Accept-Ranges':'bytes','Content-Length':String(end-start+1)}});
}
