# Default reading voice — 0.5.0

The learner approved the wasmtts trial and selected it as the default voice. All existing and future entries use the same local Matcha/Vocos model for narration, word definitions, saved words and conversation practice. Current pinyin practice buttons retain the human reference recordings. There is no speech-service request or API key.

## Using it

Tap **Listen** in an entry's sticky toolbar, or tap a word and its speaker. Tap again to stop. Leaving the reader, closing a definition, hiding the app or navigating away stops playback. On a device without the pack, the app asks for the one-time 147 MB voice download; the Prepare reading voice button is also under Me. A pack downloaded through the speech lab is reused, not downloaded again. Download/setup can be cancelled and retried.

After initial online installation, both new synthesis and cached replay work offline. Results are saved per model configuration, text and written pronunciation, so the same phrase in another entry reuses its audio. A different pronunciation gets a different cache key. Storage failures do not prevent playback of successfully generated audio.

## Implementation

- `dist/reading-voice.js`: worker client, shared model setup, bounded sentence synthesis, pronunciation parsing and generated-WAV cache. Normal reading has no 400-character trial limit; text is split into at most 72-character units before synthesis.
- `dist/reading-audio.js`: default narration/word playback, public playback feedback, mobile audio-context unlocking, stop/replay, stale-request protection and human drill delegation.
- `dist/reading-worker.js`: a small adapter around the unchanged released engine, at the app root to avoid the speech lab's separate service-worker scope. Synthesis requests are serialized. When a word's marked or joined pinyin maps unambiguously to supported syllables, those phone IDs are used explicitly; otherwise the engine's text frontend handles it. Unknown characters fail visibly rather than silently disappearing.
- The approved engine, models, profile and licences remain those documented in WASMTTS_TRIAL.md. Regional pronunciation differences and model errors remain possible; this is not independent native-speaker certification.

The model cache deliberately keeps the trial name `hanzi-tts-trial-voice-v1`. The main app's generated cache is `hanzi-reading-audio-v1`; its identity includes a fixed engine/model/profile version, text and normalized pinyin. Bump that identity/cache version when changing the engine, model, voice, profile or pronunciation policy. The main shell cache is v24; voice models remain an explicit download and are not included in shell installation. The model assets were already shipped with 0.4.1, so this change adds no new model download.

## Verification

All 54 automated checks pass. New coverage includes marked/neutral/joined pinyin, explicit polyphonic readings, missing-pack setup without an automatic large download, reuse across entries, distinct cache identities, long input, worker disposal, late cancellation, replay, human drill bypass, playback errors, automatic narration for future entries and the root worker's offline scope. The text frontend accepts all 34 current entries; this does not prove every pronunciation is correct.

Desktop browser checks confirmed whole-entry narration, selected-phrase synthesis using explicit pinyin, playback of a phrase previously lacking a human recording, retained human tone exercises, stop/replay and saved-word audio. The existing trial download was reused. A fresh localhost origin showed the one-time download prompt without downloading the model. With the server stopped, the main app reloaded and synthesized a previously unplayed entry plus 原型 word audio. The final worker is rooted outside the lab service worker's scope. At the actual 358 × 1412 preview size, the body retained static document scrolling and no horizontal overflow was observed. Physical iPhone Safari performance, audible output on that device and teacher review remain separate checks.
