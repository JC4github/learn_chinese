# Hanzi Path

Hanzi Path is a private, mobile-first Mandarin graded-reading app. It is an original project inspired by the general idea of learning through short stories; it does not use DU Chinese code, branding, lesson text, audio, or artwork.

## Current MVP

- 34 entries: four beginner stories, four pinyin lessons, six everyday conversations and 20 personalised conversations/articles/chat entries
- Interest shelves for JDM cars, anime, technology, engineering, creative arts and internet slang
- Short factual explainers with background links, and slang with context, register and neutral alternatives
- Guided sound comparisons, reusable phrases, and labelled dialogue turns
- Tap any Chinese word for pinyin and meaning
- Bundled Mandarin recordings for words and stories
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

Tap a Chinese word, then the speaker in its definition sheet. Saved-word rows also play pronunciation. The reader speaker plays the whole story. Tap the active speaker again to stop. Playback stops when leaving a story, closing its word sheet, or hiding the app.

Audio uses bundled recordings through Howler.js 2.2.4. All words, phrases, pronunciation examples and full lessons have audio, generated locally with Kokoro v1.1-zh through sherpa-onnx. Existing recordings are reused when text matches. The recording library is cached for offline use. No device speech voice, API key, or speech subscription is needed. Browser autoplay rules still require tapping a speaker.

See `AUDIO.md` for generation instructions, sources, and licenses. The large generation model stays in the ignored `work/` directory and is not shipped to the browser.

## Testing

See `TESTING.md` for coverage, browser verification, and remaining device checks.
