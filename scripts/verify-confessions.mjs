#!/usr/bin/env node
/**
 * Verification harness for the confessional corpus wave: every proof text
 * validates against the canon, the citation index resolves both ways, and
 * the Passage Guide's Confessional Documents section shows for cited
 * chapters and hides for uncited ones. Phase 1 checks the built data
 * against the shipped KJV text with no server; phase 2 boots the
 * standalone production server (run `npm run build` first) and asserts the
 * routes end to end, with a smoke pass over the old routes. The server
 * child is spawned here and killed here, on every exit path.
 *
 * Usage: node scripts/verify-confessions.mjs
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}`;

const checks = [];
let failures = 0;
function check(label, ok, detail) {
  checks.push({ label, ok });
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const CHAPTERS = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  joshua: 24, judges: 21, ruth: 4, "1-samuel": 31, "2-samuel": 24,
  "1-kings": 22, "2-kings": 25, "1-chronicles": 29, "2-chronicles": 36,
  ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150, proverbs: 31,
  ecclesiastes: 12, "song-of-solomon": 8, isaiah: 66, jeremiah: 52,
  lamentations: 5, ezekiel: 48, daniel: 12, hosea: 14, joel: 3, amos: 9,
  obadiah: 1, jonah: 4, micah: 7, nahum: 3, habakkuk: 3, zephaniah: 3,
  haggai: 2, zechariah: 14, malachi: 4, matthew: 28, mark: 16, luke: 24,
  john: 21, acts: 28, romans: 16, "1-corinthians": 16, "2-corinthians": 13,
  galatians: 6, ephesians: 6, philippians: 4, colossians: 4,
  "1-thessalonians": 5, "2-thessalonians": 3, "1-timothy": 6, "2-timothy": 4,
  titus: 3, philemon: 1, hebrews: 13, james: 5, "1-peter": 5, "2-peter": 3,
  "1-john": 5, "2-john": 1, "3-john": 1, jude: 1, revelation: 22,
};
const FILE_BY_SLUG = {};
for (const slug of Object.keys(CHAPTERS)) {
  FILE_BY_SLUG[slug] = slug.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}
FILE_BY_SLUG["song-of-solomon"] = "SongofSolomon";

const kjvCache = new Map();
async function kjvVerseSet(slug) {
  if (!kjvCache.has(slug)) {
    const raw = JSON.parse(
      await fs.readFile(path.join(ROOT, "data", "kjv", `${FILE_BY_SLUG[slug]}.json`), "utf8")
    );
    const set = new Set();
    for (const ch of raw.chapters) for (const v of ch.verses) set.add(`${ch.chapter}:${v.verse}`);
    kjvCache.set(slug, set);
  }
  return kjvCache.get(slug);
}

const DOC_IDS = ["apostles-creed", "nicene-creed", "chalcedon", "wsc", "lbc1689"];

/* ---------- phase 1: the data itself ---------- */

