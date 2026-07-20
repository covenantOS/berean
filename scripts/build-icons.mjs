#!/usr/bin/env node
/**
 * Rasterize the Berean leaded-window mark into the PNG icon set the PWA
 * manifest needs. Pure Node: the mark is simple geometry (an arched window,
 * four stained panes, lead lines) drawn per pixel and encoded as PNG with
 * zlib, so the set is reproducible and carries no external assets.
 *
 * Output: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
 * (full-bleed, window inside the safe zone), apple-touch-icon.png (180),
 * plus the Tauri bundle set under desktop/src-tauri/icons. The vector
 * originals live at public/icons/icon.svg and src/app/icon.svg.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "icons");

// Design tokens from src/app/globals.css.
const PAPER = [0xf3, 0xec, 0xdd];
const INK = [0x26, 0x20, 0x16];
const PANES = {
  sapphire: [0x2d, 0x59, 0x77],
  ruby: [0x7d, 0x2d, 0x3e],
  amber: [0xa9, 0x7a, 0x1f],
  emerald: [0x3d, 0x6b, 0x52],
};

// Window geometry in unit-canvas fractions: straight sides below the arch,
// a semicircular head. The lead cross splits the interior into four panes.
const WIN = { cx: 0.5, half: 0.293, archY: 0.402, baseY: 0.84, frame: 0.027, lead: 0.014, midY: 0.621 };

function pixel(u, v, scale) {
  // scale < 1 shrinks the window about center (maskable safe zone).
  const cx = WIN.cx;
  const cy = (WIN.archY + WIN.baseY) / 2;
  const x = cx + (u - cx) / scale;
  const y = cy + (v - cy) / scale;
  const dx = x - cx;
  let d; // distance from the window boundary, negative outside
  if (y <= WIN.archY) {
    d = WIN.half - Math.hypot(dx, y - WIN.archY);
  } else {
    d = Math.min(WIN.half - Math.abs(dx), WIN.baseY - y);
  }
  if (d < 0) return PAPER;
  if (d < WIN.frame) return INK;
  if (Math.abs(dx) < WIN.lead || (y > WIN.archY && Math.abs(y - WIN.midY) < WIN.lead)) return INK;
  if (y <= WIN.midY) return dx < 0 ? PANES.sapphire : PANES.ruby;
  return dx < 0 ? PANES.amber : PANES.emerald;
}

// -- Minimal PNG encoder: RGBA scanlines, filter 0, zlib deflate. ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(head));
  return Buffer.concat([len, head, crc]);
}
function encodePng(size, scale) {
  const SS = 2; // supersampling factor for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, scale);
          acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
        }
      }
      raw[o++] = acc[0] / (SS * SS);
      raw[o++] = acc[1] / (SS * SS);
      raw[o++] = acc[2] / (SS * SS);
      raw[o++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  // Maskable: full-bleed paper, window at 80% so the safe-zone crop holds.
  ["icon-maskable-512.png", 512, 0.8],
  ["apple-touch-icon.png", 180, 1],
];
for (const [name, size, scale] of targets) {
  const png = encodePng(size, scale);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`${name}: ${size}x${size}, ${png.length} bytes`);
}

// -- Tauri bundle icons: desktop/src-tauri/icons. ---------------------------
// The names match bundle.icon in desktop/src-tauri/tauri.conf.json, which is
// the set Tauri 2 bundling expects (icon.png is the 512px source the Linux
// bundles and `tauri icon` regeneration use). The Square*Logo.png Store set
// is skipped on purpose: it only matters to MSIX packaging, and the shell
// ships NSIS.
const TAURI_OUT = path.join(ROOT, "desktop", "src-tauri", "icons");
fs.mkdirSync(TAURI_OUT, { recursive: true });
const tauriTargets = [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["icon.png", 512],
];
for (const [name, size] of tauriTargets) {
  const png = encodePng(size, 1);
  fs.writeFileSync(path.join(TAURI_OUT, name), png);
  console.log(`desktop/src-tauri/icons/${name}: ${size}x${size}, ${png.length} bytes`);
}

// icon.ico carries the same mark as PNG-in-ICO frames: each directory entry
// points at a complete PNG, which Windows has accepted since Vista and the
// NSIS bundler passes through untouched. Width and height bytes are 0 for
// the 256px frame, per the ICO format.
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const frames = ICO_SIZES.map((size) => ({ size, png: encodePng(size, 1) }));
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: icon
icoHeader.writeUInt16LE(frames.length, 4);
const icoDir = Buffer.alloc(16 * frames.length);
let frameOffset = icoHeader.length + icoDir.length;
frames.forEach((frame, i) => {
  const o = i * 16;
  icoDir[o] = frame.size === 256 ? 0 : frame.size;
  icoDir[o + 1] = frame.size === 256 ? 0 : frame.size;
  icoDir[o + 2] = 0; // palette colors: none
  icoDir[o + 3] = 0; // reserved
  icoDir.writeUInt16LE(1, o + 4); // color planes
  icoDir.writeUInt16LE(32, o + 6); // bits per pixel
  icoDir.writeUInt32LE(frame.png.length, o + 8);
  icoDir.writeUInt32LE(frameOffset, o + 12);
  frameOffset += frame.png.length;
});
const ico = Buffer.concat([icoHeader, icoDir, ...frames.map((f) => f.png)]);
fs.writeFileSync(path.join(TAURI_OUT, "icon.ico"), ico);
console.log(`desktop/src-tauri/icons/icon.ico: ${frames.length} frames (${ICO_SIZES.join(", ")}), ${ico.length} bytes`);
