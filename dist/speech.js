// Human recordings only. No synthesis, device voice, or generated-audio fallback.
import { pronunciationKey } from "./pronunciation.js?v=human-2";
export { pronunciationKey } from "./pronunciation.js?v=human-2";
export class MandarinPlayer {
  constructor({ Howl, onChange, schedule = (fn, delay) => setTimeout(fn, delay), unschedule = (id) => clearTimeout(id) }) {
    Object.assign(this, { Howl, onChange, schedule, unschedule });
    this.clips = {};
    this.current = null;
    this.timer = null;
  }

  setClips(clips) {
    this.clips = Object.fromEntries(Object.entries(clips).filter(([, clip]) => clip.type === "human" && clip.format === "mp3" && /^audio\/human\/[a-f0-9]{24}\.mp3$/.test(clip.src)));
  }
  getClip(text, pinyin) { return this.clips[pronunciationKey(text, pinyin)]; }
  hasRecording(text, pinyin) { return Boolean(this.getClip(text, pinyin)); }

  stop() {
    this.unschedule(this.timer);
    const previous = this.current;
    this.current = null;
    previous?.sound?.stop();
    previous?.sound?.unload();
    this.onChange({ status: "idle", text: "", key: "", message: "Human recordings only. Tap an available speaker to listen." });
  }

  play(text, pinyin = "") {
    const key = pronunciationKey(text, pinyin);
    if (this.current?.key === key) { this.stop(); return; }
    this.stop();
    const clip = this.getClip(text, pinyin);
    if (!clip || !this.Howl) {
      this.onChange({ status: clip ? "error" : "unavailable", text, key, message: clip ? "The audio player could not load. Reload the app and try again." : "No human recording for this pronunciation yet." });
      return;
    }
    const request = { text, key, sound: null };
    this.current = request;
    const finish = (status, message) => {
      if (this.current !== request) return;
      this.unschedule(this.timer);
      this.current = null;
      request.sound?.unload();
      this.onChange({ status, text, key, message });
    };
    this.onChange({ status: "loading", text, key, message: "Loading human recording…" });
    this.timer = this.schedule(() => finish("error", "Audio took too long to load. Please try again."), 15000);
    try {
      request.sound = new this.Howl({
        src: [new URL(clip.src, import.meta.url).href],
        format: ["mp3"],
        volume: 1,
        onplay: () => {
          if (this.current !== request) return;
          this.unschedule(this.timer);
          this.onChange({ status: "playing", text, key, message: "Playing human recording… Tap again to stop." });
        },
        onend: () => finish("idle", "Audio finished. Tap to replay."),
        onloaderror: () => finish("error", "The recording could not load. Open the app online once to download its audio, then try again."),
        onplayerror: () => finish("error", "Playback was blocked. Tap the speaker again to retry, and check your device volume."),
      });
      if (this.current === request) request.sound.play();
      else request.sound.unload();
    } catch { finish("error", "Audio could not start. Tap the speaker to retry."); }
  }
}
