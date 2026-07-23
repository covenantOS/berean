#!/usr/bin/env node
/**
 * Verification harness for the canonical topic alignment wave: the
 * alignment table is internally sound (ids exist, both sides carry
 * references, section labels appear in the Nave entry, no duplicate rows),
 * the hand-reviewed aliases hold, and the Topic Guide route composes the
 * canonical view end to end. Phase 1 checks the built data with no server;
 * phase 2 boots the standalone production server (run `npm run build`
 * first) and asserts the route, with a smoke pass over the old routes.
 * The server child is spawned here and killed here, on every exit path.
 *
 * Usage: node scripts/verify-topics-alignment.mjs
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ALIAS, toks, countRefs, sectionLabels } from "./build-topics-alignment.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const PORT = 4322;
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
function check(label, ok, detail) {
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

async function phase1() {
  const naves = JSON.parse(await fs.readFile(path.join(ROOT, "data", "topics", "naves.json"), "utf8"));
  const torreys = JSON.parse(await fs.readFile(path.join(ROOT, "data", "topics", "torreys.json"), "utf8"));
  const alignment = JSON.parse(await fs.readFile(path.join(ROOT, "data", "topics", "alignment.json"), "utf8"));
  const naveById = new Map(naves.topics.map((t) => [t.id, t]));
  const torreyById = new Map(torreys.topics.map((t) => [t.id, t]));
  const rows = alignment.rows;

  check("alignment rows present", rows.length >= 400, `${rows.length} rows`);

  const badIds = rows.filter((r) => !naveById.get(r.naves) || !torreyById.get(r.torreys));
  check("every row id exists in its work", badIds.length === 0, badIds.map((r) => r.torreys).join(","));

  const emptySide = rows.filter(
    (r) => countRefs(naveById.get(r.naves) ?? { children: [] }) === 0 || countRefs(torreyById.get(r.torreys) ?? { children: [] }) === 0
  );
  check("no row points at an empty shell", emptySide.length === 0, emptySide.map((r) => r.torreys).join(","));

  const torreyIds = rows.map((r) => r.torreys);
  check("no Torrey id in two rows", new Set(torreyIds).size === torreyIds.length);
  const pairKeys = rows.map((r) => `${r.naves}::${r.torreys}`);
  check("no duplicated pair", new Set(pairKeys).size === pairKeys.length);

  const badSections = rows.filter((r) => {
    if (r.kind !== "section") return false;
    const n = naveById.get(r.naves);
    return !n || !sectionLabels(n).some((l) => l.includes(r.section));
  });
  check("every section label appears in the Nave entry", badSections.length === 0, badSections.map((r) => r.torreys).join(","));

  const badCanonical = rows.filter((r) => typeof r.canonical !== "string" || r.canonical.trim().length === 0);
  check("every row carries a canonical name", badCanonical.length === 0);

  const nonAliasEntry = rows.filter((r) => r.kind === "entry" && !ALIAS[r.torreys]);
  const drifted = nonAliasEntry.filter(
    (r) => toks(naveById.get(r.naves).title) !== toks(torreyById.get(r.torreys).title)
  );
  check("computed entry rows still match on token key", drifted.length === 0, drifted.map((r) => r.torreys).join(","));

  const aliasCovered = Object.keys(ALIAS).filter((id) => rows.some((r) => r.torreys === id));
  check("every hand alias landed in the table", aliasCovered.length === Object.keys(ALIAS).length,
    `${aliasCovered.length}/${Object.keys(ALIAS).length}`);

  // Spot assertions on reviewed rows.
  const row = (id) => rows.find((r) => r.torreys === id);
  check("angels aligns to Nave's angel (a spirit)", row("angels")?.naves === "angel-a-spirit");
  check("ministers aligns to Nave's minister, christian", row("ministers")?.naves === "minister-christian");
  check("the new birth aligns to regeneration", row("new-birth-the")?.naves === "regeneration");
  check("answers to prayer is a section of Nave's prayer",
    row("prayer-answers-to")?.naves === "prayer" && row("prayer-answers-to")?.kind === "section" && row("prayer-answers-to")?.section === "ANSWERED");
  check("the day of atonement is a section of Nave's atonement",
    row("atonement-the-day-of")?.naves === "atonement" && row("atonement-the-day-of")?.section === "DAY OF");
  check("collision: judgments keeps the judgments entry", row("judgments")?.naves === "judgments");
  check("collision: the trumpet keeps the instrument", row("trumpet")?.naves === "trumpet");
  check("collision: the feast of trumpets keeps the feast", row("feasts-of-trumpets-the")?.naves === "trumpets");
  check("shell dropped: burnt offering does not point at Nave's empty shell",
    row("burnt-offering-the")?.naves === "offerings");

  const entryCount = rows.filter((r) => r.kind === "entry").length;
  const sectionCount = rows.length - entryCount;
  console.log(`     ${rows.length} rows (${entryCount} entry, ${sectionCount} section); ` +
    `${rows.length} of ${torreys.topics.length} Torrey topics aligned`);
}

async function get(route) {
  const res = await fetch(`${BASE}${route}`);
  const text = res.status === 200 ? await res.text() : "";
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, body: text };
}

async function phase2() {
  const hasStandalone = await fs.access(STANDALONE).then(() => true, () => false);
  if (!hasStandalone) {
    console.log("skip phase 2 (no standalone build; run npm run build first)");
    return;
  }
  const child = spawn(process.execPath, [path.join(STANDALONE, "server.js")], {
    env: { ...process.env, PORT: String(PORT), HOSTNAME: "127.0.0.1" },
    stdio: "ignore",
  });
  try {
    let up = false;
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`${BASE}/api/pane/topicguide?work=torreys&id=angels`);
        if (res.status === 200) { up = true; break; }
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!up) {
      check("standalone server boots", false);
      return;
    }
    check("standalone server boots", true);

    // Torrey side, entry row: angels under its canonical name.
    const angels = await get("/api/pane/topicguide?work=torreys&id=angels");
    check("torreys:angels composes", angels.status === 200);
    check("torreys:angels canonical is angels", angels.json?.canonical === "angels", angels.json?.canonical);
    check("torreys:angels twin is Nave's angel (a spirit)",
      angels.json?.twin?.work === "naves" && angels.json?.twin?.id === "angel-a-spirit" && angels.json?.twin?.kind === "entry");

    // Torrey side, section row: prayer, answers to, covered in Nave's prayer.
    const answers = await get("/api/pane/topicguide?work=torreys&id=prayer-answers-to");
    check("torreys:prayer-answers-to twin is the Answered section of Nave's prayer",
      answers.json?.twin?.id === "prayer" && answers.json?.twin?.kind === "section" && answers.json?.twin?.section === "ANSWERED");
    check("torreys:prayer-answers-to canonical is answers to prayer", answers.json?.canonical === "answers to prayer");

    // Nave side of the same concept: the entry twin and the covered Torrey entries.
    const spirit = await get("/api/pane/topicguide?work=naves&id=angel-a-spirit");
    check("naves:angel-a-spirit canonical is angels", spirit.json?.canonical === "angels");
    check("naves:angel-a-spirit twin is Torrey's angels",
      spirit.json?.twin?.work === "torreys" && spirit.json?.twin?.id === "angels");
    const navePrayer = await get("/api/pane/topicguide?work=naves&id=prayer");
    check("naves:prayer twin is Torrey's prayer", navePrayer.json?.twin?.id === "prayer");
    const alsoIds = (navePrayer.json?.also ?? []).map((t) => t.id);
    check("naves:prayer covers Torrey's answers to and intercessory prayer",
      alsoIds.includes("prayer-answers-to") && alsoIds.includes("prayer-intercessory"), alsoIds.join(","));

    // A topic with no alignment: twin stays empty rather than inventing one.
    const aaron = await get("/api/pane/topicguide?work=naves&id=aaron");
    check("naves:aaron carries no twin", aaron.json?.twin === null && aaron.json?.canonical === null);

    // Old-route smoke pass.
    for (const route of [
      "/api/pane/topicguide?work=naves&id=adoption",
      "/api/pane/topicguide?work=torreys&id=adoption",
      "/api/pane/guide?book=john&chapter=3",
      "/api/pane/chapter?book=john&chapter=1",
    ]) {
      const r = await get(route);
      check(`old route answers: ${route}`, r.status === 200, `status ${r.status}`);
    }
    const sources = await get("/sources");
    check("the sources page renders", sources.status === 200, `status ${sources.status}`);
    const workspace = await get("/workspace");
    check("the workspace still renders", workspace.status === 200, `status ${workspace.status}`);
  } finally {
    child.kill();
  }
}

await phase1();
await phase2();
console.log(failures === 0 ? "all checks passed" : `${failures} checks failed`);
process.exit(failures === 0 ? 0 : 1);
