// Imports unchanged human recordings; never synthesizes or concatenates speech.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pronunciationKey,numberedSyllable} from '../dist/pronunciation.js';

const COMMIT='f759a0f18f27690742957619e1248ed91e9b3f2c';
const TREE='03a4476c699ada44faf09cb1e0d1707bf442b072';
const BASE=`https://raw.githubusercontent.com/hugolpz/audio-cmn/${COMMIT}/64k/`;
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const cache=resolve(root,'work/native-audio-research');
const output=resolve(root,'dist/audio/human');
mkdirSync(cache,{recursive:true});mkdirSync(output,{recursive:true});
const indexPath=resolve(cache,'64k-tree.json');
async function fetchBytes(url){
  for(let attempt=0;attempt<3;attempt++){
    try{const response=await fetch(url,{headers:{'User-Agent':'Hanzi-Path-native-audio-import'}});if(!response.ok)throw Error(`${response.status}: ${url}`);return Buffer.from(await response.arrayBuffer());}
    catch(error){if(attempt===2)throw error;await new Promise(done=>setTimeout(done,500*(attempt+1)));}
  }
}
if(!existsSync(indexPath))writeFileSync(indexPath,await fetchBytes(`https://api.github.com/repos/hugolpz/audio-cmn/git/trees/${TREE}?recursive=1`));
const tree=JSON.parse(readFileSync(indexPath,'utf8').replace(/^\uFEFF/,''));
if(tree.sha!==TREE||tree.truncated)throw Error('Incomplete or unexpected source index');
const files=new Map(tree.tree.filter(file=>file.type==='blob').map(file=>[file.path,file]));
const {stories}=JSON.parse(readFileSync(resolve(root,'dist/data/stories.json'),'utf8'));
const requested=new Map(),variants=new Map();
for(const story of stories)for(const word of [...story.paragraphs.flatMap(p=>p.tokens.filter(t=>!t.punct)),...(story.coach?.practice||[])]){
  requested.set(pronunciationKey(word.h,word.p),word);
  if(!variants.has(word.h))variants.set(word.h,new Set());
  variants.get(word.h).add(pronunciationKey('',word.p));
}
// Upstream reports these syllables as degraded. No neutral-tone syllables were recorded.
const blocked=new Set(['san1','bang2','bang4','jv4','zhu2','zhu4']);
const manifest={version:2,mode:'human-only',source:{repository:'https://github.com/hugolpz/audio-cmn',commit:COMMIT},clips:{},unavailable:{}};
const jobs=[];
for(const [key,word] of requested){
  let path,kind,speaker,license;
  if([...word.h].length===1){
    const syllable=numberedSyllable(word.p);
    if(syllable&&!blocked.has(syllable)){path=`syllabs/cmn-${syllable}.mp3`;kind='syllable';speaker='Chen Wang';license='https://creativecommons.org/licenses/by-sa/3.0/';}
  }else if(variants.get(word.h).size===1&&/^\p{Script=Han}+$/u.test(word.h)){
    path=`hsk/cmn-${word.h}.mp3`;kind='word';speaker='Yue Tan';license='https://creativecommons.org/licenses/by-sa/3.0/us/';
  }
  const file=files.get(path);
  if(!file){manifest.unavailable[key]={text:word.h,pinyin:word.p,reason:'No suitable human recording in the bundled collection.'};continue;}
  const name=file.sha.slice(0,24)+'.mp3';
  const clip={text:word.h,pinyin:word.p,type:'human',kind,format:'mp3',src:'audio/human/'+name,speaker,license,source:BASE+path.split('/').map(encodeURIComponent).join('/'),upstreamPath:path,gitBlobSha1:file.sha,bytes:file.size};
  manifest.clips[key]=clip;
  jobs.push({file,name,clip});
}
const unique=[...new Map(jobs.map(job=>[job.name,job])).values()];
let cursor=0,completed=0;
await Promise.all(Array.from({length:6},async()=>{
  while(cursor<unique.length){
    const job=unique[cursor++],path=resolve(output,job.name);
    const bytes=existsSync(path)?readFileSync(path):await fetchBytes(job.clip.source);
    const sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if(sha!==job.file.sha)throw Error('Recording integrity check failed: '+job.file.path);
    if(bytes.length!==job.file.size||bytes.length<1000)throw Error('Invalid recording: '+job.file.path);
    writeFileSync(path,bytes);completed++;
    if(completed%25===0)console.log(`Imported ${completed}/${unique.length} human recordings`);
  }
}));
manifest.coverage={requested:requested.size,available:Object.keys(manifest.clips).length,unavailable:Object.keys(manifest.unavailable).length,files:unique.length,bytes:unique.reduce((sum,job)=>sum+job.file.size,0)};
writeFileSync(resolve(root,'dist/audio/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(resolve(cache,'coverage.json'),JSON.stringify(manifest.coverage,null,2)+'\n');
console.log(JSON.stringify(manifest.coverage));
