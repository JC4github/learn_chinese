# Hanzi Path

Hanzi Path is a private, mobile-first Mandarin graded-reading app. It is an original project inspired by the general idea of learning through short stories; it does not use DU Chinese code, branding, lesson text, audio, or artwork.

## Current MVP

- 34 entries: four beginner stories, four pinyin lessons, six everyday conversations and 20 personalised conversations/articles/chat entries
- Interest shelves for JDM cars, anime, technology, engineering, creative arts and internet slang
- Short factual explainers with background links, and slang with context, register and neutral alternatives
- Guided sound comparisons, reusable phrases, and labelled dialogue turns
- Tap any Chinese word for pinyin and meaning
- Local wasmtts narration and word audio, with human pinyin practice references
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

Tap Listen in an entry's toolbar for narration, or tap a Chinese word and its speaker. Saved-word rows use the same reading voice. Tap again to stop. Playback stops when leaving a story, closing its word sheet, or hiding the app. The current pinyin exercises keep their human recordings.

The default is the approved wasmtts Matcha/Vocos voice, generated on-device and played through Howler.js 2.2.4. New content needs no pre-generated recording manifest. A one-time 147 MB model pack is reused from the speech lab when present. Generated WAVs are cached by model, text and pronunciation. Both synthesis and replay work offline after setup. No installed system voice, speech API key or subscription is needed.

See `AUDIO.md` for import instructions, source credits, licences, coverage and pronunciation-review limits.

The sample-article speech lab remains available under Me → Open the speech lab, or `/tts-lab/`. See `DEFAULT_AUDIO.md` for the default integration and `WASMTTS_TRIAL.md` for model provenance and trial measurements.

## Testing

See `TESTING.md` for coverage, browser verification, and remaining device checks.
