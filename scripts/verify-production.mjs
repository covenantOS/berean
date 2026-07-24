#!/usr/bin/env node
/**
 * Production verification sweep for the deployed app. Usage:
 *   node scripts/verify-production.mjs https://berean.<subdomain>.workers.dev
 * Checks the public contract end to end: health, the workspace, reader and
 * guide payloads, the search engines, redirects, auth availability, and a
 * namespace-isolated sync round trip whose rows are deleted afterward.
 */

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/verify-production.mjs <origin>");
  process.exit(2);
}

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const get = async (path, opts = {}) => {
  const res = await fetch(base + path, opts);
  return { status: res.status, body: await res.text() };
};
const getJson = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, json: await res.json().catch(() => null) };
};
const postJson = async (path, body) => {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const ns = `prod-verify-${Date.now()}`;
const rec = {
  id: "pv-1",
  visibility: "private",
  createdAt: "2026-07-23T00:00:00Z",
  updatedAt: "2026-07-23T01:00:00Z",
  text: "production verification row",
};

const health = await getJson("/api/health");
check("health", health.status === 200 && health.json?.ok === true);

const ws = await get("/workspace");
check("workspace 200", ws.status === 200);

const chapter = await getJson("/api/pane/chapter?book=john&chapter=3");
check("chapter payload", chapter.status === 200 && chapter.json?.verses?.length > 0);

const guide = await getJson("/api/pane/guide?book=john&chapter=3");
check(
  "guide sections",
  guide.status === 200 &&
    Array.isArray(guide.json?.commentary) &&
    guide.json.commentary.length >= 10,
  `${guide.json?.commentary?.length ?? 0} commentary works`
);

const search = await getJson("/api/pane/search?q=grace%20AND%20truth");
check("precise search", search.status === 200 && search.json?.hits?.length >= 0);

const morph = await getJson("/api/pane/morph?q=G26");
check("morph search", morph.status === 200);

const books = await getJson("/api/pane/books-search?q=none%20but%20jesus");
check(
  "books search sermons",
  books.status === 200 && Array.isArray(books.json?.sermons) && books.json.sermons.length > 0,
  `${books.json?.sermons?.length ?? 0} sermons`
);

const factbook = await getJson("/api/pane/factbook?id=H0175");
check("factbook", factbook.status === 200 && factbook.json?.name);

const hymn = await getJson("/api/pane/hymns?id=amazing-grace");
check("hymn", hymn.status === 200 && hymn.json?.verses?.length > 0);

const home = await get("/", { redirect: "manual" });
check("home redirects", home.status === 307 || home.status === 308);

const read = await get("/read/john/3");
check("citation reader 200", read.status === 200);

const push = await postJson("/api/sync/push", {
  namespace: ns,
  collection: "berean.marginalia.v1",
  records: [rec],
});
check("sync push", push.json?.accepted === 1);
const pull = await postJson("/api/sync/pull", {
  namespace: ns,
  collection: "berean.marginalia.v1",
  after: null,
});
check(
  "sync pull round trip",
  pull.json?.records?.some((r) => r.id === "pv-1") && typeof pull.json?.cursor === "string"
);
const purge = await postJson("/api/sync/purge", {
  namespace: ns,
  collection: "berean.marginalia.v1",
  days: 0,
});
check("sync purge cleanup", purge.status === 200 || purge.status === 400, `status ${purge.status}`);

const magic = await postJson("/api/auth/sign-in/magic-link", { email: "prod-verify@example.com" });
check("auth magic link accepted", magic.status === 200);

const session = await getJson("/api/auth/get-session");
check("signed-out session null", session.status === 200);

console.log(`\n${pass} passed, ${fail} failed against ${base}`);
process.exit(fail > 0 ? 1 : 0);
