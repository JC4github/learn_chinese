// Keep the utterance alive until it ends, and ignore events from cancelled requests.
export class MandarinPlayer {
  constructor({ synth, Utterance, onChange, schedule = (fn, delay) => setTimeout(fn, delay), unschedule = (id) => clearTimeout(id) }) {
    Object.assign(this, { synth, Utterance, onChange, schedule, unschedule });
    this.current = null;
    this.timer = null;
    this.synth?.getVoices();
    this.synth?.addEventListener?.("voiceschanged", () => this.synth.getVoices());
  }

  stop() {
    this.unschedule(this.timer);
    this.current = null;
    this.synth?.cancel();
    this.onChange({ status: "idle", text: "", message: "Audio stopped." });
  }

  play(text) {
    if (this.current?.text === text) { this.stop(); return; }
    this.stop();
    if (!this.synth || !this.Utterance) {
      this.onChange({ status: "error", text, message: "Audio is not supported in this browser." });
      return;
    }
    const voices = this.synth.getVoices();
    const language = (voice) => voice.lang.toLowerCase().replaceAll("_", "-");
    const mandarin = voices.filter((voice) => /^(zh-(cn|tw|sg)|cmn)(-|$)/.test(language(voice)) || language(voice) === "zh");
    const voice = mandarin.find((item) => language(item) === "zh-cn" && item.localService)
      || mandarin.find((item) => language(item) === "zh-cn")
      || mandarin.find((item) => item.localService) || mandarin[0];
    if (voices.length && !voice) {
      this.onChange({ status: "error", text, message: "No Mandarin voice is available. Add a Chinese (Mandarin) voice in your device settings, then try again." });
      return;
    }
    const utterance = new this.Utterance(text);
    utterance.lang = voice?.lang || "zh-CN";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.82;
    this.current = utterance;
    const finish = (status, message) => {
      if (this.current !== utterance) return;
      this.unschedule(this.timer);
      this.current = null;
      this.onChange({ status, text, message });
    };
    utterance.onstart = () => {
      if (this.current !== utterance) return;
      this.unschedule(this.timer);
      this.onChange({ status: "playing", text, message: "Playing Mandarin audio… Tap again to stop." });
    };
    utterance.onend = () => finish("idle", "Audio finished. Tap to replay.");
    utterance.onerror = (event) => finish("error", event.error === "network"
      ? "This voice needs an internet connection. Connect or install an offline Mandarin voice."
      : "Audio could not play. Check your device volume and Mandarin voice, then try again.");
    this.onChange({ status: "loading", text, message: "Preparing Mandarin audio…" });
    this.timer = this.schedule(() => {
      if (this.current !== utterance) return;
      finish("error", "Audio did not start. Check your device volume and Mandarin voice, then try again.");
      this.synth.cancel();
    }, 8000);
    try { this.synth.speak(utterance); } catch { finish("error", "Audio could not start in this browser. Please try again."); }
  }
}
