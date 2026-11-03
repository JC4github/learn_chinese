const CACHE_NAME = "hanzi-path-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=lessons-1",
  "./app.js",
  "./speech.js",
  "./app.js?v=recordings-1",
  "./app.js?v=lessons-1",
  "./speech.js?v=recordings-1",
  "./vendor/howler.core.min.js",
  "./audio/manifest.json",
  "./audio/manifest.json?v=lessons-1",
  "./manifest.webmanifest",
  "./data/stories.json",
  "./data/stories.json?v=lessons-1",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-512.png"
];
const assetUrls = new Set(APP_SHELL.map((path) => new URL(path, self.location.href).href));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    const manifest = await (await cache.match("./audio/manifest.json")).json();
    await cache.addAll(Object.values(manifest.clips).map((clip) => new URL(clip.src, self.location.href).href));
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
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }
  const isAudio = event.request.url.startsWith(new URL("./audio/", self.location.href).href) && /\/[a-f0-9]{24}\.wav$/.test(event.request.url);
  if (!assetUrls.has(event.request.url) && !isAudio) return;
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
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
    "Content-Type": "audio/wav", "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}`,
    "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1),
  } });
}
