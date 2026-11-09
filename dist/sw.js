const CACHE_NAME = "hanzi-path-v25";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=icon-1",
  "./app.js",
  "./speech.js",
  "./app.js?v=icon-1",
  "./reading-audio.js?v=reading-2",
  "./reading-voice.js?v=reading-2",
  "./pronunciation.js?v=reading-2",
  "./reading-worker.js?v=reading-2",
  "./tts-lab/worker.js",
  "./tts-lab/asset-chunks.js",
  "./tts-lab/audio-utils.js",
  "./tts-lab/vendor/matcha-producer.mjs",
  "./tts-lab/vendor/matcha-worker.js",
  "./tts-lab/vendor/matcha-engine.js",
  "./tts-lab/vendor/matcha-frontend.js",
  "./tts-lab/vendor/matcha-taiwan-profile.js",
  "./tts-lab/vendor/kaldifst-normalizer.js",
  "./tts-lab/vendor/matcha-synthesis.js",
  "./tts-lab/vendor/matcha-kaldifst-normalizer.js",
  "./tts-lab/vendor/matcha-kaldifst-normalizer.wasm",
  "./tts-lab/vendor/matcha-profile.runtime.json",
  "./tts-lab/vendor/matcha-assets.json",
  "./tts-lab/credits.html",
  "./tts-lab/runtime/ort-1.27.0-wasm.min.js",
  "./tts-lab/runtime/ort-1.27.0-wasm-simd-threaded.mjs",
  "./tts-lab/runtime/lamejs-1.2.1.min.js",
  "./speech.js?v=human-2",
  "./pronunciation.js",
  "./pronunciation.js?v=human-2",
  "./vendor/howler.core.min.js",
  "./audio/manifest.json",
  "./audio/manifest.json?v=human-2",
  "./audio/credits.html",
  "./audio/SOURCES.md",
  "./manifest.webmanifest",
  "./manifest.webmanifest?v=icon-1",
  "./data/stories.json",
  "./data/stories.json?v=human-2",
  "./icons/icon-lu.svg",
  "./icons/icon-lu-180.png",
  "./icons/icon-lu-192.png",
  "./icons/icon-lu-512.png"
];
const assetUrls = new Set(APP_SHELL.map((path) => new URL(path, self.location.href).href));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    const manifest = await (await cache.match("./audio/manifest.json")).json();
    if (manifest.mode !== "human-only" || Object.values(manifest.clips).some(clip => clip.type !== "human")) throw new Error("Human recording manifest required");
    await cache.addAll([...new Set(Object.values(manifest.clips).map((clip) => new URL(clip.src, self.location.href).href))]);
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("hanzi-path-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }).catch(() => caches.open(CACHE_NAME).then((cache) => cache.match("./index.html"))));
    return;
  }
  const audioBase = new URL("./audio/", self.location.href).href;
  if (event.request.url.startsWith(audioBase) && /\/[a-f0-9]{24}\.wav$/.test(event.request.url)) {
    event.respondWith(Promise.resolve(new Response(null, { status: 410 })));
    return;
  }
  const isAudio = event.request.url.startsWith(new URL("./audio/human/", self.location.href).href) && /\/[a-f0-9]{24}\.mp3$/.test(event.request.url);
  if (!assetUrls.has(event.request.url) && !isAudio) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(event.request)).then(async (cached) => {
      if (!cached) return fetch(event.request);
      // Safari's HTML5 audio fallback may request only bytes 0-1 to probe a file.
      const range = event.request.headers?.get("Range");
      if (!isAudio || !range) return cached;
      return audioRangeResponse(range, cached);
    })
  );
});

async function audioRangeResponse(range, cached) {
  const bytes = await cached.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const invalid = () => new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.byteLength}` } });
  if (!match || (!match[1] && !match[2])) return invalid();
  const start = match[1] ? Number(match[1]) : Math.max(0, bytes.byteLength - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
  if (start > end || start >= bytes.byteLength) return invalid();
  return new Response(bytes.slice(start, end + 1), { status: 206, headers: {
    "Content-Type": "audio/mpeg", "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}`,
    "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1),
  } });
}
