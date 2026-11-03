"""Generate bundled Mandarin clips locally. No speech service is used at runtime.

Install sherpa-onnx==2.0.1 and numpy in a virtual environment. Download the
official kokoro-int8-multi-lang-v1_1 archive to work/ and extract it there.
Run this script from the project root. --limit 1 generates a quick sample.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import sherpa_onnx

parser = argparse.ArgumentParser()
parser.add_argument("--limit", type=int)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
model = root / "work/kokoro-int8-multi-lang-v1_1"
output = root / "dist/audio"
output.mkdir(parents=True, exist_ok=True)
stories = json.loads((root / "dist/data/stories.json").read_text(encoding="utf-8"))["stories"]
texts = []
for story in stories:
    tokens = [token for paragraph in story["paragraphs"] for token in paragraph["tokens"]]
    texts.extend(token["h"] for token in tokens if not token.get("punct"))
    texts.append("".join(token["h"] for token in tokens))
texts = list(dict.fromkeys(texts))

config = sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(
        kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
            model=str(model / "model.int8.onnx"),
            voices=str(model / "voices.bin"),
            tokens=str(model / "tokens.txt"),
            lexicon=str(model / "lexicon-zh.txt"),
        ),
        num_threads=4, provider="cpu", debug=False,
    ),
    max_num_sentences=1,
)
if not config.validate():
    raise RuntimeError("The offline voice model configuration is invalid")
tts = sherpa_onnx.OfflineTts(config)
generation = sherpa_onnx.GenerationConfig()
generation.sid = 3  # zf_001: Mandarin female, per the official model speaker map.
generation.speed = 0.86
generation.silence_scale = 0.2
manifest = {"version": 1, "engine": "Kokoro-82M-v1.1-zh (int8)", "voice": "zf_001", "clips": {}}

for index, text in enumerate(texts[:args.limit] if args.limit else texts, start=1):
    name = hashlib.sha256(("kokoro-v1.1-zf001-speed086:" + text).encode()).hexdigest()[:24] + ".wav"
    path = output / name
    if not path.exists():
        audio = tts.generate(text, generation)
        samples = np.asarray(audio.samples)
        if samples.size == 0 or not np.isfinite(samples).all() or np.max(np.abs(samples)) < .001:
            raise RuntimeError(f"Empty or silent output for item {index}")
        if not sherpa_onnx.write_wave(str(path), samples, audio.sample_rate):
            raise RuntimeError(f"Could not write item {index}")
    import wave
    with wave.open(str(path), "rb") as wav:
        duration = wav.getnframes() / wav.getframerate()
    manifest["clips"][text] = {"src": "audio/" + name, "duration": round(duration, 3)}
    print(f"Audio {index}/{len(texts)}: {duration:.2f}s", flush=True)

if not args.limit:
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Complete: {len(texts)} clips, {sum(p.stat().st_size for p in output.glob('*.wav')):,} bytes", flush=True)
