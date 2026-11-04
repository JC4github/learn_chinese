# Mandarin TTS options researched in Chinese

Researched: 5 November 2026. This is a shortlist, not an integration or pronunciation-quality certification. The deployed 0.4.0 app still uses only human recordings; none of the engines below has been added to it.

## Latest request

The learner likes Chinese Douyin TTS and wants similar-quality pronunciation for arbitrary words, phrases and future entries. The earlier request to remove all synthetic voices produced release 0.4.0. This new request reopens evaluation of pretrained Mandarin TTS. These engines also synthesize speech; “pretrained” does not mean a recording of a human saying every requested word. Local operation inside the iPhone PWA remains the preferred route.

Chinese search terms included `抖音 文字转语音 开源 本地 中文 TTS 网页 WebAssembly`, `中文 文字转语音 浏览器 本地 多音字`, `火山引擎 离线语音合成 iOS`, and `Hojo-TTS-Light WebGPU Safari`. Findings below rely on original project documentation and vendor documentation, rather than reposted tutorials.

## Candidates

| Candidate | What is verified | Fit for the current app |
| --- | --- | --- |
| ByteDance / Volcano Engine Doubao speech (`豆包语音`) | Official voice catalogue marks some voices `抖音同款,剪映同款`. The HTTP API accepts text and returns audio; its pronunciation dictionary can specify numbered pinyin. | Strongest direct lead for the requested Douyin-style voices. Online generation requires an account/API key and a server component; the key must not be embedded in the public client. Cached audio could replay offline, but a new word would require online generation. No account or paid service was activated. Exact preferred voice and listening quality are untested. |
| Volcano Engine native offline TTS SDK | Official Android/iOS SDK supports offline synthesis from downloaded resources. iOS offline licences require contacting the vendor, by app package or device count. | Genuine offline option, but it is a native SDK rather than a JavaScript library. It would require a native app/wrapper and native integration. Do not assume its offline voice pack is identical to the latest online Douyin voices. |
| `enstw/wasmtts` (Matcha + Vocos) | A browser engine release with worker, offline asset cache, Mandarin frontend, explicit pronunciation overrides and a Safari/PWA target. Single-thread WASM can run on ordinary static hosting. | First candidate to prototype for the existing local PWA. README discusses roughly 130 MB of assets. Its v2.6.0 report measured around 338 MiB after streaming on desktop Chromium, explicitly not true peak memory or an iPhone result. Small project; physical iPhone and tonal listening tests remain necessary. Its Taiwan pronunciation profile needs review against the app's Simplified Chinese/mainland pinyin. |
| HojoAI `Hojo-TTS-Light-40M` | Official ONNX model supports Chinese/English, two Chinese preset voices, CPU inference and pinyin-based correction. Official model card labels weights Apache-2.0. Listed model components total roughly 205 MB before other assets. | Promising second local candidate. Official inference is Python + ONNX Runtime; browser integration needs a JavaScript port/verified adapter. CPU support alone does not prove Safari compatibility. No measured iPhone performance or tone comparison yet. |

Primary sources:

- [Doubao official voice catalogue](https://docs.volcengine.com/docs/doubao-voice/tone-list-3?lang=zh)
- [Doubao HTTP synthesis and pronunciation dictionary](https://docs.volcengine.com/docs/doubao-voice/unidirectional-streaming-text-to-speech-http?lang=zh)
- [Official online/offline SDK overview](https://docs.volcengine.com/docs/doubao-voice/sdk-overview?lang=zh)
- [Official iOS integration flow, including offline authorisation](https://docs.volcengine.com/docs/DoubaoVoice/Accessprocess-1?lang=zh)
- [wasmtts source, integration and pronunciation overrides](https://github.com/enstw/wasmtts)
- [wasmtts releases and desktop-only measurement limits](https://github.com/enstw/wasmtts/releases/tag/v2.6.0)
- [Hojo official source and correction capability](https://github.com/HojoAI/Hojo-TTS-Light)
- [Hojo 40M model card, voices, sizes and licence](https://huggingface.co/HojoAI/Hojo-TTS-Light-40M)

ByteDance also publishes [MegaTTS3](https://github.com/bytedance/MegaTTS3), a Chinese/English PyTorch project with a 0.45B backbone. Its documented Python/Docker deployment is a computer/server route, not a drop-in iPhone browser package. It is not evidence that Douyin's production TTS weights are freely downloadable. Unofficial Edge-TTS wrappers also use an online service; “local UI” is not offline synthesis.

## Recommendation and evaluation

For a web app that must synthesize new words on the iPhone without a server, prototype wasmtts first and compare Hojo if quality is insufficient. For actual Douyin-branded voices, investigate the official Doubao service, accepting online generation; its native offline SDK is a separate product route. No option is yet established to meet all of Douyin voice quality, arbitrary input, low download size and offline Safari operation.

Before changing production audio:

1. Check the pinned code, model, vocoder, frontend and dictionary licences separately. A wrapper's MIT licence does not license every model asset.
2. Compare 妈/麻/马/骂, 买/卖 and 四/十 in isolation; neutral tones in 谢谢、什么、朋友; 你好 third-tone change; 一/不 tone changes; and polyphonic 行/银行、长/长大、重/重庆.
3. Compare normal daily conversation, JDM/model names, engineering vocabulary, internet slang, numbers, dates and Chinese/English mixtures. Test explicit pinyin overrides against the lesson pinyin.
4. Have the learner/native speaker hear the same samples across candidates. Speech-recognition accuracy and waveform validity do not establish tonal teaching correctness.
5. Measure first-download size, cold-start time, tap-to-audio delay, memory and battery impact on the actual iPhone; test offline after a restart and interrupted downloads.
6. Retain human isolated-tone examples as a reference. Cache any generated result by engine/model/voice/text/pronunciation, so later stories can reuse it without confusing different tones.

The initial research did not enable a replacement. The subsequent 0.4.1 trial is available at `dist/tts-lab/`: wasmtts v2.6.0 with a local voice pack, editable sample article, tone comparisons and explicit trial-only pronunciation overrides. Normal lessons continue using human recordings. See WASMTTS_TRIAL.md for setup, performance and verification limits.
