import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { MandarinPlayer } from '../dist/speech.js';

function appHarness(saved = null, storageFailure = false) {
  const elements = new Map(), handlers = {}, store = new Map();
  if(saved!==null)store.set('hanzi-path-state-v1',typeof saved==='string'?saved:JSON.stringify(saved));
  const element = () => ({innerHTML:'',textContent:'',dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},scrollTo(){},showModal(){},close(){},querySelectorAll:()=>[],setAttribute(){},removeAttribute(){}});
  const document={documentElement:element(),body:element(),hidden:false,querySelector:s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll:()=>[],addEventListener:(name,fn)=>{handlers[name]??=[];handlers[name].push(fn);}};
  const context=vm.createContext({document,window:{addEventListener(){},scrollTo(){}},location:{hash:'#home'},history:{replaceState(){}},navigator:{},MandarinPlayer,structuredClone,console,Intl,Date,confirm:()=>true,setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>{if(storageFailure)throw Error('quota');store.set(key,value);}}});
  const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*\n/,'').replace('\ninit();','');
  vm.runInContext(source,context);
  const evaluate=source=>vm.runInContext(source,context);
  evaluate(`stories = ${readFileSync(new URL('../dist/data/stories.json',import.meta.url),'utf8')}.stories`);
  return {evaluate,store,elements,handlers};
}
test('invalid stored data recovers without breaking the app',()=>{
  for(const saved of ['invalid', {completed:null,savedWords:3,topics:'food',streak:-2,name:33}]){
    const h=appHarness(saved); h.evaluate('render()');
    assert.equal(h.evaluate('state.name'),'Learner'); assert.equal(h.evaluate('state.completed.length'),0);
  }
});
test('stored preferences are validated, deduplicated, escaped and retained',()=>{
  const h=appHarness({name:'<img src=x>',level:'Beginner 2',completed:['morning-tea','morning-tea'],topics:['food','bad'],savedWords:[null],dailyMinutes:20});
  h.evaluate('render()'); assert.equal(h.evaluate('state.completed.length'),1);
  assert.equal(h.evaluate('state.savedWords.length'),0); assert.match(h.elements.get('#app').innerHTML,/&lt;img/);
  h.evaluate('saveState()'); assert.equal(JSON.parse(h.store.get('hanzi-path-state-v1')).dailyMinutes,20);
});
test('reset remains empty after completing, saving, and then resetting twice',()=>{
  const h=appHarness(); h.evaluate("state.completed.push('morning-tea'); state.savedWords.push({h:'茶',p:'chá',e:'tea',key:'tea'}); handleAppClick({target:{closest:selector=>selector==='[data-reset]'?{}:null}})");
  assert.equal(h.evaluate('state.completed.length+state.savedWords.length'),0);
  h.evaluate("state.completed.push('wrong-bus'); handleAppClick({target:{closest:selector=>selector==='[data-reset]'?{}:null}})");
  assert.equal(h.evaluate('state.completed.length'),0);
});
test('completion is idempotent, advances recommendations, and repeat reading counts as daily activity',()=>{
  const h=appHarness(); h.evaluate("activeStoryId='morning-tea'; completeStory()");
  assert.equal(h.evaluate('state.totalMinutes'),4); assert.notEqual(h.evaluate('getRecommendedStory().id'),'morning-tea');
  h.evaluate("state.lastStudyDate=null; activeStoryId='morning-tea'; completeStory()");
  assert.equal(h.evaluate('state.totalMinutes'),4); assert.equal(h.evaluate('state.lastStudyDate===localDateKey()'),true);
});
test('word saving toggles, no duplicates and persistence round-trips',()=>{
  const h=appHarness(); h.evaluate("toggleSavedWord({h:'茶',p:'chá',e:'tea',key:'tea'}); toggleSavedWord({h:'茶',p:'chá',e:'tea',key:'tea'})");
  assert.equal(h.evaluate('state.savedWords.length'),0);
  h.evaluate("toggleSavedWord({h:'茶',p:'chá',e:'tea',key:'tea'})");
  assert.equal(JSON.parse(h.store.get('hanzi-path-state-v1')).savedWords[0].h,'茶');
});
test('all story quizzes support correct and wrong feedback and completion',()=>{
  const h=appHarness();
  for(const story of JSON.parse(readFileSync(new URL('../dist/data/stories.json',import.meta.url))).stories){
    h.evaluate(`activeStoryId='${story.id}'; quizSelection=${story.quiz.answer}; renderReader()`);
    assert.match(h.elements.get('#app').innerHTML,/that’s right/);
    h.evaluate(`quizSelection=${(story.quiz.answer+1)%story.quiz.options.length}; renderReader()`);
    assert.match(h.elements.get('#app').innerHTML,/Not quite/);
  }
});
test('storage quota errors report failure rather than breaking the flow',()=>{
  const h=appHarness(null,true); h.evaluate('saveState()'); assert.match(h.elements.get('#toast').textContent,/could not be saved/);
});

