#!/usr/bin/env node
/**
 * Aggregate the MACULA Hebrew Septuagint alignment into the Hebrew-to-Greek
 * equivalent tables behind the Word Study guide's Septuagint Translation
 * section.
 *
 * Source: data/_sources/macula-hebrew/annotations.xml (Clear Bible / Biblica,
 * CC BY 4.0; see data/_sources/macula-hebrew/PROVENANCE.md). Each <node> is
 * one Hebrew morpheme with StrongNumberX (its Hebrew id), Greek (the LXX
 * Greek form the translators used for it, when aligned), and GreekStrong
 * (that Greek word's Strong's number).
 *
 * Output: data/lxx-strongs/hebrew-greek.json mapping each Hebrew Strong's id
 * to the Greek Strong's ids the LXX uses for it, with counts; plus _meta.json
 * with build statistics. Hebrew and Greek ids both resolve in the shipped
 * Strong's dictionaries, so the aggregation is direct: no cross-system
 * mapping is built anywhere in this pipeline.
 *
 * One numbering caveat, handled explicitly: MACULA tags Hebrew prefixes and
 * pronominal suffixes with private numbers that collide with real Strong's
 * entries (e.g. the conjunction waw is "2050b", which is also Strong's H2050
 * הוּת). A StrongNumberX is excluded from the aggregate when the consonant
 * skeleton of the lexicon lemma at its base id never appears among the
 * source's own surface forms for it and every surface form is a single
 * consonant — exactly the function morphemes. The excluded list is printed
 * and recorded in _meta.json so the choice stays reviewable.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "data", "_sources", "macula-hebrew", "annotations.xml");
const HEBREW_LEXICON = path.join(ROOT, "data", "lexicon", "strongs-hebrew.json");
const GREEK_LEXICON = path.join(ROOT, "data", "lexicon", "strongs-greek.json");
const OUT_DIR = path.join(ROOT, "data", "lxx-strongs");

const src = fs.readFileSync(SRC, "utf8");
const hebrew = JSON.parse(fs.readFileSync(HEBREW_LEXICON, "utf8"));
const greek = JSON.parse(fs.readFileSync(GREEK_LEXICON, "utf8"));

const ATTR_RE = /([\w-]+)="([^"]*)"/g;

/** Consonant skeleton: Hebrew letters only, final letterforms folded. */
function skeleton(s) {
  const stripped = s.normalize("NFD").replace(/\p{M}/gu, "");
  const finals = {
    "\u05DA": "\u05DB", // ך -> כ
    "\u05DD": "\u05DE", // ם -> מ
    "\u05DF": "\u05E0", // ן -> נ
    "\u05E3": "\u05E4", // ף -> פ
    "\u05E5": "\u05E6", // ץ -> צ
  };
  return [...stripped]
    .map((ch) => finals[ch] ?? ch)
    .filter((ch) => ch >= "\u05D0" && ch <= "\u05EA")
    .join("");
}

/** "0871a" | "1886j" | "1254" -> "H871" | "H1886" | "H1254"; null when unparseable. */
function normalizeHebrewId(snx) {
  const m = snx.match(/^0*(\d+)[a-z]?$/i);
  return m ? `H${m[1]}` : null;
}

/** "746" | "3588" -> "G746" | "G3588"; null when unparseable. */
function normalizeGreekId(gs) {
  const m = gs.match(/^0*(\d+)[a-z]?$/i);
  return m ? `G${m[1]}` : null;
}

// Pass 1: parse every node; remember the surface forms seen per StrongNumberX.
const nodes = [];
const formsBySnx = new Map(); // snx -> Map(skeleton -> count)
let total = 0;
let withoutSn = 0;
let greekUnnumbered = 0;
for (const m of src.matchAll(/<node\b[^>]*\/>/g)) {
  total++;
  const attrs = {};
  ATTR_RE.lastIndex = 0;
  for (const a of m[0].matchAll(ATTR_RE)) attrs[a[1]] = a[2];
  const snx = attrs.StrongNumberX;
  const greekForm = attrs.Greek;
  const greekStrong = attrs.GreekStrong;
  if (greekForm && !greekStrong) greekUnnumbered++;
  if (!snx) {
    withoutSn++;
    continue;
  }
  let forms = formsBySnx.get(snx);
  if (!forms) {
    forms = new Map();
    formsBySnx.set(snx, forms);
  }
  const skel = skeleton(attrs.Unicode ?? "");
  forms.set(skel, (forms.get(skel) ?? 0) + 1);
  nodes.push({ snx, greekStrong });
}

// Exclusion: private-numbered function morphemes (see the header comment).
// A value is excluded when every part resolves to a lexicon entry, none of
// those entries' lemma skeletons ever appears among the value's surface
// forms, and at least 90% of its tokens are single-consonant morphemes
// (prefixes and pronominal suffixes; the odd merged form like מוֹ does not
// rescue the value).
const excluded = [];
for (const [snx, forms] of formsBySnx) {
  const parts = snx.split("|").map(normalizeHebrewId);
  if (parts.length === 0 || parts.some((id) => id === null || !hebrew[id]?.lemma)) continue;
  const skels = [...forms.keys()];
  const lemmaSeen = parts.some((id) => skels.includes(skeleton(hebrew[id].lemma)));
  if (lemmaSeen) continue;
  const tokens = [...forms.values()].reduce((a, b) => a + b, 0);
  const single = [...forms.entries()].filter(([s]) => s.length <= 1).reduce((n, [, c]) => n + c, 0);
  if (single / tokens >= 0.9) {
    excluded.push({ snx, tokens, forms: skels });
  }
}
const excludedSet = new Set(excluded.map((e) => e.snx));

