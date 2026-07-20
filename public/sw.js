/*
 * Berean service worker: installable shell, offline core reading.
 *
 * Strategy:
 * - Documents (navigations): network-first, so a new deploy is never
 *   hidden behind a stale page; a cached copy or /offline.html answers
 *   when the network is gone.
 * - /_next/static and /icons: cache-first; the build hashes its assets,
 *   so a cached entry can never go stale.
 * - /api GET routes: cache-first with a network fill. The data behind
 *   them ships in the repo and changes only on deploy, and a VERSION bump
 *   purges every cache on activate, so staleness is bounded by release.
 * - Anything non-GET (the Scribe routes are POST) bypasses the worker.
 *
 * Precache: the app shell plus every KJV chapter from public/precache.json
 * (built by scripts/build-precache.mjs), so the installed app reads the
 * core canon offline from first launch. The rest of the library (word
 * apparatus, lexica, commentaries, translations) accumulates in the data
 * cache as it is used.
 *
 * VERSION: bump on every release that changes the shell or any data
 * payload, alongside public/precache.json's version when the core list
 * changes. Activate deletes every cache outside the current pair.
 */
const VERSION = "berean-v1";
const SHELL_CACHE = `berean-shell-${VERSION}`;
const DATA_CACHE = `berean-data-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URL = "/precache.json";
const CORE_CHUNK = 24;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll([OFFLINE_URL, PRECACHE_URL]);
      const manifest = await (await shell.match(PRECACHE_URL)).json();
      await shell.addAll(manifest.shell);
      // The KJV core: best effort per chunk, so one failed chapter never
      // blocks the install; a missed route is picked up at runtime instead.
      const data = await caches.open(DATA_CACHE);
      for (let i = 0; i < manifest.core.length; i += CORE_CHUNK) {
        await Promise.all(
          manifest.core.slice(i, i + CORE_CHUNK).map((url) => data.add(url).catch(() => {})),
        );
      }
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, DATA_CACHE]);
      for (const name of await caches.keys()) {
        if (!keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(cacheFirst(DATA_CACHE, request));
  } else {
    event.respondWith(cacheFirst(SHELL_CACHE, request));
  }
});

async function networkFirst(request) {
  const shell = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) shell.put(request, res.clone());
    return res;
  } catch {
    return (await shell.match(request)) || (await shell.match(OFFLINE_URL));
  }
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}
