import { readFileSync, statSync } from "node:fs";

const required = [
  "dist/index.html", "dist/styles.css", "dist/app.js", "dist/speech.js", "dist/reading-audio.js", "dist/reading-voice.js", "dist/reading-worker.js", "dist/pronunciation.js", "dist/sw.js", "dist/audio/credits.html", "dist/audio/SOURCES.md",
  "dist/manifest.webmanifest", "dist/data/stories.json", "dist/audio/manifest.json", "dist/vendor/howler.core.min.js"
];

for (const file of required) {
  if (statSync(file).size === 0) throw new Error(`${file} is empty`);
}

const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
if (manifest.display !== "standalone") throw new Error("PWA display mode must be standalone");
const touchIcon = manifest.icons.find((icon) => icon.sizes === "180x180" && icon.type === "image/png");
const html = readFileSync("dist/index.html", "utf8");
if (!touchIcon || !html.includes(`rel="apple-touch-icon" href="${touchIcon.src}"`)) {
  throw new Error("The iPhone Home Screen icon must match the 180px manifest icon");
}
for (const { src, type, sizes } of manifest.icons) {
  const icon = readFileSync(new URL(src, new URL("../dist/", import.meta.url)));
  if (type !== "image/png") continue;
  const dimensions = `${icon.readUInt32BE(16)}x${icon.readUInt32BE(20)}`;
  if (dimensions !== sizes) throw new Error(`Incorrect icon size for ${src}: ${dimensions}`);
}

const { stories } = JSON.parse(readFileSync("dist/data/stories.json", "utf8"));
if (stories.length < 34) throw new Error("Library must contain at least thirty-four entries");
for (const story of stories) {
  if (!story.paragraphs?.length || !story.quiz?.options?.length) throw new Error(`Incomplete story: ${story.id}`);
  const words = story.paragraphs.flatMap((paragraph) => paragraph.tokens).filter((token) => !token.punct);
  if (words.some((word) => !word.h || !word.p || !word.e)) throw new Error(`Incomplete vocabulary in: ${story.id}`);
}

console.log(`Hanzi Path checks passed: ${stories.length} stories, PWA manifest, icons, and offline shell.`);