// Pass 2: count (hebrew, greek) pairs over the kept nodes.
const pairs = new Map(); // H id -> Map(G id -> count)
let alignedTokens = 0;
for (const { snx, greekStrong } of nodes) {
  if (!greekStrong || excludedSet.has(snx)) continue;
  const hIds = snx.split("|").map(normalizeHebrewId).filter(Boolean);
  const gIds = greekStrong.split("|").map(normalizeGreekId).filter(Boolean);
  if (hIds.length === 0 || gIds.length === 0) continue;
  alignedTokens++;
  for (const h of hIds) {
    let inner = pairs.get(h);
    if (!inner) {
      inner = new Map();
      pairs.set(h, inner);
    }
    for (const g of gIds) inner.set(g, (inner.get(g) ?? 0) + 1);
  }
}

// Emit: sorted H ids, each with its G ids sorted by count desc then id.
const out = {};
for (const h of [...pairs.keys()].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
  const inner = pairs.get(h);
  out[h] = Object.fromEntries(
    [...inner.entries()].sort((a, b) => b[1] - a[1] || Number(a[0].slice(1)) - Number(b[0].slice(1)))
  );
}

// Integrity assertions: known-good anchors must hold, pseudo-ids must be absent.
const checks = [];
function check(label, ok, detail) {
  checks.push({ label, ok, detail });
  if (!ok) throw new Error(`Integrity check failed: ${label} (${detail})`);
}
check("H430 -> G2316 (elohim -> theos)", (out.H430?.G2316 ?? 0) > 2000, String(out.H430?.G2316));
check("H3068 -> G2962 (YHWH -> kyrios)", (out.H3068?.G2962 ?? 0) > 1000, String(out.H3068?.G2962));
check("H7225 -> G746 (reshith -> arche)", (out.H7225?.G746 ?? 0) > 0, String(out.H7225?.G746));
check("H8064 -> G3772 (shamayim -> ouranos)", (out.H8064?.G3772 ?? 0) > 100, String(out.H8064?.G3772));
check("H1697 -> G3056 (dabar -> logos)", (out.H1697?.G3056 ?? 0) > 50, String(out.H1697?.G3056));
// Private-numbered prefixes/suffixes must not flood the rare real words whose
// Strong's numbers they collide with (H871 Atharim, H1886 Dothan, ...).
for (const pseudo of ["H871", "H1886", "H2050", "H3807", "H3509", "H4993"]) {
  const inner = out[pseudo] ?? {};
  const totalHits = Object.values(inner).reduce((a, b) => a + b, 0);
  const top = Math.max(0, ...Object.values(inner));
  check(
    `${pseudo} carries no function-morpheme flood`,
    totalHits <= 20 && top <= 20,
    `total=${totalHits} top=${top}`
  );
}
const unresolvedGreek = new Set();
for (const inner of Object.values(out)) {
  for (const g of Object.keys(inner)) if (!greek[g]) unresolvedGreek.add(g);
}

const pairCount = Object.values(out).reduce((n, inner) => n + Object.keys(inner).length, 0);
const alignedSum = Object.values(out).reduce(
  (n, inner) => n + Object.values(inner).reduce((a, b) => a + b, 0),
  0
);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "hebrew-greek.json"), JSON.stringify(out));
fs.writeFileSync(
  path.join(OUT_DIR, "_meta.json"),
  JSON.stringify(
    {
      id: "lxx-strongs",
      title: "Hebrew-to-Greek Septuagint equivalents (MACULA alignment)",
      attribution:
        "MACULA Hebrew Linguistic Datasets, available at https://github.com/Clear-Bible/macula-hebrew/ (CC BY 4.0).",
      retrieved: "2026-07-23",
      builtBy: "scripts/build-lxx-strongs.mjs",
      nodes: total,
      alignedTokens,
      alignedInAggregate: alignedSum,
      greekUnnumbered,
      withoutStrongNumber: withoutSn,
      hebrewIds: Object.keys(out).length,
      pairs: pairCount,
      unresolvedGreekIds: [...unresolvedGreek],
      excludedPrivateIds: excluded.map((e) => `${e.snx} (${e.tokens})`),
    },
    null,
    2
  ) + "\n"
);

console.log(`Parsed ${total} morpheme nodes; aligned to Greek Strong's: ${alignedTokens}`);
console.log(`Greek equivalent without a Strong's number (not aggregated): ${greekUnnumbered}`);
console.log(`Hebrew ids in the aggregate: ${Object.keys(out).length}; distinct pairs: ${pairCount}`);
console.log(`Unresolved Greek ids: ${unresolvedGreek.size}`);
console.log(`Excluded private-numbered function morphemes: ${excluded.length}`);
for (const e of excluded.sort((a, b) => b.tokens - a.tokens)) {
  console.log(`  ${e.snx}  tokens=${e.tokens}  forms=${e.forms.join(" ")}`);
}
console.log(`Wrote ${path.relative(ROOT, OUT_DIR)}/hebrew-greek.json and _meta.json`);