async function phase1() {
  const docs = {};
  for (const id of DOC_IDS) {
    docs[id] = JSON.parse(
      await fs.readFile(path.join(ROOT, "data", "confessions", `${id}.json`), "utf8")
    );
  }

  // Every proof text validates against the canon and the shipped KJV text.
  let refs = 0;
  const invalid = [];
  for (const id of DOC_IDS) {
    for (const s of docs[id].sections) {
      for (const p of s.proofs) {
        for (const r of p.refs) {
          refs++;
          const chapters = CHAPTERS[r.slug];
          if (!chapters || r.chapter < 1 || r.chapter > chapters) {
            invalid.push(`${id} ${s.id} ${p.mark}: bad chapter ${r.slug} ${r.chapter}`);
            continue;
          }
          if (r.from === undefined) continue;
          const set = await kjvVerseSet(r.slug);
          if (!set.has(`${r.chapter}:${r.from}`)) invalid.push(`${id} ${s.id} ${p.mark}: no verse ${r.slug} ${r.chapter}:${r.from}`);
          else if (r.to !== undefined && r.to !== r.from && !set.has(`${r.chapter}:${r.to}`)) {
            invalid.push(`${id} ${s.id} ${p.mark}: no verse ${r.slug} ${r.chapter}:${r.to}`);
          }
        }
      }
    }
  }
  check(`every proof text validates against the canon (${refs} refs)`, invalid.length === 0, invalid.slice(0, 4).join(" | "));

  // The index resolves both ways: independently recomputed from the data,
  // chapter -> articles and article -> passages agree.
  const chapterIndex = new Map();
  for (const id of DOC_IDS) {
    for (const s of docs[id].sections) {
      for (const p of s.proofs) {
        for (const r of p.refs) {
          const key = `${r.slug}:${r.chapter}`;
          if (!chapterIndex.has(key)) chapterIndex.set(key, new Set());
          chapterIndex.get(key).add(`${id}:${s.id}`);
        }
      }
    }
  }
  let bothWays = true;
  let detail = "";
  for (const id of DOC_IDS) {
    for (const s of docs[id].sections) {
      for (const p of s.proofs) {
        for (const r of p.refs) {
          if (!chapterIndex.get(`${r.slug}:${r.chapter}`)?.has(`${id}:${s.id}`)) {
            bothWays = false;
            detail = `${id}:${s.id} missing at ${r.slug}:${r.chapter}`;
          }
        }
      }
    }
  }
  for (const [key, sections] of chapterIndex) {
    const [slug, ch] = key.split(":");
    for (const tag of sections) {
      const [id, sid] = tag.split(":");
      const sec = docs[id].sections.find((s) => s.id === sid);
      const hit = sec?.proofs.some((p) => p.refs.some((r) => r.slug === slug && r.chapter === Number(ch)));
      if (!hit) {
        bothWays = false;
        detail = `${tag} indexed at ${key} without a matching proof`;
      }
    }
  }
  check("the index resolves both ways (article to passage, passage to article)", bothWays, detail);

  // Show and hide, data level: Romans 5 carries the known set; uncited
  // chapters answer empty.
  const romans5 = chapterIndex.get("romans:5");
  check(
    "Romans 5 resolves to its eleven citing articles",
    romans5?.size === 11 &&
      romans5.has("wsc:q18") &&
      romans5.has("lbc1689:ch6") &&
      romans5.has("lbc1689:ch11"),
    String(romans5?.size)
  );
  const uncited = [];
  for (const [slug, count] of Object.entries(CHAPTERS)) {
    for (let c = 1; c <= count; c++) {
      if (!chapterIndex.has(`${slug}:${c}`)) uncited.push(`${slug}:${c}`);
    }
  }
  check(
    "uncited chapters answer empty (Obadiah 1 among them)",
    uncited.length > 0 && uncited.includes("obadiah:1") && !chapterIndex.has("obadiah:1"),
    `${uncited.length} uncited chapters`
  );
  console.log(`  ${uncited.length} chapters carry no confessional citation (e.g. ${uncited.slice(0, 3).join(", ")})`);

  // The creeds ship without a proof apparatus, by design.
  const creedProofs = ["apostles-creed", "nicene-creed", "chalcedon"].reduce(
    (n, id) => n + docs[id].sections.reduce((m, s) => m + s.proofs.length, 0),
    0
  );
  check("the ecumenical creeds carry no proof list, as received", creedProofs === 0, String(creedProofs));
}

/* ---------- phase 2: the routes ---------- */

