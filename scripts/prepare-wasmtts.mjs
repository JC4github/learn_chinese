// Pin and verify upstream bytes. Split large models for static-host asset limits.
import {readFileSync,writeFileSync,copyFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const release='v2.6.0', archiveSha='f24e6435faf633de6fdbb632ccd72a8ae24bdd1eeb63d11e35eb98e3166fc14b';
const work=resolve('work/wasmtts'),engine=resolve(work,'engine'),out=resolve('dist/tts-lab');
const hash=data=>createHash('sha256').update(data).digest('hex');
if(hash(readFileSync(resolve(work,'wasmtts-engine.tar.gz')))!==archiveSha)throw Error('Unexpected engine archive');
const manifest=JSON.parse(readFileSync(resolve(engine,'matcha-assets.json'),'utf8'));
for(const dir of ['vendor','assets','runtime'])mkdirSync(resolve(out,dir),{recursive:true});
const shell=['matcha-producer.mjs','matcha-worker.js','matcha-engine.js','matcha-frontend.js','matcha-taiwan-profile.js','kaldifst-normalizer.js','matcha-synthesis.js','matcha-kaldifst-normalizer.js','matcha-kaldifst-normalizer.wasm','matcha-profile.runtime.json','matcha-assets.json','LICENSE','README.md'];
for(const file of shell)copyFileSync(resolve(engine,file),resolve(out,'vendor',file));
copyFileSync(resolve(work,'model-README.md'),resolve(out,'vendor','MODEL-README.md'));
const chunks={},provenance=[];
async function download(url,name,sha,bytes){
  const file=resolve(work,name);
  let data=existsSync(file)?readFileSync(file):null;
  if(!data||hash(data)!==sha){
    const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);data=Buffer.from(await r.arrayBuffer());
    if(hash(data)!==sha||data.length!==bytes)throw Error(`Integrity check failed: ${name}`);
    writeFileSync(file,data);
  }
  if(hash(data)!==sha||data.length!==bytes)throw Error(`Cached bytes mismatch: ${name}`);
  return data;
}
function put(data,directory,entry,source){
  if(hash(data)!==entry.sha256||data.length!==entry.bytes)throw Error('Invalid asset '+entry.packName);
  const name=entry.packName,limit=8*1024*1024;
  if(data.length>16*1024*1024){
    const parts=[];
    for(let offset=0;offset<data.length;offset+=limit){
      const bytes=data.subarray(offset,Math.min(offset+limit,data.length)),file=`${name}.part${parts.length}`;
      writeFileSync(resolve(out,directory,file),bytes);parts.push({url:`${directory}/${file}`,bytes:bytes.length,sha256:hash(bytes)});
    }
    chunks[`${directory}/${name}`]={bytes:data.length,sha256:entry.sha256,parts};
  }else writeFileSync(resolve(out,directory,name),data);
  provenance.push({path:`${directory}/${name}`,bytes:entry.bytes,sha256:entry.sha256,source});
}
put(readFileSync(resolve(engine,manifest.lexicon.file)),'assets',manifest.lexicon,`wasmtts ${release} archive`);
const hf=`https://huggingface.co/csukuangfj/matcha-icefall-zh-en/resolve/${manifest.matcha.revision}/`;
for(const [file,entry] of Object.entries(manifest.matcha.files))if(entry.packName){
  put(await download(hf+file,entry.packName,entry.sha256,entry.bytes),'assets',entry,hf+file);
}
for(const [entry,url] of [[manifest.acoustic,`${manifest.acoustic.repository}/resolve/${manifest.acoustic.revision}/${manifest.acoustic.file}`],[manifest.vocos,manifest.vocos.url]]){
  console.log('Fetching '+entry.packName);put(await download(url,entry.packName,entry.sha256,entry.bytes),'assets',entry,url);
}
for(const [pkg,config] of Object.entries(manifest.runtime))for(const [file,entry] of Object.entries(config.files)){
  const url=`https://unpkg.com/${pkg}@${config.version}/${file}`;
  put(await download(url,entry.packName,entry.sha256,entry.bytes),'runtime',entry,url);
}
for(const [file,url] of Object.entries({
  'ONNXRUNTIME-LICENSE.txt':'https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE',
  'LAMEJS-LICENSE.txt':'https://raw.githubusercontent.com/zhuker/lamejs/master/LICENSE',
  'LGPL-3.0.txt':'https://raw.githubusercontent.com/spdx/license-list-data/main/text/LGPL-3.0-or-later.txt',
  'APACHE-2.0.txt':'https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/LICENSE',
})){const r=await fetch(url);if(!r.ok)throw Error(`Licence unavailable: ${url}`);writeFileSync(resolve(out,'vendor',file),await r.text());}
writeFileSync(resolve(out,'asset-chunks.js'),`self.HANZI_TTS_CHUNKS = ${JSON.stringify(chunks,null,2)};\n`);
writeFileSync(resolve(out,'assets-provenance.json'),JSON.stringify({release,archiveSha,source:'https://github.com/enstw/wasmtts',assets:provenance,bytes:provenance.reduce((sum,a)=>sum+a.bytes,0)},null,2)+'\n');
console.log(`Prepared ${provenance.length} verified assets; ${provenance.reduce((sum,a)=>sum+a.bytes,0)} bytes`);
