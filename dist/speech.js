// Bundled recordings, played with Howler. No operating-system speech voice needed.
export class MandarinPlayer {
  constructor({ Howl, onChange, schedule = (fn, delay) => setTimeout(fn, delay), unschedule = (id) => clearTimeout(id) }) {
    Object.assign(this, { Howl, onChange, schedule, unschedule });
    this.clips = {};
    this.current = null;
    this.timer = null;
  }

  setClips(clips) { this.clips = clips; }

  stop() {
    this.unschedule(this.timer);
    const previous = this.current;
    this.current = null;
    previous?.sound?.stop();
    previous?.sound?.unload();
    this.onChange({ status: "idle", text: "", message: "Tap the speaker to hear Mandarin." });
  }

  play(text) {
    if (this.current?.text === text) { this.stop(); return; }
    this.stop();
    const clip = this.clips[text];
    if (!clip || !this.Howl) {
      this.onChange({ status: "error", text, message: clip ? "The audio player could not load. Reload the app and try again." : "This word doesn't have a recording yet." });
      return;
    }
    const request = { text, sound: null };
    this.current = request;
    const finish = (status, message) => {
      if (this.current !== request) return;
      this.unschedule(this.timer);
      this.current = null;
      request.sound?.unload();
      this.onChange({ status, text, message });
    };
    this.onChange({ status: "loading", text, message: "Loading Mandarin recording…" });
    this.timer = this.schedule(() => finish("error", "Audio took too long to load. Please try again."), 15000);
    try {
      request.sound = new this.Howl({
        src: [new URL(clip.src, import.meta.url).href],
        format: ["wav"],
        volume: 1,
        onplay: () => {
          if (this.current !== request) return;
          this.unschedule(this.timer);
          this.onChange({ status: "playing", text, message: "Playing Mandarin recording… Tap again to stop." });
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
