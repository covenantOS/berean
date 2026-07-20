#!/usr/bin/env node
/**
 * Point the desktop shell at a server and keep the CSP in step.
 *
 *   node scripts/set-tauri-url.mjs https://berean.example.com
 *   BEREAN_URL=https://berean.example.com node scripts/set-tauri-url.mjs
 *
 * Rewrites build.devUrl, build.frontendDist, app.windows[0].url, and the
 * deployed origin inside app.security.csp in desktop/src-tauri/tauri.conf.json
 * so the four never drift apart. The URL is compiled into the installer at
 * cargo tauri build time, so run this before building a release.
 *
 * HTTPS is required for anything but localhost: the shell inherits the PWA
 * posture, where install and the offline worker only activate on a secure
 * origin (DEPLOY.md).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONF = path.join(ROOT, "desktop", "src-tauri", "tauri.conf.json");

const input = process.argv[2] ?? process.env.BEREAN_URL;
if (!input) {
  console.error("usage: node scripts/set-tauri-url.mjs <url>   (or set BEREAN_URL)");
  process.exit(1);
}
let url;
try {
  url = new URL(input);
} catch {
  console.error(`refusing: "${input}" is not a parseable URL`);
  process.exit(1);
}
const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
if (url.protocol !== "https:" && !isLocal) {
  console.error(`refusing: ${url.origin} is not HTTPS (localhost is exempt, for dev)`);
  process.exit(1);
}
const origin = url.origin;

// The policy for the thin shell. default-src admits the shell's own protocol
// and the deployed origin; data: and blob: in img-src cover the generated
// SVG selection cards and the blob downloads; media-src admits archive.org,
// which streams the LibriVox chapter audio; connect-src keeps the Tauri IPC
// bridge (ipc:, http://ipc.localhost) working under a custom policy, as the
// Tauri 2 security docs require. script/style keep 'unsafe-inline' because
// the served Next.js app hydrates from inline scripts and inline styles.
function cspFor(origin) {
  return [
    `default-src 'self' ${origin}`,
    `script-src 'self' 'unsafe-inline' ${origin}`,
    `style-src 'self' 'unsafe-inline' ${origin}`,
    `img-src 'self' data: blob: ${origin}`,
    `font-src 'self' data: ${origin}`,
    `media-src ${origin} https://archive.org https://*.archive.org`,
    `connect-src 'self' ${origin} ipc: http://ipc.localhost`,
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

const conf = JSON.parse(fs.readFileSync(CONF, "utf8"));
conf.build.devUrl = origin;
conf.build.frontendDist = origin;
conf.app.windows[0].url = origin;
conf.app.security.csp = cspFor(origin);
fs.writeFileSync(CONF, JSON.stringify(conf, null, 2) + "\n");
console.log(`tauri.conf.json: shell now targets ${origin} (devUrl, frontendDist, window url, CSP origin)`);
