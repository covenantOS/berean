#!/usr/bin/env node
/**
 * Aggregate the UBS semantic-domain dictionaries into the lemma-keyed sense
 * tables behind the Word Study guide's Semantic Domains section.
 *
 * Sources (both CC BY-SA 4.0, United Bible Societies; see
 * data/_sources/ubs-dictionaries/PROVENANCE.md):
 * - UBS Dictionary of the Greek New Testament v1.1, adapted from the Semantic
 *   Dictionary of Biblical Greek, itself adapted from Louw & Nida's
 *   Greek-English Lexicon of the New Testament Based on Semantic Domains.
 *   Each meaning carries its Louw-Nida entry code (LEXEntryCode, e.g. 33.98),
 *   its domain and subdomain codes and names, and a short English definition.
 * - UBS Dictionary of Biblical Hebrew v0.9.2, extracted from the Semantic
 *   Dictionary of Biblical Hebrew (SDBH). The SDBH domain hierarchy is its
 *   own taxonomy (not Louw-Nida); the shipped data names it honestly.
 *
 * Output: data/domains/greek.json and hebrew.json, each mapping a base
 * Strong's id ("G3056", "H430") to the lemma's attested senses:
 *
 *   Greek:  [{ entry, domain, subdomain, sense, glosses, refs }]
 *   Hebrew: [{ code, domain, sense, glosses, refs }]
 *
 * `refs` is the number of Scripture references the source lists for the
 * sense (its attestation count). Plus _meta.json with build statistics.
 *
 * Strong's id mapping: the dictionaries' StrongCodes carry a letter prefix
 * marking language (G Greek, H Hebrew, A Aramaic) and a zero-padded number.
 * The number is the Strong's number in every case: Strong's interleaves the
 * Aramaic vocabulary in the Hebrew sequence (A0002 is Strong's H2, the
 * Aramaic אַב), so both prefixes reduce to the same H-space.
 *
 * Collisions (one number, several UBS entries, e.g. a common noun and place
 * names built on it) resolve against the shipped Strong's lexicons by lemma
 * consonant skeleton, the rule the LXX equivalents build already uses; an id
 * with no skeleton match anywhere keeps every candidate's senses and is
 * counted in _meta.json so the choice stays reviewable.
 *
 * Sense text hygiene: the source embeds editorial markup in definitions,
 * {N:...} footnote markers, {D:...} domain cross-references, {S:...} sense
 * references, and {L:lemma<SDBG:...>} lemma references. These are source
 * internal pointers, not wording; the build strips the brace groups and
 * keeps the display lemma of {L:...} references. No wording is altered.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "_sources", "ubs-dictionaries");
const GREEK_SRC = path.join(SRC_DIR, "UBSGreekNTDic-v1.1-en.JSON");
const HEBREW_SRC = path.join(SRC_DIR, "UBSHebrewDic-v0.9.2-en.JSON");
const GREEK_LEXICON = path.join(ROOT, "data", "lexicon", "strongs-greek.json");
const HEBREW_LEXICON = path.join(ROOT, "data", "lexicon", "strongs-hebrew.json");
const OUT_DIR = path.join(ROOT, "data", "domains");

const greekLexicon = JSON.parse(fs.readFileSync(GREEK_LEXICON, "utf8"));
const hebrewLexicon = JSON.parse(fs.readFileSync(HEBREW_LEXICON, "utf8"));

/** Hebrew consonant skeleton: letters only, final letterforms folded. */
function hebrewSkeleton(s) {
  const stripped = s.normalize("NFD").replace(/\p{M}/gu, "");
  const finals = {
    "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ",
  };
  return [...stripped]
    .map((ch) => finals[ch] ?? ch)
    .filter((ch) => ch >= "א" && ch <= "ת")
    .join("");
}

/** Greek skeleton: strip accents and breathing marks, fold final sigma. */
function greekSkeleton(s) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ς/g, "σ")
    .toLowerCase();
}

/** Strip the source's editorial markup from a definition (see header). */
function cleanSense(text) {
  return text
    .replace(/\{L:([^<}]+)<[^>]*>\}/g, "$1") // {L:lemma<SDBG:...>} -> lemma
    .replace(/\{[A-Z]+:[^}]*\}/g, "") // {N:...} {D:...} {S:...} pointer groups
    .replace(/\{[^}]*\}/g, "") // any remaining brace group
    .replace(/<[^>]*>/g, "") // any remaining angle markup
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** English short definition and glosses of a meaning; null when absent. */
function englishSense(meaning) {
  const en = (meaning.LEXSenses ?? []).find((s) => s.LanguageCode === "en");
  if (!en) return null;
  const sense = cleanSense(en.DefinitionShort ?? "");
  const glosses = (en.Glosses ?? []).map((g) => cleanSense(g)).filter(Boolean).join(", ");
  return { sense, glosses };
}