test('playing a practice sample does not mark the full-story control as playing',()=>{
  const h=appHarness();
  h.evaluate(`
    const controls = [{dataset:{speakStory:'完整故事'},hasAttribute:name=>name==='data-speak-story'}, {dataset:{speakWord:'妈'},hasAttribute:()=>false}];
    controls.forEach(button=>{button.attrs={};button.classList={toggle(){}};button.setAttribute=(key,value)=>button.attrs[key]=value;});
    document.querySelectorAll=selector=>selector.includes('[data-speak-word]')?controls:[];
    audioState={status:'playing',text:'妈',message:'Playing'};
    updateAudioControls();
  `);
  assert.equal(h.evaluate("controls[0].attrs['aria-pressed']"),'false');
  assert.equal(h.evaluate("controls[1].attrs['aria-pressed']"),'true');
});

test('opening and leaving a lesson switches scroll owners and resets both positions',()=>{
  const h=appHarness();
  h.evaluate(`
    const scrollModes=[];
    document.documentElement.classList.toggle=(name,enabled)=>scrollModes.push(['html',name,enabled]);
    document.body.classList.toggle=(name,enabled)=>scrollModes.push(['body',name,enabled]);
    let pageTop=850, appTop=650;
    window.scrollTo=options=>{pageTop=options.top;};
    app.scrollTo=options=>{appTop=options.top;};
    handleAppClick({target:{closest:selector=>selector==='[data-open-story]'?{dataset:{openStory:'pinyin-four-tones'}}:null}});
  `);
  assert.equal(h.evaluate('pageTop + appTop'),0);
  assert.equal(h.evaluate("scrollModes.every(([,name,enabled])=>name==='reader-open' && enabled)"),true);
  h.evaluate(`
    pageTop=950; appTop=400;
    handleAppClick({target:{closest:selector=>selector==='[data-reader-back]'?{}:null}});
  `);
  assert.equal(h.evaluate('pageTop + appTop'),0);
  assert.equal(h.evaluate('scrollModes.slice(-2).every(([, ,enabled])=>enabled===false)'),true);
  assert.equal(h.evaluate('activeStoryId'),null);
});

test('reader display toggles preserve lesson DOM instead of rebuilding scrolled content',()=>{
  const h=appHarness();
  h.evaluate(`
    activeStoryId='pinyin-four-tones'; render();
    const readerMarkup=app.innerHTML;
    const translations=[{hidden:true},{hidden:true}];
    document.querySelectorAll=selector=>selector==='.paragraph-translation'?translations:[];
    renderReader=()=>{throw Error('Reader was rebuilt');};
    handleAppClick({target:{closest:selector=>selector==='[data-toggle-pinyin]'?{}:null}});
    handleAppClick({target:{closest:selector=>selector==='[data-toggle-translation]'?{}:null}});
  `);
  assert.equal(h.evaluate('state.showPinyin'),false);
  assert.equal(h.evaluate('state.showTranslation'),true);
  assert.equal(h.evaluate('translations.every(paragraph=>!paragraph.hidden)'),true);
  assert.equal(h.evaluate('app.innerHTML===readerMarkup'),true);
  assert.equal(JSON.parse(h.store.get('hanzi-path-state-v1')).showTranslation,true);
});

function workerHarness({offline=false}={}) {
  const handlers={}, deleted=[], cached=[], response={from:'cache'}, network={from:'network'};
  const context=vm.createContext({URL,Set,Promise,Response,self:{location:new URL('https://test.example/sw.js'),addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>({addAll:async files=>cached.push(...files),match:async()=>({json:async()=>({clips:{word:{src:'audio/0123456789abcdef01234567.wav'}}})})}),keys:async()=>['other-app-v1','hanzi-path-v2','hanzi-path-v3'],delete:async key=>deleted.push(key),match:async()=>response},fetch:async()=>{if(offline)throw Error('offline');return network;}});
  vm.runInContext(readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8'),context);
  return {handlers,deleted,cached,response,network,context};
}
test('offline install caches the audio module and all shell assets',async()=>{
  const h=workerHarness(); let task; h.handlers.install({waitUntil:p=>task=p}); await task; assert.ok(h.cached.includes('./speech.js')); assert.ok(h.cached.some(path=>path.endsWith('.wav')));
});
test('cache upgrade deletes only this app’s older caches',async()=>{
  const h=workerHarness(); let task; h.handlers.activate({waitUntil:p=>task=p}); await task;
  assert.ok(h.deleted.includes('hanzi-path-v2')); assert.ok(!h.deleted.includes('other-app-v1'));
});
test('offline navigation and known assets use cached content',async()=>{
  const h=workerHarness({offline:true});
  for(const request of [{method:'GET',url:'https://test.example/',mode:'navigate'},{method:'GET',url:'https://test.example/speech.js',mode:'cors'}]){
    let task; h.handlers.fetch({request,respondWith:p=>task=p}); assert.equal(await task,h.response);
  }
});
test('unknown assets, cross-origin requests and writes are never replaced by HTML',()=>{
  const h=workerHarness({offline:true});
  for(const request of [{method:'GET',url:'https://test.example/missing.js',mode:'cors'},{method:'GET',url:'https://other.example/api',mode:'cors'},{method:'POST',url:'https://test.example/',mode:'cors'}]){
    let intercepted=false; h.handlers.fetch({request,respondWith:()=>intercepted=true}); assert.equal(intercepted,false);
  }
});
