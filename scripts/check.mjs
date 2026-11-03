import { readFileSync, statSync } from "node:fs";

const required = [
  "dist/index.html", "dist/styles.css", "dist/app.js", "dist/speech.js", "dist/sw.js",
  "dist/manifest.webmanifest", "dist/data/stories.json", "dist/audio/manifest.json", "dist/vendor/howler.core.min.js",
  "dist/icons/icon.svg", "dist/icons/icon-180.png", "dist/icons/icon-512.png"
];

for (const file of required) {
  if (statSync(file).size === 0) throw new Error(`${file} is empty`);
}

const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
if (manifest.display !== "standalone") throw new Error("PWA display mode must be standalone");
if (!manifest.icons.some((icon) => icon.sizes === "180x180")) throw new Error("Missing iPhone Home Screen icon");

const { stories } = JSON.parse(readFileSync("dist/data/stories.json", "utf8"));
if (stories.length < 14) throw new Error("Library must contain at least fourteen stories and guided lessons");
for (const story of stories) {
  if (!story.paragraphs?.length || !story.quiz?.options?.length) throw new Error(`Incomplete story: ${story.id}`);
  const words = story.paragraphs.flatMap((paragraph) => paragraph.tokens).filter((token) => !token.punct);
  if (words.some((word) => !word.h || !word.p || !word.e)) throw new Error(`Incomplete vocabulary in: ${story.id}`);
}

console.log(`Hanzi Path checks passed: ${stories.length} stories, PWA manifest, icons, and offline shell.`);