/**
 * Group the dictionary's entries by resolved Strong's id.
 * Returns Map(id -> entries[]); ids the letter prefix chooses (G/H space).
 */
function groupByStrongsId(dictionary, letter) {
  const byId = new Map();
  let coded = 0;
  let uncoded = 0;
  for (const entry of dictionary) {
    const codes = entry.StrongCodes ?? [];
    if (codes.length === 0) {
      uncoded++;
      continue;
    }
    const ids = new Set();
    for (const code of codes) {
      const m = String(code).match(/^[GHA]0*(\d+)$/);
      if (!m) continue;
      ids.add(`${letter}${m[1]}`);
    }
    if (ids.size === 0) {
      uncoded++;
      continue;
    }
    coded++;
    for (const id of ids) {
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(entry);
    }
  }
  return { byId, coded, uncoded };
}

/**
 * Choose the entries an id ships: the skeleton matches against the shipped
 * lexicon when the id has several candidates, every candidate otherwise.
 */
function chooseEntries(id, candidates, lexicon, skeleton) {
  if (candidates.length <= 1) return { chosen: candidates, matched: candidates.length === 1 };
  const lexLemma = lexicon[id]?.lemma;
  if (!lexLemma) return { chosen: candidates, matched: false };
  const target = skeleton(lexLemma);
  const hits = candidates.filter((e) => skeleton(e.Lemma ?? "") === target);
  return { chosen: hits.length > 0 ? hits : candidates, matched: hits.length > 0 };
}

