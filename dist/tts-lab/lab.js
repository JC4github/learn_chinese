import {createMatchaProducer,workerConfigFromAssets,sentenceSpans} from './vendor/matcha-producer.mjs';
import {encodeWav,validateText} from './audio-utils.js';
const $=id=>document.getElementById(id),article=$('sample-text').value;
const samples={article,tones:'妈，麻，马，骂。',pairs:'买，卖。四，十。',conversation:'你好！你今天有空吗？我们一起去喝茶吧。谢谢，我下午三点以后有空。那我们三点半在地铁站见。',polyphones:'我走进银行，问工作人员怎么开账户。小朋友慢慢长大了。我们计划去重庆旅行。'};
const overrides={'妈':'ma1','麻':'ma2','马':'ma3','骂':'ma4','买':'mai3','卖':'mai4','四':'si4','十':'shi2','银行':'yin2 hang2','长大':'zhang3 da4','重庆':'chong2 qing4'};
const playback=$('generated-audio'),reference=$('reference-audio');
let producer,config,ready=false,busy=false,epoch=0,url=null,disposed=false;
const cacheName='hanzi-tts-trial-voice-v1', outputCache='hanzi-tts-trial-output-v1';
function status(text){$('setup-status').textContent=text;}
function controls(){ $('generate').disabled=!ready||busy; $('prepare').disabled=busy||ready; $('cancel-generation').hidden=!busy||!ready; $('cancel-setup').hidden=!busy||ready; $('sample-text').disabled=busy;for(const button of document.querySelectorAll('[data-sample]'))button.disabled=busy; }
function makeProducer(){return createMatchaProducer({workerUrl:new URL('./worker.js',import.meta.url).href,config,format:'pcm',allowUnknown:false,onEvent:event=>{
  if(event.type==='download-progress'){
    const percentage=event.total?Math.min(100,event.loaded/event.total*100):0;
    $('download-progress').hidden=false;$('download-progress').value=percentage;
    status(`Downloading voice · ${Math.round(percentage)}% (${(event.loaded/1e6).toFixed(1)} MB)`);
  }
}});}
async function boot(){
  try{
    const response=await fetch('./vendor/matcha-assets.json');if(!response.ok)throw Error('The trial files could not load. Please reload online.');
    const assets=await response.json();
    config=workerConfigFromAssets({assets,engineBaseUrl:new URL('./vendor/',import.meta.url).href,assetBaseUrl:new URL('./assets/',import.meta.url).href,runtimeBaseUrl:new URL('./runtime/',import.meta.url).href,cacheName,pronunciationOverrides:overrides,ort:{numThreads:1},defaultNoiseScale:0.667});
    // These profile bytes are pinned in this trial; offline startup need not probe the network.
    config.assets.profile.networkFirst=false;
    producer=makeProducer();let timer;
    const pack=await Promise.race([producer.status(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The speech worker could not start. Reload online and try again.')),20000);})]).finally(()=>clearTimeout(timer));
    $('pack-size').textContent=Math.ceil((pack.cachedBytes+pack.missingBytes)/1e6);
    $('prepare').textContent=pack.complete?'Load downloaded voice':`Download voice pack · ${Math.ceil(pack.missingBytes/1e6)} MB`;
    status(pack.complete?'Voice pack saved on this device. Load it to begin.':'The voice downloads only when you tap the button.');
    controls();
  }catch(error){showSetupError(error);}
}
function showSetupError(error){document.body.dataset.error='true';status(error.message);$('prepare').textContent='Retry voice setup';busy=false;controls();}
$('prepare').addEventListener('click',async()=>{
  if(!config){location.reload();return;}const current=++epoch;busy=true;document.body.dataset.error='false';controls();
  try{
    // A failed or cancelled producer is replaced; cached complete files remain reusable.
    if(disposed){producer=makeProducer();disposed=false;}
    await producer.download();if(epoch!==current)return;
    $('download-progress').hidden=true;status('Loading the voice on this device…');
    await producer.initialize();if(epoch!==current)return;
    ready=true;busy=false;$('prepare').textContent='Voice ready';status('Ready. New speech can now be generated offline.');$('generation-status').textContent='Generate the article or choose a short sample.';controls();
  }catch(error){if(epoch!==current)return;producer.dispose();disposed=true;showSetupError(error);}
});
function cancelSetup(){epoch++;producer?.dispose();disposed=true;busy=false;ready=false;$('download-progress').hidden=true;$('prepare').textContent='Resume voice setup';status('Cancelled. Complete downloaded files are kept for the next attempt.');controls();}
$('cancel-setup').addEventListener('click',cancelSetup);
for(const button of document.querySelectorAll('[data-sample]'))button.addEventListener('click',()=>{ $('sample-text').value=samples[button.dataset.sample]; });
function setResult(bytes,metrics){
  playback.pause();reference.pause();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));playback.src=url;$('download-audio').href=url;$('metrics').textContent=metrics;$('result').hidden=false;
}
$('generate').addEventListener('click',async()=>{
  let text;try{text=validateText($('sample-text').value);}catch(error){$('generation-status').textContent=error.message;return;}
  const current=++epoch;busy=true;controls();playback.pause();reference.pause();$('result').hidden=true;
  const started=performance.now();
  try{
    const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
    const request=new URL(`./generated/v1-${key}.wav`,import.meta.url).href;
    const cache=await caches.open(outputCache),cached=await cache.match(request);
    if(current!==epoch)return;
    if(cached){const bytes=await cached.arrayBuffer();if(current!==epoch)return;setResult(bytes,'Reused audio saved on this device.');$('generation-status').textContent='Saved audio ready. Press play below.';return;}
    const spans=sentenceSpans(text,{maxLength:72}),parts=[];let seconds=0,sampleRate=16000;
    for(let index=0;index<spans.length;index++){
      $('generation-status').textContent=`Generating sentence ${index+1} of ${spans.length} on this device…`;
      const result=await producer.synthesize(spans[index].text);
      if(current!==epoch)return;
      if(result.empty)throw Error('This text has no supported sounds. Try a Chinese sentence.');
      parts.push(new Float32Array(result.buffer));seconds+=result.meta.audioSeconds;sampleRate=result.meta.sampleRate;
    }
    const wav=encodeWav(parts,sampleRate);let saved=true;
    try{await cache.put(request,new Response(wav,{headers:{'Content-Type':'audio/wav'}}));}catch{saved=false;}
    if(current!==epoch)return;
    setResult(wav,`${((performance.now()-started)/1000).toFixed(1)} seconds to generate · ${seconds.toFixed(1)} seconds of audio · on this device`);
    $('generation-status').textContent=saved?'Audio ready. Press play below.':'Audio ready. Press play below. Storage is full, so this result could not be saved for reuse.';
  }catch(error){if(current===epoch)$('generation-status').textContent=`Could not generate audio: ${error.message}`;}
  finally{if(current===epoch){busy=false;controls();}}
});
$('cancel-generation').addEventListener('click',()=>{
  epoch++;producer.dispose();disposed=true;ready=false;busy=false;$('prepare').textContent='Reload downloaded voice';status('Voice unloaded to stop generation. Your downloaded pack is kept.');$('generation-status').textContent='Generation cancelled. Load the voice to try again.';controls();
});
playback.addEventListener('play',()=>reference.pause());reference.addEventListener('play',()=>playback.pause());
function textChanged(){playback.pause();$('result').hidden=true;}
$('sample-text').addEventListener('input',textChanged);
for(const button of document.querySelectorAll('[data-sample]'))button.addEventListener('click',textChanged);
fetch('../audio/manifest.json').then(r=>r.json()).then(manifest=>{
  for(const button of document.querySelectorAll('[data-human]')){
    const clip=manifest.clips[button.dataset.human];button.disabled=!clip;
    if(clip)button.addEventListener('click',()=>{reference.src=new URL('../'+clip.src,import.meta.url).href;reference.play().catch(()=>{$('reference-status').textContent='Tap play on the reference player to listen.';});});
  }
}).catch(()=>{$('reference-status').textContent='Human references could not load. Open the app online once.';});
document.addEventListener('visibilitychange',()=>{if(document.hidden){playback.pause();reference.pause();}});
window.addEventListener('pagehide',()=>{epoch++;producer?.dispose();disposed=true;ready=false;busy=false;if(url)URL.revokeObjectURL(url);url=null;});
window.addEventListener('pageshow',event=>{if(event.persisted){$('result').hidden=true;$('prepare').textContent='Load downloaded voice';status('Load the saved voice to continue.');controls();}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{status('Offline page storage is unavailable. You can still try speech while online.');});
boot();
