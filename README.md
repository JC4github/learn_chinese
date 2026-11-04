# Hanzi Path

Hanzi Path is a private, mobile-first Mandarin graded-reading app. It is an original project inspired by the general idea of learning through short stories; it does not use DU Chinese code, branding, lesson text, audio, or artwork.

## Current MVP

- 34 entries: four beginner stories, four pinyin lessons, six everyday conversations and 20 personalised conversations/articles/chat entries
- Interest shelves for JDM cars, anime, technology, engineering, creative arts and internet slang
- Short factual explainers with background links, and slang with context, register and neutral alternatives
- Guided sound comparisons, reusable phrases, and labelled dialogue turns
- Tap any Chinese word for pinyin and meaning
- Human Mandarin recordings for available words and pinyin practice
- Optional pinyin and paragraph translations
- Saved-word list
- Comprehension checks and local progress
- Personal topic, level, and daily-time preferences
- Offline-capable Progressive Web App
- iPhone Home Screen installation support

## Local use

Serve the `dist` directory over HTTP. Service workers do not run from `file://` URLs.

```powershell
npx serve dist
```

Then open the local address in a browser.

## Checks

```powershell
npm run icons
npm run check
npm test
```

## Content

Story content is stored in `dist/data/stories.json`. It can be expanded without changing the interface code.

## Audio

Tap a Chinese word, then an available speaker in its definition sheet. Saved-word rows and pinyin practice also play human recordings. Tap the active speaker again to stop. Playback stops when leaving a story, closing its word sheet, or hiding the app. Words without a recording are labelled and disabled; full-entry narration is unavailable.

Audio uses 212 human MP3 recordings from audio-cmn through Howler.js 2.2.4, covering 215 text/pronunciation pairs. Files are reused when both text and pronunciation match. All synthetic speech has been removed. The recording library is cached for offline use. No device speech voice, API key, or speech subscription is needed. Browser autoplay rules still require tapping a speaker.

See `AUDIO.md` for import instructions, source credits, licences, coverage and pronunciation-review limits.

An optional wasmtts sample-article trial is available under Me → Open the speech lab, or `/tts-lab/`. It downloads a local voice pack only when requested. See `WASMTTS_TRIAL.md` for instructions and measured desktop/offline results. Normal lesson audio continues using human recordings.

## Testing

See `TESTING.md` for coverage, browser verification, and remaining device checks.
