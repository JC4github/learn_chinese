import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import vm from 'node:vm';
import {ReadingVoice,VoiceDownloadRequired,VoiceWorkerClient,pinyinPhones} from '../dist/reading-voice.js';
import {ReadingPlayer} from '../dist/reading-audio.js';
const tokens=new Set(readFileSync('dist/tts-lab/assets/matcha-tokens.txt','utf8').trim().split(/\r?\n/).map(line=>line.split(' ')[0]));
const assets=JSON.parse(readFileSync('dist/tts-lab/vendor/matcha-assets.json','utf8'));
test('marked, neutral and joined pinyin select the intended supported syllables',()=>{
  for(const [text,pinyin,phones] of [['行','xíng',['xing2']],['行','háng',['hang2']],['银行','yínháng',['yin2','hang2']],['谢谢','xièxie',['xie4','xie5']],['朋友','péngyou',['peng2','you5']],['绿','lǜ',['lv4']],['林安','Lín Ān',['lin2','an1']],['你好吗','nǐ hǎo ma',['ni3','hao3','ma5']]])assert.deepEqual(pinyinPhones(text,pinyin,tokens),phones,`${text} ${pinyin}`);
  assert.equal(pinyinPhones('JDM','JDM',tokens),null);assert.equal(pinyinPhones('马','unsupported',tokens),null);
});
function fixture({complete=true}={}){
  const commands=[],events={},writes=[],files=new Map();
  class Worker{
    constructor(){this.handlers={};}
    addEventListener(type,fn){this.handlers[type]=fn;}
    postMessage(message){commands.push(message);queueMicrotask(()=>{
      const types={configure:'configured',status:'status','download-assets':'download-complete',init:'ready','reading-synthesize':'result'};
      const data={type:types[message.type],...(message.type==='reading-synthesize'?{requestId:message.requestId,buffer:new Float32Array([.2,-.3]).buffer,meta:{sampleRate:16000,audioSeconds:.000125}}:message.type==='status'?{complete}:{} )};
      this.handlers.message({data});
    });}
    terminate(){this.terminated=true;}
  }
  const cacheStorage={open:async()=>({match:async key=>String(key).endsWith('matcha-tokens.txt')?new Response(readFileSync('dist/tts-lab/assets/matcha-tokens.txt')):files.get(String(key))?.clone(),put:async(key,response)=>{writes.push(key);files.set(String(key),response.clone());}})};
  const voice=new ReadingVoice({fetcher:async()=>new Response(JSON.stringify(assets)),cacheStorage,workerFactory:()=>new Worker(),digest:bytes=>webcrypto.subtle.digest('SHA-256',bytes)});
  return {voice,commands,writes,files,Worker};
}
test('a missing voice pack asks for setup without starting a large download',async()=>{
  const f=fixture({complete:false});await assert.rejects(()=>f.voice.generate('你好'),VoiceDownloadRequired);
  assert.ok(!f.commands.some(c=>c.type==='download-assets'));f.voice.unload();
});
test('explicit setup downloads once and words send their marked pinyin to synthesis',async()=>{
  const f=fixture({complete:false});await f.voice.prepare({download:true});await f.voice.generate('行','háng');
  assert.deepEqual(f.commands.find(c=>c.type==='reading-synthesize').phones,['hang2']);
  assert.equal(f.commands.filter(c=>c.type==='download-assets').length,1);f.voice.unload();
});
test('generated audio is reused across entries while different pronunciations stay distinct',async()=>{
  const f=fixture();const first=await f.voice.generate('行','xíng');assert.equal(first.cached,false);
  f.voice.unload();const count=f.commands.length;const second=await f.voice.generate('行','xíng');assert.equal(second.cached,true);assert.equal(f.commands.length,count);
  await f.voice.generate('行','háng');assert.equal(f.writes.length,2);assert.notEqual(f.writes[0],f.writes[1]);f.voice.unload();
});
test('long text is synthesized in bounded sentences without a trial character limit',async()=>{
  const f=fixture();await f.voice.generate('今天学习中文。'.repeat(100));
  const requests=f.commands.filter(c=>c.type==='reading-synthesize');assert.equal(requests.length,100);assert.ok(requests.every(c=>c.text.length<=72));f.voice.unload();
});
test('worker disposal rejects requests instead of leaving playback waiting forever',async()=>{
  const listeners={},worker={addEventListener:(type,fn)=>listeners[type]=fn,postMessage(){},terminate(){}};
  const client=new VoiceWorkerClient(worker),request=client.command('reading-synthesize',{text:'你好'});client.dispose();
  await assert.rejects(request,{name:'AbortError'});
});
function player(voice){
  const sounds=[],events=[],urls=[];
  class Howl{constructor(options){this.options=options;sounds.push(this);}play(){this.options.onplay?.();}stop(){this.stopped=true;}unload(){this.unloaded=true;}}
  const p=new ReadingPlayer({Howl,voice,unlock(){},onChange:event=>events.push(event),createUrl:()=>{urls.push('blob:test');return 'blob:test';},revokeUrl(){}});
  return {p,sounds,events,urls};
}
test('stopping pending generation prevents late playback and stale messages',async()=>{
  let finish;const f=player({generate:()=>new Promise(resolve=>finish=resolve)}),request=f.p.play('未来文章');
  f.p.stop();finish({buffer:new ArrayBuffer(44)});await request;assert.equal(f.sounds.length,0);assert.equal(f.events.at(-1).status,'idle');
});
test('default words play synthesized audio, finish and replay cleanly',async()=>{
  const f=player({generate:async()=>({buffer:new ArrayBuffer(44),cached:true})});await f.p.play('以前没有录音的词');
  assert.equal(f.events.at(-1).status,'playing');assert.match(f.events.at(-1).message,/saved audio/);
  f.sounds[0].options.onend();assert.equal(f.p.current,null);await f.p.play('以前没有录音的词');assert.equal(f.sounds.length,2);f.p.stop();
});
test('pinyin drill recordings bypass synthesis and replay after ending',async()=>{
  const f=player({generate:()=>{throw Error('Unexpected synthesis');}});f.p.setClips({'妈|mā':{type:'human',format:'mp3',src:'audio/human/0123456789abcdef01234567.mp3'}});
  await f.p.play('妈','mā',{source:'human'});f.sounds[0].options.onend();await f.p.play('妈','mā',{source:'human'});assert.equal(f.sounds.length,2);assert.equal(f.events.at(-1).source,'human');f.p.stop();
});
test('missing model and blocked playback provide actionable errors',async()=>{
  const f=player({generate:async()=>{throw new VoiceDownloadRequired();}});await f.p.play('你好');assert.equal(f.events.at(-1).needsDownload,true);assert.equal(f.sounds.length,0);
  f.p.voice={generate:async()=>({buffer:new ArrayBuffer(44)})};await f.p.play('你好');f.sounds[0].options.onplayerror();assert.match(f.events.at(-1).message,/blocked/);f.p.stop();
});
test('all 34 current entries are understood by the reading voice frontend',()=>{
  const context=vm.createContext({});for(const name of ['matcha-frontend.js','matcha-taiwan-profile.js'])vm.runInContext(readFileSync('dist/tts-lab/vendor/'+name,'utf8'),context);
  const profile=JSON.parse(readFileSync('dist/tts-lab/vendor/matcha-profile.runtime.json','utf8'));
  const frontend=context.MatchaFrontend.createFrontend({lexiconText:readFileSync('dist/tts-lab/assets/matcha-lexicon-480ff389.txt','utf8'),tokensText:readFileSync('dist/tts-lab/assets/matcha-tokens.txt','utf8'),...context.MatchaTaiwanProfile.createConfig(profile,context.MatchaFrontend)});
  for(const story of JSON.parse(readFileSync('dist/data/stories.json','utf8')).stories){const text=story.paragraphs.flatMap(p=>p.tokens.map(t=>t.h)).join('');assert.ok(frontend.tokensFor(text).ids.length,story.id);}
});

