import {readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../dist/data/stories.json',import.meta.url);
const data=JSON.parse(readFileSync(path,'utf8'));
const find=id=>data.stories.find(story=>story.id===id);
find('pinyin-buy-sell').coach.practice=[{h:'买',p:'mǎi',e:'buy · 3rd tone'},{h:'卖',p:'mài',e:'sell · 4th tone'}];
find('pinyin-four-ten').coach.practice=[{h:'四',p:'sì',e:'four · s + 4th tone'},{h:'十',p:'shí',e:'ten · sh + 2nd tone'}];
const neutral=find('pinyin-neutral-tone').coach;
neutral.notes=[
  '吗 ma is a question particle. Its neutral tone has no tone mark: keep it short and light. Neutral pitch depends on the preceding tone; it is not a fifth fixed contour.',
  'Listen to the human whole-word recordings: 谢谢 xièxie, 什么 shénme and 朋友 péngyou. Their second syllables are light. This avoids substituting a first-tone syllable for an unavailable isolated neutral-tone recording.',
  'Pinyin usually writes 你好 as nǐ hǎo. In connected speech, the first third tone changes to a rising tone before another third tone. The word recordings here demonstrate neutral syllables; they are not a recording of 你好.'
];
neutral.practice=[{h:'谢谢',p:'xièxie',e:'thank you · light xie'},{h:'什么',p:'shénme',e:'what · light me'},{h:'朋友',p:'péngyou',e:'friend · light you'}];
writeFileSync(path,JSON.stringify(data,null,2)+'\n');