async function get(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  return { status: res.status, body: await res.text() };
}
async function getJson(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function phase2() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: STANDALONE,
    env: { ...process.env, PORT: String(PORT), HOSTNAME: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  child.stdout.on("data", (d) => (serverLog += d));
  child.stderr.on("data", (d) => (serverLog += d));

  try {
    const up = await waitForServer();
    if (!up) {
      check("standalone server boots", false, serverLog.slice(-500));
      return;
    }

    /* ---- the Passage Guide section, show and hide ---- */
    const cited = await getJson("/api/pane/guide?book=romans&chapter=5");
    check(
      "the guide composes Confessional Documents for a cited chapter",
      cited.status === 200 && Array.isArray(cited.json.confessions) && cited.json.confessions.length === 11,
      `status=${cited.status} rows=${cited.json?.confessions?.length}`
    );
    const q18 = cited.json?.confessions?.find((c) => c.work === "wsc" && c.sectionId === "q18");
    check(
      "the WSC row names the question and its references in the chapter",
      !!q18 && q18.label === "Question 18" && q18.refs.includes("Romans 5:12") && q18.refs.includes("Romans 5:19"),
      JSON.stringify(q18)
    );
    const ch6 = cited.json?.confessions?.find((c) => c.work === "lbc1689" && c.sectionId === "ch6");
    check(
      "the 1689 row names the chapter and its references",
      !!ch6 && ch6.label === "Chapter 6" && ch6.refs.some((r) => r.startsWith("Romans 5:12")),
      JSON.stringify(ch6)
    );
    check(
      "no creed answers a passage (no proof apparatus)",
      cited.json?.confessions?.every((c) => c.kind !== "creed") === true,
      ""
    );
    const hidden = await getJson("/api/pane/guide?book=obadiah&chapter=1");
    check(
      "the section hides for an uncited chapter",
      hidden.status === 200 && Array.isArray(hidden.json.confessions) && hidden.json.confessions.length === 0,
      `status=${hidden.status} rows=${hidden.json?.confessions?.length}`
    );

    /* ---- the reader's corpus routes ---- */
    const list = await getJson("/api/pane/confession");
    check(
      "the corpus list serves the five works with counts",
      list.status === 200 && list.json.works.length === 5 && list.json.works.every((w) => w.sections > 0),
      JSON.stringify(list.json?.works?.map((w) => [w.id, w.sections]))
    );
    const wsc = await getJson("/api/pane/confession?doc=wsc");
    check(
      "the catechism serves 107 questions with proofs",
      wsc.status === 200 &&
        wsc.json.sections.length === 107 &&
        wsc.json.sections[0].proofs.length === 2 &&
        wsc.json.sections[0].paragraphs[0].includes("glorify God"),
      `sections=${wsc.json?.sections?.length}`
    );
    const bcf = await getJson("/api/pane/confession?doc=lbc1689");
    check(
      "the confession serves 32 chapters with proofs, epistle, appendix, subscription",
      bcf.status === 200 &&
        bcf.json.sections.length === 32 &&
        bcf.json.sections.reduce((n, s) => n + s.proofs.length, 0) === 495 &&
        bcf.json.frontMatter.length === 1 &&
        bcf.json.backMatter.length === 2,
      `sections=${bcf.json?.sections?.length} proofs=${bcf.json?.sections?.reduce((n, s) => n + s.proofs.length, 0)}`
    );
    const chalcedon = await getJson("/api/pane/confession?doc=chalcedon");
    check(
      "Chalcedon serves its definition without a proof apparatus",
      chalcedon.status === 200 &&
        chalcedon.json.sections.length === 4 &&
        chalcedon.json.sections.every((s) => s.proofs.length === 0),
      `sections=${chalcedon.json?.sections?.length}`
    );
    const bogus = await getJson("/api/pane/confession?doc=book-of-mormon");
    check("an unknown document answers 404", bogus.status === 404, `status=${bogus.status}`);

    /* ---- the Topic Guide join ---- */
    const topic = await getJson("/api/pane/topicguide?work=naves&id=faith");
    check(
      "the Topic Guide joins confessional articles on shared passages",
      topic.status === 200 &&
        Array.isArray(topic.json.confessions) &&
        topic.json.confessions.length > 0 &&
        topic.json.confessions.every((c) => c.shared > 0),
      `rows=${topic.json?.confessions?.length}`
    );
    const topicJoinRow = topic.json?.confessions?.[0];
    check(
      "the join names its articles and counts",
      !!topicJoinRow && typeof topicJoinRow.label === "string" && typeof topicJoinRow.shared === "number",
      JSON.stringify(topicJoinRow)
    );

    /* ---- old routes untouched ---- */
    const guide = await getJson("/api/pane/guide?book=john&chapter=3");
    check(
      "the guide still composes its other sections",
      guide.status === 200 && Array.isArray(guide.json.commentary) && Array.isArray(guide.json.crossRefs) && Array.isArray(guide.json.topics),
      `status=${guide.status}`
    );
    const chapter = await getJson("/api/pane/chapter?book=john&chapter=1");
    check("the chapter route still answers", chapter.status === 200 && Array.isArray(chapter.json.verses), `status=${chapter.status}`);
    const sources = await get("/sources");
    check(
      "the sources page lists the confessional corpus",
      sources.status === 200 && sources.body.includes("Westminster Shorter Catechism") && sources.body.includes("London Baptist Confession"),
      `status=${sources.status}`
    );
    const workspace = await get("/workspace");
    check("the workspace still renders", workspace.status === 200, `status=${workspace.status}`);
  } finally {
    child.kill();
  }
}

await phase1();
await phase2();
console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
process.exit(failures === 0 ? 0 : 1);
