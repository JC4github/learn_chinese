# Mandarin audio

Hanzi Path 0.5.0 uses the learner-approved local wasmtts voice by default for entry narration and vocabulary. Human recordings remain the references for the current pinyin exercises. See DEFAULT_AUDIO.md for default playback, reusable generated audio and shared offline setup; WASMTTS_TRIAL.md contains model sources and licences.

The sections below document the human-recording collection introduced in 0.4.0. The previous 763 Kokoro WAV files and their generation scripts remain retired.

## Source and coverage

The app bundles unchanged MP3s from [hugolpz/audio-cmn](https://github.com/hugolpz/audio-cmn), pinned to `f759a0f18f27690742957619e1248ed91e9b3f2c`. The current 34 entries request 730 distinct text/pronunciation pairs: 215 have recordings, represented by 212 unique files (2,251,420 bytes). The other 515 explicitly have no recording. Repeated words reuse the same file when their pronunciation matches.

- Isolated syllables: Chen Wang (王琛), collection authors Wang Chen, Hugo Lopez and Nicolas Vion, 2013. CC BY-SA 3.0, verified in the original MP3 SWAC metadata.
- Whole words: Yue Tan, Base Audio Libre De Mots Chinois / Shtooka Caen Tan, 2009. CC BY-SA 3.0 US. The upstream README identifies this collection and speaker; [Mandarin Audio Utilities' collection credits](https://github.com/trevorld/mandarin_audio_utilities/blob/master/cc_README.rst) document its licence.
- MP3 processing and distribution: Hugo Lopez / audio-cmn. We preserve file bytes and only change filenames. Audio retains its own licence separately from app code and lesson text. In-app credits are available under Me.

This human sublibrary contains fixed recordings. The default reading voice now supplies narration and vocabulary audio beyond that collection, including new entries. Playback still requires a tap because of browser rules.

## Tone selection and limits

Single-character matching uses the supplied pinyin including its tone mark; it never guesses from the character alone. Four-tone practice uses distinct `ma1`, `ma2`, `ma3` and `ma4` source files. Unknown/neutral tones cannot silently become first tone. Whole-word recordings are selected by exact Hanzi; words with conflicting in-app pinyin variants are excluded. Dictionary pinyin and natural connected speech can differ.

[Upstream issue #7](https://github.com/hugolpz/audio-cmn/issues/7) reports degraded syllables and unsuitable/missing isolated neutral-tone samples. We exclude the explicitly flagged `san1`, `bang2`, `bang4`, `jv4`, `zhu2`, `zhu4` files. Neutral-tone teaching uses whole words 谢谢、什么、朋友. This excludes known reported problems; it is not certification that every remaining sample or word pronunciation has been independently reviewed by a Mandarin teacher. Native-speaker review remains necessary for teaching accuracy and polyphonic words.

Other options researched included eSpeak NG (local formant synthesis) and neural local TTS such as sherpa/Kokoro. Both produce synthetic speech and therefore do not meet the learner's instruction to remove all synthetic voices. Unclear-provenance scraped pinyin collections were not imported.

## Importing future recordings

Run `node scripts/import-human-audio.mjs` after editing lesson content. It downloads only matching human MP3s from the pinned source, verifies each file against its upstream Git blob SHA-1 and byte length, and writes explicit availability into `dist/audio/manifest.json`. Downloads are cached under ignored `work/native-audio-research`. No speech is generated. The one-time lesson migration is `scripts/configure-human-audio.mjs`.

The manifest records each pronunciation, speaker, licence, original path, source URL and integrity hash. Adding a new source requires establishing its provenance/licence and checking its actual pronunciation before adding it. Run `npm test` and `npm run check`; bump asset URLs and the service-worker cache when publishing changed assets.

## Playback and offline updates

[Howler.js 2.2.4](https://github.com/goldfire/howler.js) handles playback and mobile unlocking; its MIT licence is bundled in `dist/vendor`. No API key, speech subscription, installed system voice or external speech request is used. After one completed online installation, all 212 MP3s are cached for offline playback. Safari byte probes and suffix-range requests receive MP3 range responses.

Cache v18 removes this app's older caches on activation. Requests for retired generated WAVs receive HTTP 410, preventing stale audio from being replayed through the new worker. Existing saved words and learning progress keep the same storage key. Open the app online and use Me → Check for updates to receive this release.
