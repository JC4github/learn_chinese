import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {stories}=JSON.parse(readFileSync('dist/data/stories.json','utf8'));

test('library preserves original stories and includes four pinyin and six conversation lessons',()=>{
  assert.equal(new Set(stories.map(story=>story.id)).size,stories.length);
  for(const id of ['morning-tea','lunch-choice','wrong-bus','weekend-market']) assert.ok(stories.some(story=>story.id===id));
  assert.equal(stories.filter(story=>story.topic==='pinyin').length,4);
  assert.equal(stories.filter(story=>story.topic==='conversation').length,6);
});
test('each guided lesson has explanations, fully defined listening examples, dialogue and a valid quiz',()=>{
  for(const story of stories.filter(story=>story.coach)){
    assert.ok(story.coach.title);assert.ok(story.coach.notes.length>=2);
    assert.ok(story.coach.practice.length>=2);
    for(const word of story.coach.practice) for(const key of ['h','p','e']) assert.ok(word[key],`${story.id}: missing ${key}`);
    assert.ok(story.paragraphs.every(paragraph=>paragraph.translation&&paragraph.tokens.length));
    if(story.topic==='conversation') assert.ok(story.paragraphs.every(paragraph=>paragraph.speaker));
    assert.ok(Number.isInteger(story.quiz.answer));assert.ok(story.quiz.answer>=0&&story.quiz.answer<story.quiz.options.length);
  }
});
test('tone lesson includes the four distinct ma syllables with matching tone marks',()=>{
  const examples=stories.find(story=>story.id==='pinyin-four-tones').coach.practice;
  assert.deepEqual(examples.map(word=>[word.h,word.p]),[['妈','mā'],['麻','má'],['马','mǎ'],['骂','mà']]);
});

test('personal collection contains exactly twenty original entries across the six requested interests',()=>{
  const entries=stories.filter(story=>story.collection==='personal-20');
  assert.equal(entries.length,20);
  assert.equal(stories.length,34);
  for(const [topic,count] of Object.entries({cars:4,anime:3,technology:3,engineering:3,arts:3,slang:4})){
    assert.equal(entries.filter(entry=>entry.topic===topic).length,count,topic);
  }
  assert.equal(entries.filter(entry=>entry.format==='Article').length,10);
  assert.equal(entries.filter(entry=>entry.format==='Conversation').length,9);
  assert.equal(entries.filter(entry=>entry.format==='Chat').length,1);
});

test('new entries have translated reading passages, tappable vocabulary, context notes and valid source links',()=>{
  for(const entry of stories.filter(story=>story.collection==='personal-20')){
    assert.ok(entry.paragraphs.length>=4,entry.id);
    assert.ok(entry.coach.notes.length>=2&&entry.coach.practice.length>=3,entry.id);
    if(entry.format==='Article')assert.ok(entry.sources?.length,`${entry.id}: missing background source`);
    else assert.ok(entry.paragraphs.every(paragraph=>paragraph.speaker),`${entry.id}: missing speaker`);
    for(const paragraph of entry.paragraphs){
      assert.ok(paragraph.translation&&paragraph.tokens.length,entry.id);
      for(const token of paragraph.tokens){
        if(token.punct)assert.match(token.h,/^[，。！？：、；“”]+$/u,entry.id);
        else for(const key of ['h','p','e'])assert.ok(token[key],`${entry.id}: ${key}`);
      }
    }
    for(const source of entry.sources||[])assert.equal(new URL(source.url).protocol,'https:');
  }
});

test('slang explanations distinguish register, ambiguous meanings and neutral alternatives',()=>{
  const find=id=>stories.find(entry=>entry.id===id);
  assert.match(find('slang-zhongcao').coach.notes.join(' '),/context-dependent/);
  assert.match(find('slang-pofang-shangtou').coach.notes.join(' '),/casual/);
  assert.match(find('slang-neijuan-tangping').coach.notes.join(' '),/neutral alternative/);
  assert.match(find('slang-running-late').coach.notes.join(' '),/estimate/);
});
