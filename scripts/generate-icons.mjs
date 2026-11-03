import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outputDirectory = resolve("dist/icons");
mkdirSync(outputDirectory, { recursive: true });

for (const size of [180, 512]) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const creamRadius = size * 0.32;
  const center = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const cornerDistance = Math.hypot(Math.max(Math.abs(x - center) - (center - radius), 0), Math.max(Math.abs(y - center) - (center - radius), 0));
      const outside = cornerDistance > radius;
      let color = outside ? [0, 0, 0, 0] : [23, 63, 56, 255];
      if (!outside && Math.hypot(x - center, y - size * 0.485) < creamRadius) color = [246, 240, 228, 255];

      const t = Math.max(0, Math.min(1, (x - size * 0.3) / (size * 0.4)));
      const pathY = size * (0.69 - 0.39 * t + 0.09 * Math.sin(t * Math.PI));
      if (!outside && x > size * 0.29 && x < size * 0.73 && Math.abs(y - pathY) < size * 0.038) color = [200, 107, 74, 255];
      if (!outside && Math.hypot(x - size * 0.72, y - size * 0.30) < size * 0.045) color = [217, 170, 85, 255];

      pixels[index] = color[0]; pixels[index + 1] = color[1]; pixels[index + 2] = color[2]; pixels[index + 3] = color[3];
    }
  }

  writeFileSync(resolve(outputDirectory, `icon-${size}.png`), encodePng(size, size, pixels));
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    scanlines[row] = 0;
    rgba.copy(scanlines, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0); typeBuffer.copy(output, 4); data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return output;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
