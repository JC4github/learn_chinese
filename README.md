# Hanzi Path

Hanzi Path is a private, mobile-first Mandarin graded-reading app. It is an original project inspired by the general idea of learning through short stories; it does not use DU Chinese code, branding, lesson text, audio, or artwork.

## Current MVP

- Four original beginner stories
- Tap any Chinese word for pinyin and meaning
- Mandarin text-to-speech playback
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
```

## Content

Story content is stored in `dist/data/stories.json`. It can be expanded without changing the interface code.
