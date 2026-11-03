# Bundled Mandarin audio

The app ships 763 synthetic Mandarin WAV files (63,800,204 bytes) for vocabulary, pronunciation examples and all 34 complete entries. The personal-interest expansion adds 574 recordings and reuses all 189 prior clips unchanged. Playback does not depend on the browser's Web Speech API or installed system voices.

## Libraries selected

- [Howler.js 2.2.4](https://github.com/goldfire/howler.js): browser playback, mobile audio unlocking, stop/replay and load/play error events. MIT license; the bundled core and license are in `dist/vendor/`.
- [sherpa-onnx 2.0.1](https://github.com/k2-fsa/sherpa-onnx): offline audio generation during authoring. Apache 2.0.
- [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh): Mandarin synthesis model, Apache 2.0. Uses the official sherpa int8 model package and speaker 3, `zf_001`, at speed 0.86. Model license is retained in `dist/audio/KOKORO-LICENSE.txt`.
- [Official speaker map and examples](https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html).

The model files are not part of the deployed app. Playback requests only same-origin bundled recordings. No text is sent to a speech service during playback.

## Generate new or changed content

1. Create a Python virtual environment under `work/audio-venv`.
2. Install `scripts/requirements-audio.txt` into it.
3. Download and extract the official model from:
   `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_1.tar.bz2`
   into `work/kokoro-int8-multi-lang-v1_1`.
4. Run `work/audio-venv/Scripts/python.exe scripts/generate-audio.py` on Windows. The script derives vocabulary, practice and full-entry text from `dist/data/stories.json`, validates and reuses existing clips, checks non-silent finite output, and atomically writes `dist/audio/manifest.json`. For larger batches, use `--workers 4 --threads 2`; each worker owns an independent local voice instance. `--model-dir <path>` can reuse an already-downloaded model. Temporary recordings are renamed only after a successful write, so an interrupted run can safely resume.
5. Run `npm ci`, `npm run vendor`, `npm test`, and `npm run check`.
6. Bump the service-worker cache version when publishing changed assets.

`--limit 1` generates one sample without replacing the complete manifest. File identity includes the model, speaker, speed and text. Changing generation settings should also change that identity prefix.

## Offline and Safari

The service worker installs the entire recording library along with the app. Cached WAVs support byte-range responses for Safari's HTML5 fallback, including two-byte probes and suffix ranges. Opening the updated app online once is required before first offline playback.

## Evaluation notes

The plugin directory was searched for speech/voiceover providers. The relevant results require separate connected accounts, so none was installed. Azure Speech is an option for future dynamic generation but requires a provisioned speech resource. An edge-tts sample request was rejected by the service; it is not used by this implementation.

All speech is synthetic. WAV structure and non-silent output are validated; native-speaker pronunciation review remains useful for teaching content, especially names and polyphonic characters.
