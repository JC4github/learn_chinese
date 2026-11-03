"""Generate reusable Mandarin clips locally; no speech service is used at runtime.

Install scripts/requirements-audio.txt in a virtual environment and extract the
official Kokoro int8 v1.1 model in work/. --model-dir can reuse another local
copy. --workers 4 --threads 2 generates independent clips in parallel.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import wave

import numpy as np
import sherpa_onnx

tts = None
generation = None


def initialize_voice(model_path, threads):
    global tts, generation
    model = Path(model_path)
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=str(model / "model.int8.onnx"),
                voices=str(model / "voices.bin"),
                tokens=str(model / "tokens.txt"),
                lexicon=str(model / "lexicon-zh.txt"),
            ),
            num_threads=threads, provider="cpu", debug=False,
        ),
        max_num_sentences=1,
    )
    if not config.validate():
        raise RuntimeError("The offline voice model configuration is invalid")
    tts = sherpa_onnx.OfflineTts(config)
    generation = sherpa_onnx.GenerationConfig()
    generation.sid = 3  # zf_001: Mandarin female, official model speaker map.
    generation.speed = 0.86
    generation.silence_scale = 0.2


def clip_duration(path):
    try:
        with wave.open(str(path), "rb") as wav:
            frames = wav.getnframes()
            if frames <= 0 or len(wav.readframes(frames)) < frames * wav.getsampwidth() * wav.getnchannels():
                return None
            return frames / wav.getframerate()
    except (OSError, EOFError, wave.Error):
        return None


def generate_clip(text, filename):
    path = Path(filename)
    duration = clip_duration(path)
    if duration is not None:
        return duration
    audio = tts.generate(text, generation)
    samples = np.asarray(audio.samples)
    if samples.size == 0 or not np.isfinite(samples).all() or np.max(np.abs(samples)) < .001:
        raise RuntimeError(f"Empty or silent output for {text!r}")
    temporary = path.with_suffix(".tmp.wav")
    if not sherpa_onnx.write_wave(str(temporary), samples, audio.sample_rate):
        raise RuntimeError(f"Could not write {path.name}")
    temporary.replace(path)
    duration = clip_duration(path)
    if duration is None:
        raise RuntimeError(f"Invalid output for {path.name}")
    return duration


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--model-dir", type=Path)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args()
    if args.workers < 1 or args.threads < 1:
        parser.error("workers and threads must be positive")
    root = Path(__file__).resolve().parents[1]
    model = args.model_dir or root / "work/kokoro-int8-multi-lang-v1_1"
    output = root / "dist/audio"
    output.mkdir(parents=True, exist_ok=True)
    stories = json.loads((root / "dist/data/stories.json").read_text(encoding="utf-8-sig"))["stories"]
    texts = []
    for story in stories:
        tokens = [token for paragraph in story["paragraphs"] for token in paragraph["tokens"]]
        texts.extend(token["h"] for token in tokens if not token.get("punct"))
        texts.extend(sample["h"] for sample in story.get("coach", {}).get("practice", []))
        texts.append("".join(token["h"] for token in tokens))
    texts = list(dict.fromkeys(texts))
    selected = texts[:args.limit] if args.limit else texts
    manifest = {"version": 1, "engine": "Kokoro-82M-v1.1-zh (int8)", "voice": "zf_001", "clips": {}}
    pending = []
    for text in selected:
        name = hashlib.sha256(("kokoro-v1.1-zf001-speed086:" + text).encode()).hexdigest()[:24] + ".wav"
        path = output / name
        duration = clip_duration(path)
        manifest["clips"][text] = {"src": "audio/" + name, "duration": round(duration, 3) if duration else None}
        if duration is None:
            pending.append((text, path))
    reused = len(selected) - len(pending)
    print(f"Reusing {reused} clips; generating {len(pending)} with {args.workers} worker(s).", flush=True)
    if pending:
        with ProcessPoolExecutor(max_workers=args.workers, initializer=initialize_voice, initargs=(str(model), args.threads)) as pool:
            jobs = {pool.submit(generate_clip, text, str(path)): text for text, path in pending}
            for completed, job in enumerate(as_completed(jobs), start=1):
                text = jobs[job]
                duration = job.result()
                manifest["clips"][text]["duration"] = round(duration, 3)
                print(f"Generated {completed}/{len(pending)}: {duration:.2f}s", flush=True)
    if not args.limit:
        path = output / "manifest.json"
        temporary = output / "manifest.tmp.json"
        temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(path)
    print(f"Complete: {len(selected)} clips, {sum(path.stat().st_size for path in output.glob('*.wav')):,} bytes", flush=True)


if __name__ == "__main__":
    main()
