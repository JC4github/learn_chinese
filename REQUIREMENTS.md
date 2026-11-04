# Hanzi Path — Product Requirements

Status: working MVP  
Version: 0.5
Updated: 5 November 2026

## Product direction

Create a personalised Mandarin reading app for one learner. The experience should make conversations, articles, nonfiction and graded stories approachable through tap-to-define vocabulary, optional learning aids, audio, review, and visible progress. Content should teach useful language and interesting real-world ideas.

The product may take inspiration from common graded-reader learning patterns, but all branding, interface design, lesson content, code, audio, and artwork must be original or appropriately licensed.

## Initial learner assumptions

- Learning Mandarin Chinese through English.
- Using Simplified Chinese.
- Beginner level, with room to add more levels later.
- Primarily using an iPhone.
- Prefers a private, account-free first version.

## MVP requirements

1. Show a personalised daily reading recommendation.
2. Provide short graded stories organised by level and topic.
3. Allow every Chinese word to be tapped for pinyin and an English meaning.
4. Allow pinyin and paragraph translations to be shown or hidden.
5. Use the approved local wasmtts voice by default for existing and future articles, conversations, stories, selected words and saved words. Generate audio on the device and cache results by model, text and pronunciation for reuse. Reuse the existing speech-lab voice download. Keep human recordings for current pinyin sound exercises. Show one-time voice setup when needed, and support stop/replay, cancellation and offline generation.
6. Let the learner save words for later review.
7. End each story with a short comprehension check.
8. Save preferences, completed stories, streak, minutes read, and saved words locally.
9. Work as an installable, offline-capable iPhone PWA.
10. Use an original calm, readable, mobile-first visual design.
11. Provide guided pinyin lessons with explanations and tappable sound comparisons.
12. Provide practical daily conversations with speaker labels, reusable phrase examples, translations and comprehension checks.
13. Cover the learner's interests: older and newer JDM cars, anime, technology, engineering, creative arts and internet slang.
14. Explain slang register and context-dependent meanings, with neutral alternatives where useful. Include source links for factual explainers; do not require fictional stories as the only content format.

## Current starter scope

- Four original beginner stories covering daily life, food, travel, and shopping.
- Four pinyin lessons covering tones, sound contrasts, neutral tones and connected speech.
- Six daily conversations covering introductions, ordering drinks, checkout, directions, plans and clarification.
- Twenty personalised entries: four cars, three anime, three technology, three engineering, three creative arts and four internet slang entries. Formats: ten articles, nine conversations and one group chat.
- One comprehension question per story or lesson. The local reading voice handles narration and vocabulary; human recordings cover the current pinyin practice examples.
- Browser-local personalisation and progress.
- No account, cloud sync, payment, social features, or copied third-party content.

## Next content milestone

Review the expanded curriculum with a native Mandarin speaker, then adjust topic depth, difficulty and future slang selections from learner feedback.

## Default audio policy

On 5 November the learner approved the wasmtts sample voice and requested it as the default for all future articles and texts. Release 0.5.0 integrates that voice into normal reading. New entries automatically receive Listen controls and on-device narration without a pre-generated audio manifest. Retain appropriately licensed assets and human tone references. See DEFAULT_AUDIO.md for implementation and verification, and TTS_RESEARCH.md for the earlier comparison.
