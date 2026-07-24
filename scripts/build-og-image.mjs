#!/usr/bin/env node
/**
 * The landing's social preview card (1200x630): the leaded window mark at
 * center on the paper field with a sapphire frame. Pure Node, no assets, the
 * build-icons pipeline's encoder. Rebuild: node scripts/build-og-image.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "og-image.png");
const W = 1200, H = 630;

const PAPER = [0xf3, 0xec, 0xdd];
const INK = [0x26, 0x20, 0x16];
const SAPPHIRE = [0x2d, 0x59, 0x77];
const PANES = {
  sapphire: [0x2d, 0x59, 0x77],
  ruby: [0x7d, 0x2d, 0x3e],
  amber: [0xa9, 0x7a, 0x1f],
  emerald: [0x3d, 0x6b, 0x52],
};
const WIN = { half: 0.293, archY: 0.402, baseY: 0.84, frame: 0.027, lead: 0.014, midY: 0.621 };

function mark(u, v, cx, cy, scale) {
  const x = cx + (u - cx) / scale;
  const y = cy + (v - cy) / scale;
  const dx = x - cx;
  let d;
  if (y <= WIN.archY) d = WIN.half - Math.hypot(dx, y - WIN.archY);
  else d = Math.min(WIN.half - Math.abs(dx), WIN.baseY - y);
  if (d < 0) return PAPER;
  if (d < WIN.frame) return INK;
  if (Math.abs(dx) < WIN.lead || (y > WIN.archY && Math.abs(y - WIN.midY) < WIN.lead)) return INK;
  if (y <= WIN.midY) return dx < 0 ? PANES.sapphire : PANES.ruby;
  return dx < 0 ? PANES.amber : PANES.emerald;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const head = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(head));
  return Buffer.concat([len, head, crc]);
};

const SS = 2;
const raw = Buffer.alloc(H * (W * 4 + 1));
let o = 0;
for (let y = 0; y < H; y++) {
  raw[o++] = 0;
  for (let x = 0; x < W; x++) {
    const border = x < 10 || x >= W - 10 || y < 10 || y >= H - 10;
    const [r, g, b] = border
      ? SAPPHIRE
      : [0, 0, 0].map((_, i) => {
          let acc = 0;
          for (let sy = 0; sy < SS; sy++)
            for (let sx = 0; sx < SS; sx++) {
              const u = (x + (sx + 0.5) / SS) / W;
              const v = (y + (sy + 0.5) / SS) / H;
              acc += mark(u, v, 0.5, 0.5, 0.62)[i];
            }
          return Math.round(acc / (SS * SS));
        });
    raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = 255;
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(OUT, png);
console.log(`og-image.png: ${W}x${H}, ${(png.length / 1024).toFixed(0)}KB`);
