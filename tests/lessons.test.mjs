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
