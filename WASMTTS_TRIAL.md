# wasmtts sample article trial — 0.4.1

Update: the learner approved this voice and release 0.5.0 makes it the default in normal reading. The model cache is shared with this trial. See DEFAULT_AUDIO.md. The text below records the original 0.4.1 trial.

Open `/tts-lab/` on the existing private app, or Me → Open the speech lab. Download the optional voice pack, generate the article, and press the audio player's Play button. The text field accepts up to 400 characters; sample buttons include daily conversation, four tones, tone pairs and polyphonic words. Human tone recordings are supplied for comparison. Generated WAVs can be saved and are reused locally when text matches.

Normal lessons retain their existing human-only playback. This trial is separate and does not silently enable synthetic narration throughout the library. It needs no speech account or API key and sends no text to a speech service.

## Implementation and reproducibility

- Engine: [enstw/wasmtts v2.6.0](https://github.com/enstw/wasmtts/releases/tag/v2.6.0), commit `0d2cd7fca2d56b60f0e82e5193a83e7c1ce4b681`. Archive SHA-256 `f24e6435faf633de6fdbb632ccd72a8ae24bdd1eeb63d11e35eb98e3166fc14b`. Released engine scripts are unmodified.
- Acoustic model: dengcunqin's `matcha_tts_zh_en_20251010`, revision `f9ec409de129ed1b05c9262cd5b29a1ccec050e4`; Matcha frontend revision `fbe59d77057428c32111d5f3ea4ed67a7d440c61`. Vocos 16 kHz ONNX, ONNX Runtime Web 1.27.0 and lamejs 1.2.1 match the upstream complete asset manifest.
- The verified voice assets total 146,492,250 bytes, plus the smaller engine/page files. All are same-origin. Large model files are split into 8 MiB parts to fit static-host asset limits. A separate worker adapter verifies and streams those parts back into the original engine's fetch interface. Whole models are cached by the upstream engine after the user's explicit download tap.
- Heavy synthesis stays in a worker using one WASM thread. No cross-origin isolation headers or GPU are required. The app exports joined 16-bit mono PCM WAV, avoiding MP3 fragment concatenation. Output cache version v1 identifies this fixed engine/model/voice/profile/override configuration; bump it if any of those change.
- Shell cache is scoped separately to `/tts-lab/`; voice and output caches use separate names and do not affect lesson progress. The 147 MB voice pack is never downloaded during normal app use or shell installation. Cancellation terminates the worker; complete cached assets survive retries. The final trial shell cache is v3; the main app cache is v19.
- To reproduce asset preparation, fetch the pinned release archive into `work/wasmtts/wasmtts-engine.tar.gz`, extract it into `work/wasmtts/engine`, and fetch the pinned model README into `work/wasmtts/model-README.md`. Run `node scripts/prepare-wasmtts.mjs`. It verifies every voice asset against the release manifest. Sources, lengths and hashes are retained in `dist/tts-lab/assets-provenance.json`.

## Licences and pronunciation

The engine is MIT. The pinned ModelScope model README declares Apache License 2.0; retain that card and attribution for its Matcha/Vocos resource collection. ONNX Runtime is MIT. The released normalizer incorporates Apache-2.0 kaldifst/OpenFST. Unmodified lamejs/LAME remains a separate replaceable file with its licence notice, LGPL text and source link. The trial credits page and vendor folder retain these notices. The human references retain their existing CC BY-SA attribution.

The frontend has a Taiwan Mandarin profile. The trial pins numbered-pinyin overrides for 妈/麻/马/骂, 买/卖, 四/十, 银行, 长大 and 重庆. Other pronunciation choices come from the engine's frontend, including regional differences. Unknown sounds fail explicitly rather than silently dropping text. No claim is made that the model always pronounces arbitrary words correctly. Listen to the samples and compare with a native speaker before using it as a teaching voice.

## Verification

On the actual Codex Chromium preview viewport (358 × 1412), the initial article generated 23.8 seconds of audio in 4.6 seconds. The audio element loaded a 23.808-second WAV without a media error and entered playback. Four tones generated in 0.5 seconds, tone pairs in 0.7 seconds, daily conversation in 2.2 seconds and the polyphonic-word sample in 1.7 seconds. These are desktop measurements, not iPhone performance promises.

Cancellation stopped generation and required reloading the cached voice; that reload succeeded. Regenerating identical text reused the saved WAV. With the HTTP server stopped, the page reloaded, reinitialized from cached assets, and generated a new 8.5-second sample in 1.7 seconds. This verifies synthesis of previously unseen text offline, rather than only replaying a saved file.

Automated coverage includes all existing 35 app regressions plus six trial tests: WAV sentence joining/clipping/invalid values, text validation, every split/reassembled voice asset's length and hash, adapter rejection of corrupted downloads, optional pack download boundaries, and Safari byte ranges for human reference audio. Native-speaker tone review and physical iPhone Safari/Home Screen testing remain unverified.
