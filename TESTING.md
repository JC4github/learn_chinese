# Verification — human recordings, 0.4.0

## Default reading voice, 0.5.0

All 54 tests pass. The approved wasmtts voice is integrated with narration, selected and saved words, conversation examples and future-entry controls. New tests cover pronunciation matching, model setup, reusable output, long text, cancellation, stale events, retained human drills and worker scope. Fresh-install prompts and new synthesis after an offline main-app reload passed. See DEFAULT_AUDIO.md for the current implementation and browser results; the older sections below describe earlier releases.

## Optional wasmtts trial, 0.4.1

The separate `/tts-lab/` article trial adds six tests, for 41 passing tests in total. Local article generation, media loading/playback, tone/conversation samples, cancellation/reload, saved-WAV reuse and synthesis of new text after an offline page reload passed in the desktop preview. See WASMTTS_TRIAL.md for measurements and limits. These results do not establish tonal correctness or physical iPhone performance.

## Automated checks

`npm test`: all 35 tests pass. `npm run check`: all 34 entries and PWA assets pass.

Coverage includes playback/stop/replay, cancellation and stale events, missing recordings, missing playback library, errors and timeouts; pronunciation keys including tone marks and ü; four distinct ma tone sources; whole-word neutral-tone examples; explicit coverage for every requested vocabulary/practice item; upstream blob hashes and byte lengths for every human MP3; exclusion of known degraded files; and rejection of synthetic/legacy manifest entries.

Offline regressions check shell and MP3 caching, cleanup restricted to this app's older caches, retired generated WAV responses (410), Safari MP3 byte ranges, fresh page updates and offline navigation. Learning-state, saved-word persistence, all 34 quizzes, topic content and document-scrolling regressions also pass. Full-entry narration controls are absent and unavailable word controls are disabled.

## Browser verification

The actual Codex Chromium preview viewport was 358 × 1412. All eleven pinyin practice examples entered Playing and completed: mā/má/mǎ/mà, mǎi/mài, sì/shí and 谢谢/什么/朋友. Selected-word 谢谢 completed and was saved; the unrecorded phrase 你好吗 showed a disabled speaker and explicit unavailable text. Saved-word rows correctly distinguished available and unavailable recordings. The Me page showed version 0.4.0, human-only audio and recording credits. No browser errors were observed during online playback checks.

With the HTTP server stopped, the app reloaded from its cache and opened a previously unplayed entry. Its 厨房 recording played through to completion offline. The reader had no narration control, the body retained static document layout, and no horizontal overflow was observed. The final cache generation is v18 with versioned asset URLs.

## Limits

Desktop preview does not establish physical iPhone Safari/Home Screen behaviour, audible speaker output on the user's device, or pronunciation correctness. File identity, distinct tone mapping and playback lifecycle are verified; independent Mandarin-teacher review is not claimed. Human whole-word recordings use natural connected speech, which may differ from dictionary tone spelling. This collection cannot narrate arbitrary articles.

## Physical iPhone follow-up

1. Open the app online, use Me → Check for updates and confirm version 0.4.0.
2. Compare the four ma tones and the 买/卖 and 四/十 pairs. Check whole-word neutral-tone examples.
3. Test a word with a recording and one labelled “No recording yet.”
4. After the initial audio download completes, reopen in airplane mode and repeat the available word.
5. Confirm scrolling, rotation and returning to a lesson's top remain correct.
