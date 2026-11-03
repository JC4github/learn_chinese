import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import vm from 'node:vm';
import {MandarinPlayer} from '../dist/speech.js';

function player() {
  const events=[], sounds=[], timers=new Map(); let id=0;
  class Howl {
    constructor(options){this.options=options;sounds.push(this);this.stopped=false;this.unloaded=false;}
    play(){this.options.onplay();} stop(){this.stopped=true;} unload(){this.unloaded=true;}
  }
  const instance=new MandarinPlayer({Howl,onChange:event=>events.push(event),schedule:fn=>{timers.set(++id,fn);return id;},unschedule:id=>timers.delete(id)});
  instance.setClips({'厨房':{src:'audio/test.wav'},'茶':{src:'audio/tea.wav'}});
  return {instance,events,sounds,timers};
}
test('bundled word plays without any device speech API or installed voice',()=>{
  const p=player(); p.instance.play('厨房');
  assert.match(p.sounds[0].options.src[0],/audio\/test.wav$/); assert.equal(p.events.at(-1).status,'playing');
  p.sounds[0].options.onend(); assert.equal(p.events.at(-1).status,'idle');assert.equal(p.sounds[0].unloaded,true);
});
test('tap same word stops; next tap replays from a new audio instance',()=>{
  const p=player();p.instance.play('厨房');p.instance.play('厨房');
  assert.equal(p.sounds[0].stopped,true);assert.equal(p.instance.current,null);
  p.instance.play('厨房');assert.equal(p.sounds.length,2);assert.equal(p.events.at(-1).status,'playing');
});
test('new word cancels previous playback and stale end/error events are ignored',()=>{
  const p=player();p.instance.play('厨房');const old=p.sounds[0];p.instance.play('茶');
  old.options.onend();old.options.onloaderror(); assert.equal(p.instance.current.text,'茶'); assert.equal(old.stopped,true);
});
test('load and autoplay failures are visible and retryable',()=>{
  const p=player();p.instance.play('厨房');p.sounds[0].options.onloaderror();assert.equal(p.events.at(-1).status,'error');
  p.instance.play('厨房');p.sounds[1].options.onplayerror();assert.match(p.events.at(-1).message,/blocked/);
  p.instance.play('厨房');assert.equal(p.events.at(-1).status,'playing');
});
test('missing recordings or missing Howler report useful errors',()=>{
  const p=player();p.instance.play('missing');assert.match(p.events.at(-1).message,/recording yet/);
  p.instance.Howl=null;p.instance.play('厨房');assert.match(p.events.at(-1).message,/Reload/);
});
test('loading timeout releases the sound and allows retry',()=>{
  const p=player(); p.instance.Howl=class {constructor(){this.play=()=>{};this.unload=()=>{};this.stop=()=>{};}};
  p.instance.play('厨房');[...p.timers.values()][0]();assert.match(p.events.at(-1).message,/too long/);assert.equal(p.instance.current,null);
});
test('every word and full story has a non-empty, valid WAV recording',()=>{
  const {stories}=JSON.parse(readFileSync('dist/data/stories.json','utf8'));
  const {clips}=JSON.parse(readFileSync('dist/audio/manifest.json','utf8'));
  for(const story of stories){
    const tokens=story.paragraphs.flatMap(paragraph=>paragraph.tokens);
    for(const text of [...tokens.filter(token=>!token.punct).map(token=>token.h),tokens.map(token=>token.h).join('')]){
      assert.ok(clips[text],`No recording: ${text}`);const bytes=readFileSync(`dist/${clips[text].src}`);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
      assert.ok(statSync(`dist/${clips[text].src}`).size>1000);assert.ok(clips[text].duration>.1);
    }
  }
});
test('cached audio supports Safari byte probes, suffix ranges, and invalid ranges',async()=>{
  const context=vm.createContext({URL,Set,Response,self:{location:new URL('https://test.example/sw.js'),addEventListener(){}}});
  vm.runInContext(readFileSync('dist/sw.js','utf8'),context);
  for(const [range,status,body] of [['bytes=0-1',206,'ab'],['bytes=3-',206,'def'],['bytes=-2',206,'ef'],['bytes=20-30',416,''],['bytes=9-2',416,'']]){
    context.cached=new Response('abcdef');context.range=range;
    const response=await vm.runInContext('audioRangeResponse(range,cached)',context);
    assert.equal(response.status,status);assert.equal(await response.text(),body);
  }
});
