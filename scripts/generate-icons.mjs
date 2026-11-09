import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const iconDirectory = new URL("../dist/icons/", import.meta.url);
const logo = readFileSync(new URL("icon-lu.svg", iconDirectory));

for (const size of [180, 192, 512]) {
  const renderer = new Resvg(logo, {
    // Fill the corners so the device can apply its own icon shape.
    background: "#173f38",
    fitTo: { mode: "width", value: size },
  });
  writeFileSync(new URL(`icon-lu-${size}.png`, iconDirectory), renderer.render().asPng());
}
