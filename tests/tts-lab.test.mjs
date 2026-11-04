import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {encodeWav,validateText} from '../dist/tts-lab/audio-utils.js';

test('trial WAV joins sentence audio in order with a valid 16-bit mono header',()=>{
  const view=new DataView(encodeWav([new Float32Array([0,.5]),new Float32Array([-1,2])],16000));
  assert.equal(view.byteLength,52);assert.equal(view.getUint32(4,true),44);assert.equal(view.getUint32(24,true),16000);
  assert.equal(view.getUint32(40,true),8);assert.equal(view.getInt16(44,true),0);assert.equal(view.getInt16(46,true),16384);
  assert.equal(view.getInt16(48,true),-32767);assert.equal(view.getInt16(50,true),32767);
  assert.throws(()=>encodeWav([new Float32Array([NaN])]),/invalid/);
});
test('trial input rejects empty or oversized text before generation',()=>{
  assert.equal(validateText(' 你好。 '),'你好。');assert.throws(()=>validateText(' '),/Enter/);assert.throws(()=>validateText('好'.repeat(401)),/400/);
});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const context=vm.createContext({self:{}});vm.runInContext(readFileSync('dist/tts-lab/asset-chunks.js','utf8'),context);
const chunks=context.self.HANZI_TTS_CHUNKS,provenance=JSON.parse(readFileSync('dist/tts-lab/assets-provenance.json','utf8'));
test('complete voice pack matches every pinned upstream length and hash after splitting',()=>{
  assert.equal(provenance.release,'v2.6.0');assert.equal(provenance.assets.length,11);
  for(const asset of provenance.assets){
    const parts=chunks[asset.path]?.parts;
    const bytes=parts?Buffer.concat(parts.map(part=>{
      const bytes=readFileSync('dist/tts-lab/'+part.url);assert.equal(bytes.length,part.bytes);assert.equal(sha(bytes),part.sha256);return bytes;
    })):readFileSync('dist/tts-lab/'+asset.path);
    assert.equal(bytes.length,asset.bytes);assert.equal(sha(bytes),asset.sha256,asset.path);
  }
  for(const dir of ['assets','runtime'])for(const file of readdirSync('dist/tts-lab/'+dir))assert.ok(statSync('dist/tts-lab/'+dir+'/'+file).size<25*1024*1024);
});
test('split-model adapter reconstructs bytes and rejects corrupted downloads',async()=>{
  for(const corrupt of [false,true]){
    const data=new TextEncoder().encode('model data'),self={location:{href:'https://app.test/tts-lab/worker.js'},fetch:async()=>new Response(corrupt?'bad bytes':data)};
    const entry={bytes:data.length,parts:[{url:'assets/model.part0',bytes:data.length,sha256:sha(data)}]};
    const context=vm.createContext({self,URL,Response,ReadableStream,crypto:webcrypto,Uint8Array,importScripts(path){if(path==='./asset-chunks.js')self.HANZI_TTS_CHUNKS={'assets/model.onnx':entry};}});
    vm.runInContext(readFileSync('dist/tts-lab/worker.js','utf8'),context);
    const response=await self.fetch('https://app.test/tts-lab/assets/model.onnx');
    if(corrupt)await assert.rejects(()=>response.arrayBuffer(),/check failed/);
    else assert.equal(await response.text(),'model data');
  }
});
test('trial install caches its shell without eagerly downloading the voice models',async()=>{
  const handlers={},cached=[];
  const context=vm.createContext({Set,URL,self:{location:{href:'https://app.test/tts-lab/sw.js'},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:async()=>{}},caches:{open:async()=>({addAll:async files=>cached.push(...files)})}});
  vm.runInContext(readFileSync('dist/tts-lab/sw.js','utf8'),context);let promise;handlers.install({waitUntil:task=>promise=task});await promise;
  assert.ok(cached.includes('./worker.js'));assert.ok(cached.includes('./runtime/ort-1.27.0-wasm-simd-threaded.mjs'));
  assert.ok(!cached.some(path=>path.includes('.onnx')||path.includes('.part')||path.includes('simd-threaded.wasm')));
});
test('human references in the trial support offline Safari byte probes',async()=>{
  const context=vm.createContext({Set,URL,Response,self:{location:{href:'https://app.test/tts-lab/sw.js'},addEventListener(){}}});
  vm.runInContext(readFileSync('dist/tts-lab/sw.js','utf8'),context);context.response=new Response('abcdef');
  const response=await vm.runInContext("referenceRange('bytes=0-1',response)",context);
  assert.equal(response.status,206);assert.equal(await response.text(),'ab');assert.equal(response.headers.get('Content-Type'),'audio/mpeg');
});
