# Test report — 3 November 2026

## Pinyin and conversation expansion (current)

The library now contains 14 lessons: four original stories, four pinyin lessons and six daily conversations. Each guided lesson includes explanations and tappable pronunciation/phrase examples; dialogue turns have speaker labels. All original story IDs and saved progress remain compatible.

All 23 automated tests pass, including vocabulary, full-lesson and practice-example audio coverage; pinyin tone examples; guided-content structure; quizzes for all 14 lessons; and independent playing states for a practice sample versus the full-story button.

Browser checks at a 390 × 844 viewport opened all ten new lessons, verified explanations/examples and dialogue labels, exercised quiz feedback, and found no horizontal content overflow. The original 85 audio files are reused unchanged. There are 189 clips in total (14,202,744 bytes).

The four tone-example recordings played and completed in the browser. A conversation phrase and new full-conversation narration also played. The full-story control correctly stayed inactive during individual example playback. A 320-pixel reader check had no horizontal overflow, and the home-page Pinyin shortcut selected the correct shelf. With the HTTP server stopped, the app reloaded a new pinyin lesson and its 马 recording played to completion offline. No new browser errors were observed during these checks.

## Bundled-audio update (current)

The device-voice implementation described in the historical sections below has been replaced. The app now includes 85 WAV recordings, generated locally with Kokoro v1.1-zh and played through Howler.js 2.2.4. It no longer uses the Web Speech API or requires an installed Mandarin voice.

All 19 current automated tests pass. Coverage includes valid recordings for every word and story, playback/stop/replay, stale events, loading timeouts, load/autoplay errors, offline audio caching, and Safari range responses. Existing learning-state, reset, storage, quiz, and offline navigation tests remain included.

Real browser checks confirmed that full-story, selected-word and saved-word recordings enter the playing state on the same Windows browser where device speech failed. Selected-word playback completed and replayed successfully. Physical iPhone speaker output and native-speaker pronunciation review remain follow-up checks.

With the local HTTP server stopped, the app was reloaded from its cache. Full-story playback started successfully. The previously unplayed word 计划 also played and completed offline. Full-story completion was verified online; word replay, stop and saved-word playback were also verified in the browser.

The following sections retain the earlier navigation and application regression report. Statements about missing system voices and the earlier 18-test suite describe the superseded implementation; current audio setup and library sources are documented in `AUDIO.md`.

## Changes verified

- The app shell is fixed to the dynamic viewport, with a dedicated scrolling main region. Header and bottom navigation occupy separate grid rows, preventing the navigation from drifting as content scrolls.
- Hidden checkbox inputs are contained by their labels, preventing outer-page overflow from moving the app shell.
- Word and story audio support Mandarin voice selection, local-voice preference, loading/playing/finished/error feedback, stop/replay, cancellation on navigation, and a startup timeout.
- Saved state is validated on load. Storage write failures are reported without breaking the app.
- Reset creates fresh state arrays. Repeat reading records daily activity without double-counting completed lessons.
- The service worker caches the speech module, only removes this app's old caches, ignores unrelated requests, and avoids returning HTML for missing assets.

## Automated regression suite

Run `npm test`. All 18 tests passed.

Coverage includes:

- Mandarin versus Cantonese/English selection, voices loading later, local voice preference, speech start/end, replay/stop, stale events, missing API, missing Mandarin voice, network errors, startup timeout, and synchronous playback failure.
- Invalid saved data, duplicate IDs, escaped learner names, preferences, storage quota failures, reset isolation, word toggling and persistence, completion idempotency, recommendations, and repeat-reading activity.
- Correct and incorrect answers for every starter story.
- Offline shell installation, caching the speech module, cache ownership, offline navigation/assets, and rejecting interception of unknown assets, external requests, and writes.

Run `npm run check` for starter content and PWA asset validation. JavaScript syntax checks and `git diff --check` also passed.

## Browser verification

Tested in the Codex Chromium preview on Windows.

| Viewport | Today | Library | Words | Me |
| --- | --- | --- | --- | --- |
| 320 × 780 | Pass | Pass | Pass | Pass |
| 390 × 844 | Pass | Pass | Pass | Pass |
| 844 × 390 | Pass | Pass | Pass | Pass |
| 1280 × 800 | Pass | Pass | Pass | Pass |

All 16 cases checked navigation geometry before and after scrolling: the bar remained anchored at the viewport bottom, the outer document stayed at scroll position zero, and no horizontal page overflow occurred.

All four stories were opened and checked for pinyin toggles, English translation toggles, quiz feedback, completion-button availability, hidden bottom navigation during reading, and horizontal overflow. Installation instructions opened and dismissed correctly.

The local HTTP server was stopped and the app reloaded. The cached library still loaded, topic filtering worked, and a story opened with translations and its quiz while the server was unavailable. The server was then restarted.

## Verification limits

- The Windows preview browser has no Mandarin voice. The real word and story buttons produced the expected missing-voice message. Audible pronunciation could not be verified on this host. Speech lifecycle and voice selection were verified with a simulated speech engine in the automated suite.
- Actual iPhone Safari, its software keyboard, toolbar expansion/collapse, pinch zoom, and standalone Home Screen mode still require physical-device testing. A desktop viewport simulation does not prove those behaviours.
- Offline reading passed locally. Offline speech depends on the device's installed voice and was not audibly tested.
- The hosted site is private and requires ChatGPT sign-in. Browser UI verification used the identical local application files; hosted login and offline behaviour after an expired hosting session remain device checks.

## iPhone follow-up checklist

1. Open the hosted app in Safari, sign in, and reload once after the update.
2. Scroll each main page to its end and back; rotate the phone and open/close the learner-name keyboard.
3. Open a story, tap a word, then tap its speaker. Confirm Mandarin is audible; tap again to stop and replay.
4. Play a saved word and a full story; leave the story and confirm playback stops.
5. Add to Home Screen, open it once online, then enable airplane mode and reopen a story. Test speech separately with a locally installed Mandarin voice.
