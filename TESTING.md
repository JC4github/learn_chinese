# Test report — 3 November 2026

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
