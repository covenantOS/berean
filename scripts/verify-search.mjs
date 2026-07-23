#!/usr/bin/env node
/**
 * Verification harness for the dataset-search wave: boots the standalone
 * production server (run `npm run build` first), asserts the domain, role,
 * and clause search composition end to end through the pane API, the
 * Exegetical Guide's frames payload, and a smoke pass over the old routes.
 * The server child is spawned here and killed here, on every exit path.
 *
 * Usage: node scripts/verify-search.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const PORT = 4319;
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

async function get(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  return { status: res.status, body: await res.text() };
}
async function getJson(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  return { status: res.status, json: await res.json() };
}

/** Wait for the server to answer /api/health, up to ~30s. */
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

async function run() {
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

    /* ---- domain resolution and occurrence composition ---- */
    const d33 = await getJson("/api/pane/morph?q=" + encodeURIComponent("domain:33"));
    check("domain:33 resolves to Communication", d33.json.domain?.label?.includes("Communication"), JSON.stringify(d33.json.domain));
    check("domain:33 runs Greek occurrences", d33.json.lang === "greek" && d33.json.hits.length > 0 && d33.json.verses > 0, `lang=${d33.json.lang} verses=${d33.json.verses}`);
    check("domain:33 names its lemma count", typeof d33.json.domain?.lemmas === "number" && d33.json.domain.lemmas > 50, String(d33.json.domain?.lemmas));

    const dName = await getJson("/api/pane/morph?q=" + encodeURIComponent("domain:communication"));
    check("domain:communication resolves to the same set", dName.json.domain?.label?.includes("Communication") && dName.json.verses === d33.json.verses, `verses ${dName.json.verses} vs ${d33.json.verses}`);

    const dEntry = await getJson("/api/pane/morph?q=" + encodeURIComponent("domain:33.98"));
    check("domain:33.98 narrows within domain 33", dEntry.json.domain?.lemmas > 0 && dEntry.json.domain.lemmas < d33.json.domain.lemmas && dEntry.json.verses > 0, `lemmas=${dEntry.json.domain?.lemmas}`);

    const dScoped = await getJson("/api/pane/morph?q=" + encodeURIComponent("domain:33 in:john"));
    check("domain:33 in:john scopes to John", dScoped.json.verses > 0 && dScoped.json.verses < d33.json.verses && dScoped.json.hits.every((h) => h.book === "john"), `verses=${dScoped.json.verses}`);

    const dHebrew = await getJson("/api/pane/morph?q=" + encodeURIComponent("domain:Deities"));
    check("domain:Deities runs Hebrew occurrences", dHebrew.json.lang === "hebrew" && dHebrew.json.hits.length > 0, `lang=${dHebrew.json.lang} hits=${dHebrew.json.hits?.length}`);

    const dBad = await getJson("/api/pane/morph?q=" + encodeURIComponent("domain:zzznope"));
    check("an unknown domain answers with a message, never a wrong answer", typeof dBad.json.error === "string" && dBad.json.hits.length === 0, JSON.stringify(dBad.json).slice(0, 160));

    /* ---- role filter over the MACULA frames ---- */
    const plain = await getJson("/api/pane/morph?q=" + encodeURIComponent("G3056"));
    const agent = await getJson("/api/pane/morph?q=" + encodeURIComponent("G3056 role:agent"));
    check("G3056 role:agent narrows the lemma's occurrences", agent.json.verses > 0 && agent.json.verses < plain.json.verses, `${agent.json.verses} of ${plain.json.verses}`);
    check(
      "G3056 role:agent keeps the lemma's own hits",
      agent.json.hits.every((h) => h.matches.some((m) => m.strongs === "G3056")),
      JSON.stringify(agent.json.hits[0]?.matches).slice(0, 120)
    );

    const hebAgent = await getJson("/api/pane/morph?q=" + encodeURIComponent("H430 role:agent"));
    check(
      "H430 role:agent finds elohim creating in Genesis 1:1",
      hebAgent.json.hits.some((h) => h.book === "genesis" && h.chapter === 1 && h.verse === 1),
      JSON.stringify(hebAgent.json.hits[0]).slice(0, 140)
    );

    const domainAgent = await getJson("/api/pane/morph?q=" + encodeURIComponent("domain:33 role:agent"));
    check("domain:33 role:agent composes domain with role", domainAgent.json.verses > 0 && domainAgent.json.verses < d33.json.verses, `${domainAgent.json.verses} of ${d33.json.verses}`);

    const bareRole = await getJson("/api/pane/morph?q=" + encodeURIComponent("role:agent"));
    check("a bare role: answers with a message", typeof bareRole.json.error === "string", JSON.stringify(bareRole.json).slice(0, 160));

    const badRole = await getJson("/api/pane/morph?q=" + encodeURIComponent("G3056 role:bogus"));
    check("an unknown role answers with a message", typeof badRole.json.error === "string", JSON.stringify(badRole.json).slice(0, 160));

    /* ---- clause filter over the constructions ---- */
    const o2 = await getJson("/api/pane/morph?q=" + encodeURIComponent("clause:o2"));
    check("clause:o2 finds second-object constructions", o2.json.verses > 0 && o2.json.total > 0, `verses=${o2.json.verses} total=${o2.json.total}`);
    check("clause:o2 counts constructions, not occurrences", o2.json.totalLabel?.many?.includes("second object"), JSON.stringify(o2.json.totalLabel));

    const lemmaClause = await getJson("/api/pane/morph?q=" + encodeURIComponent("G3056 clause:s"));
    check("G3056 clause:s narrows to subject-clause verses", lemmaClause.json.verses > 0 && lemmaClause.json.verses < plain.json.verses, `${lemmaClause.json.verses} of ${plain.json.verses}`);

    const badClause = await getJson("/api/pane/morph?q=" + encodeURIComponent("clause:bogus"));
    check("an unknown clause function answers with a message", typeof badClause.json.error === "string", JSON.stringify(badClause.json).slice(0, 160));

    /* ---- the Exegetical Guide's frames payload ---- */
    const john = await getJson("/api/pane/exegetical?book=john&chapter=1");
    const j15 = john.json.frames?.["5"];
    check(
      "John 1:5 names the darkness agent of katelaben",
      j15?.frames?.some((f) => f.verb.includes("κατέλαβεν") && f.args.some((a) => a.role === "agent" && a.text === "σκοτία")),
      JSON.stringify(j15).slice(0, 200)
    );
    const j12 = john.json.frames?.["2"];
    check(
      "John 1:2 resolves He to the Word of verse 1",
      j12?.referents?.some((r) => r.of.some((t) => t.text === "Λόγος" && t.v === 1)),
      JSON.stringify(j12).slice(0, 200)
    );
    const gen = await getJson("/api/pane/exegetical?book=genesis&chapter=1");
    const g11 = gen.json.frames?.["1"];
    check(
      "Genesis 1:1 names elohim agent of created",
      g11?.frames?.some((f) => f.args.some((a) => a.role === "agent" && a.strongs === "H430") && f.args.filter((a) => a.role === "patient").length === 2),
      JSON.stringify(g11).slice(0, 240)
    );

    /* ---- page and old-route smoke ---- */
    const page = await get("/search?mode=original&q=" + encodeURIComponent("domain:33"));
    check("/search original mode renders the domain line", page.status === 200 && page.body.includes("Communication"), `status=${page.status}`);

    const clausePage = await get("/search?mode=original&q=" + encodeURIComponent("clause:o2"));
    check("/search renders the construction count line", clausePage.status === 200 && clausePage.body.includes("second object construction"), `status=${clausePage.status}`);

    const rolePage = await get("/search?mode=original&q=" + encodeURIComponent("G3056 role:agent"));
    check("/search runs a role query", rolePage.status === 200 && rolePage.body.includes("occurrence"), `status=${rolePage.status}`);

    const chapter = await getJson("/api/pane/chapter?book=john&chapter=1");
    check("the chapter route still answers", chapter.status === 200 && Array.isArray(chapter.json.verses), `status=${chapter.status}`);
    const workspace = await get("/workspace");
    check("the workspace still renders", workspace.status === 200, `status=${workspace.status}`);
  } finally {
    child.kill();
  }
}

run().then(
  () => {
    console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
    process.exit(failures === 0 ? 0 : 1);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