test('default worker resolves model parts under the lab while staying in the root offline scope',async()=>{
  const bytes=new TextEncoder().encode('voice bytes'),paths=[];
  const self={location:{href:'https://app.test/reading-worker.js?v=reading-2'},fetch:async url=>{paths.push(String(url));return new Response(bytes);},addEventListener(){}};
  const entry={bytes:bytes.length,parts:[{url:'assets/model.part0',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]};
  const context=vm.createContext({self,URL,Response,ReadableStream,crypto:webcrypto,Uint8Array,importScripts(url){if(url.endsWith('asset-chunks.js'))self.HANZI_TTS_CHUNKS={'assets/model.onnx':entry};}});
  vm.runInContext(readFileSync('dist/reading-worker.js','utf8'),context);
  assert.equal(await (await self.fetch('https://app.test/tts-lab/assets/model.onnx')).text(),'voice bytes');
  assert.deepEqual(paths,['https://app.test/tts-lab/assets/model.part0']);
  const handlers={},cached=[];
  const worker=vm.createContext({URL,Set,self:{location:{href:'https://app.test/sw.js'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{}},caches:{open:async()=>({addAll:async files=>cached.push(...files),match:async()=>({json:async()=>({mode:'human-only',clips:{}})})})}});
  vm.runInContext(readFileSync('dist/sw.js','utf8'),worker);let install;handlers.install({waitUntil:task=>install=task});await install;
  assert.ok(cached.includes('./reading-worker.js?v=reading-2'));assert.ok(cached.includes('./tts-lab/vendor/matcha-worker.js'));assert.ok(!cached.some(path=>path.endsWith('.onnx')));
});