function buildGreek() {
  const dictionary = JSON.parse(fs.readFileSync(GREEK_SRC, "utf8"));
  const { byId, coded, uncoded } = groupByStrongsId(dictionary, "G");
  const out = {};
  let senses = 0;
  let collisionIds = 0;
  let collisionResolved = 0;
  const unresolvedIds = [];
  for (const [id, candidates] of [...byId.entries()].sort(
    (a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))
  )) {
    if (candidates.length > 1) collisionIds++;
    const { chosen, matched } = chooseEntries(id, candidates, greekLexicon, greekSkeleton);
    if (candidates.length > 1 && matched) collisionResolved++;
    const rows = [];
    for (const entry of chosen) {
      for (const base of entry.BaseForms ?? []) {
        for (const meaning of base.LEXMeanings ?? []) {
          const s = englishSense(meaning);
          if (!s || !s.sense) continue;
          const entryCode = String(meaning.LEXEntryCode ?? "").trim();
          const domain = (meaning.LEXDomains ?? [])[0];
          const subdomain = (meaning.LEXSubDomains ?? [])[0];
          rows.push({
            entry: entryCode,
            domain: domain?.Domain ?? "",
            subdomain: subdomain?.Domain ?? "",
            sense: s.sense,
            glosses: s.glosses,
            refs: (meaning.LEXReferences ?? []).length,
          });
        }
      }
    }
    // Dedupe by (entry code, sense): a lemma's spelling variants repeat senses.
    const seen = new Set();
    const deduped = rows.filter((r) => {
      const key = `${r.entry}${r.sense}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (deduped.length === 0) continue;
    out[id] = deduped;
    senses += deduped.length;
  }
  for (const id of Object.keys(out)) {
    if (!greekLexicon[id]) unresolvedIds.push(id);
  }
  return { out, stats: { dictionaryEntries: dictionary.length, coded, uncoded, ids: Object.keys(out).length, senses, collisionIds, collisionResolved, unresolvedIds } };
}

function buildHebrew() {
  const dictionary = JSON.parse(fs.readFileSync(HEBREW_SRC, "utf8"));
  const { byId, coded, uncoded } = groupByStrongsId(dictionary, "H");
  const out = {};
  let senses = 0;
  let collisionIds = 0;
  let collisionResolved = 0;
  const unresolvedIds = [];
  for (const [id, candidates] of [...byId.entries()].sort(
    (a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))
  )) {
    if (candidates.length > 1) collisionIds++;
    const { chosen, matched } = chooseEntries(id, candidates, hebrewLexicon, hebrewSkeleton);
    if (candidates.length > 1 && matched) collisionResolved++;
    const rows = [];
    for (const entry of chosen) {
      for (const base of entry.BaseForms ?? []) {
        for (const meaning of base.LEXMeanings ?? []) {
          const s = englishSense(meaning);
          if (!s || !s.sense) continue;
          const domain = (meaning.LEXDomains ?? [])[0];
          rows.push({
            code: domain?.DomainCode ?? "",
            domain: domain?.Domain ?? "",
            sense: s.sense,
            glosses: s.glosses,
            refs: (meaning.LEXReferences ?? []).length,
          });
        }
      }
    }
    const seen = new Set();
    const deduped = rows.filter((r) => {
      const key = `${r.code}${r.sense}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (deduped.length === 0) continue;
    out[id] = deduped;
    senses += deduped.length;
  }
  for (const id of Object.keys(out)) {
    if (!hebrewLexicon[id]) unresolvedIds.push(id);
  }
  return { out, stats: { dictionaryEntries: dictionary.length, coded, uncoded, ids: Object.keys(out).length, senses, collisionIds, collisionResolved, unresolvedIds } };
}

// Integrity assertions: known-good anchors must hold.
const checks = [];
function check(label, ok, detail) {
  checks.push({ label, ok, detail });
  if (!ok) throw new Error(`Integrity check failed: ${label} (${detail})`);
}

const greek = buildGreek();
const hebrew = buildHebrew();

check(
  "G3056 logos carries LN 33.98 in Communication",
  (greek.out.G3056 ?? []).some((s) => s.entry === "33.98" && s.domain === "Communication"),
  JSON.stringify((greek.out.G3056 ?? []).slice(0, 2))
);
check(
  "G2316 theos carries LN 12.1 Supernatural Beings",
  (greek.out.G2316 ?? []).some((s) => s.entry === "12.1"),
  JSON.stringify((greek.out.G2316 ?? []).map((s) => s.entry))
);
check(
  "G26 agape carries LN 25.43 Attitudes and Emotions",
  (greek.out.G26 ?? []).some((s) => s.entry === "25.43" && s.domain === "Attitudes and Emotions"),
  JSON.stringify((greek.out.G26 ?? []).map((s) => s.entry))
);
check(
  "H430 elohim carries a Deities sense",
  (hebrew.out.H430 ?? []).some((s) => s.domain === "Deities"),
  JSON.stringify((hebrew.out.H430 ?? []).slice(0, 2).map((s) => s.domain))
);
check(
  "H7225 reshith is furnished",
  (hebrew.out.H7225 ?? []).length > 0,
  String((hebrew.out.H7225 ?? []).length)
);
check(
  "H2 aramaic ab mapped through the A prefix",
  (hebrew.out.H2 ?? []).length > 0,
  String((hebrew.out.H2 ?? []).length)
);
check(
  "Greek ids cover the furnished lexicon's core vocabulary",
  Object.keys(greek.out).length >= 5000,
  String(Object.keys(greek.out).length)
);
check(
  "Hebrew ids cover the furnished lexicon's core vocabulary",
  Object.keys(hebrew.out).length >= 7000,
  String(Object.keys(hebrew.out).length)
);
check(
  "No sense text keeps the source's editorial markup",
  [...Object.values(greek.out), ...Object.values(hebrew.out)].every((senses) =>
    senses.every((s) => !/[{}]/.test(s.sense) && !/[{}]/.test(s.glosses))
  ),
  "brace scan"
);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "greek.json"), JSON.stringify(greek.out));
fs.writeFileSync(path.join(OUT_DIR, "hebrew.json"), JSON.stringify(hebrew.out));
fs.writeFileSync(
  path.join(OUT_DIR, "_meta.json"),
  JSON.stringify(
    {
      id: "domains",
      title: "Semantic domain senses per lemma (UBS dictionaries)",
      attribution:
        "UBS Dictionary of the Greek New Testament and UBS Dictionary of Biblical Hebrew, © United Bible Societies 2023 (CC BY-SA 4.0), available at https://github.com/ubsicap/ubs-open-license.",
      retrieved: "2026-07-23",
      builtBy: "scripts/build-domains.mjs",
      greek: {
        ...greek.stats,
        unresolvedIds: greek.stats.unresolvedIds.slice(0, 25),
        unresolvedCount: greek.stats.unresolvedIds.length,
      },
      hebrew: {
        ...hebrew.stats,
        unresolvedIds: hebrew.stats.unresolvedIds.slice(0, 25),
        unresolvedCount: hebrew.stats.unresolvedIds.length,
      },
      checks,
    },
    null,
    2
  ) + "\n"
);

console.log(`Greek: ${greek.stats.ids} ids, ${greek.stats.senses} senses (${greek.stats.coded} coded entries, ${greek.stats.uncoded} without Strong's codes)`);
console.log(`  collisions: ${greek.stats.collisionIds} ids with several entries, ${greek.stats.collisionResolved} resolved by lemma skeleton`);
console.log(`  ids absent from the shipped Greek lexicon: ${greek.stats.unresolvedIds.length}`);
console.log(`Hebrew: ${hebrew.stats.ids} ids, ${hebrew.stats.senses} senses (${hebrew.stats.coded} coded entries, ${hebrew.stats.uncoded} without Strong's codes)`);
console.log(`  collisions: ${hebrew.stats.collisionIds} ids with several entries, ${hebrew.stats.collisionResolved} resolved by lemma skeleton`);
console.log(`  ids absent from the shipped Hebrew lexicon: ${hebrew.stats.unresolvedIds.length}`);
console.log(`Wrote ${path.relative(ROOT, OUT_DIR)}/greek.json, hebrew.json, _meta.json`);
