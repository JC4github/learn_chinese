import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {MandarinPlayer,pronunciationKey} from '../dist/speech.js';
import {numberedSyllable} from '../dist/pronunciation.js';
const manifest=JSON.parse(readFileSync('dist/audio/manifest.json','utf8'));

function player() {
  const events=[], sounds=[], timers=new Map(); let id=0;
  class Howl {
    constructor(options){this.options=options;sounds.push(this);this.stopped=false;this.unloaded=false;}
    play(){this.options.onplay();} stop(){this.stopped=true;} unload(){this.unloaded=true;}
  }
  const instance=new MandarinPlayer({Howl,onChange:event=>events.push(event),schedule:fn=>{timers.set(++id,fn);return id;},unschedule:id=>timers.delete(id)});
  instance.setClips(manifest.clips);
  return {instance,events,sounds,timers};
}
test('bundled word plays without any device speech API or installed voice',()=>{
  const p=player(); p.instance.play('妈','mā');
  assert.ok(p.sounds[0].options.src[0].endsWith(manifest.clips['妈|mā'].src)); assert.equal(p.events.at(-1).status,'playing');
  p.sounds[0].options.onend(); assert.equal(p.events.at(-1).status,'idle');assert.equal(p.sounds[0].unloaded,true);
});
test('tap same word stops; next tap replays from a new audio instance',()=>{
  const p=player();p.instance.play('妈','mā');p.instance.play('妈','mā');
  assert.equal(p.sounds[0].stopped,true);assert.equal(p.instance.current,null);
  p.instance.play('妈','mā');assert.equal(p.sounds.length,2);assert.equal(p.events.at(-1).status,'playing');
});
test('new word cancels previous playback and stale end/error events are ignored',()=>{
  const p=player();p.instance.play('妈','mā');const old=p.sounds[0];p.instance.play('马','mǎ');
  old.options.onend();old.options.onloaderror(); assert.equal(p.instance.current.key,'马|mǎ'); assert.equal(old.stopped,true);
});
test('load and autoplay failures are visible and retryable',()=>{
  const p=player();p.instance.play('妈','mā');p.sounds[0].options.onloaderror();assert.equal(p.events.at(-1).status,'error');
  p.instance.play('妈','mā');p.sounds[1].options.onplayerror();assert.match(p.events.at(-1).message,/blocked/);
  p.instance.play('妈','mā');assert.equal(p.events.at(-1).status,'playing');
});
test('missing recordings or missing Howler report useful errors',()=>{
  const p=player();p.instance.play('missing');assert.equal(p.events.at(-1).status,'unavailable');
  p.instance.Howl=null;p.instance.play('妈','mā');assert.match(p.events.at(-1).message,/Reload/);
});
test('loading timeout releases the sound and allows retry',()=>{
  const p=player(); p.instance.Howl=class {constructor(){this.play=()=>{};this.unload=()=>{};this.stop=()=>{};}};
  p.instance.play('妈','mā');[...p.timers.values()][0]();assert.match(p.events.at(-1).message,/too long/);assert.equal(p.instance.current,null);
});
test('every requested word has explicit availability and pinyin practices have human recordings',()=>{
  const {stories}=JSON.parse(readFileSync('dist/data/stories.json','utf8'));
  const {clips,unavailable}=manifest;
  for(const story of stories){
    const tokens=story.paragraphs.flatMap(paragraph=>paragraph.tokens);
    for(const word of [...tokens.filter(token=>!token.punct),...(story.coach?.practice ?? [])]){
      const key=pronunciationKey(word.h,word.p);assert.ok(clips[key]||unavailable[key],`No availability: ${key}`);
    }
    if(story.id.startsWith('pinyin-'))for(const word of story.coach.practice)assert.ok(clips[pronunciationKey(word.h,word.p)]);
    assert.ok(!Object.values(clips).some(clip=>clip.text===tokens.map(token=>token.h).join('')));
  }
});
test('cached audio supports Safari byte probes, suffix ranges, and invalid ranges',async()=>{
  const context=vm.createContext({URL,Set,Response,self:{location:new URL('https://test.example/sw.js'),addEventListener(){}}});
  vm.runInContext(readFileSync('dist/sw.js','utf8'),context);
  for(const [range,status,body] of [['bytes=0-1',206,'ab'],['bytes=3-',206,'def'],['bytes=-2',206,'ef'],['bytes=20-30',416,''],['bytes=9-2',416,'']]){
    context.cached=new Response('abcdef');context.range=range;
    const response=await vm.runInContext('audioRangeResponse(range,cached)',context);
    assert.equal(response.status,status);assert.equal(await response.text(),body);
    if(status===206)assert.equal(response.headers.get('Content-Type'),'audio/mpeg');
  }
});

test('unsupported pronunciation never falls back to another tone or synthetic audio',()=>{
  const p=player();p.instance.play('妈','ma');p.instance.play('妈','mǎ');assert.equal(p.sounds.length,0);
  p.instance.setClips({'妈|mā':{src:'audio/old.wav',type:'synthetic',format:'wav'}});
  p.instance.play('妈','mā');assert.equal(p.sounds.length,0);assert.equal(p.events.at(-1).status,'unavailable');
});
test('pronunciation keys normalise spelling and preserve tones',()=>{
  assert.equal(pronunciationKey(' 朋友 ',' péng you '),'朋友|péngyou');
  assert.equal(pronunciationKey('绿','lu\u0308\u0300'),'绿|lǜ');
  assert.equal(numberedSyllable('lǜ'),'lv4');assert.equal(numberedSyllable('mǎ'),'ma3');
  assert.equal(numberedSyllable('ma'),null);assert.equal(numberedSyllable('nǐ hǎo'),null);
});
test('all audio is human MP3 data identical to its pinned upstream blob',()=>{
  assert.equal(manifest.mode,'human-only');const unique=new Set();
  for(const [key,clip] of Object.entries(manifest.clips)){
    assert.equal(key,pronunciationKey(clip.text,clip.pinyin));assert.equal(clip.type,'human');assert.equal(clip.format,'mp3');
    assert.match(clip.src,/^audio\/human\/[a-f0-9]{24}\.mp3$/);assert.ok(clip.speaker);assert.match(clip.license,/^https:\/\/creativecommons.org\/licenses\/by-sa\/3.0\//);
    assert.ok(clip.source.includes(manifest.source.commit));
    const bytes=readFileSync(`dist/${clip.src}`);assert.ok(bytes.length>1000);assert.equal(bytes.length,clip.bytes);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),clip.gitBlobSha1);
    assert.ok(!/cmn-(san1|bang2|bang4|jv4|zhu2|zhu4)\.mp3$/.test(clip.upstreamPath));unique.add(clip.src);
  }
  assert.equal(readdirSync('dist/audio').filter(file=>file.endsWith('.wav')).length,0);
  assert.equal(readdirSync('dist/audio/human').length,unique.size);assert.equal(unique.size,manifest.coverage.files);
});
test('four tones use distinct sources and neutral tone uses whole-word recordings',()=>{
  const tones=['妈|mā','麻|má','马|mǎ','骂|mà'].map(key=>manifest.clips[key]);
  assert.deepEqual(tones.map(clip=>clip.upstreamPath.split('/').at(-1)),['cmn-ma1.mp3','cmn-ma2.mp3','cmn-ma3.mp3','cmn-ma4.mp3']);
  assert.equal(new Set(tones.map(clip=>clip.src)).size,4);
  for(const key of ['谢谢|xièxie','什么|shénme','朋友|péngyou'])assert.equal(manifest.clips[key].kind,'word');
});
