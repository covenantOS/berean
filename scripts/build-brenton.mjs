#!/usr/bin/env node
/**
 * Normalize the eBible.org USFM of Brenton's English Septuagint (1851,
 * public domain) into the per-book JSON shape read by src/lib/bible.ts.
 *
 * Source: data/_sources/brenton/eng-Brenton_usfm.zip (see
 * data/_sources/brenton/PROVENANCE.md)
 * Output: data/translations/brenton/<BookFile>.json (Old Testament only;
 * Brenton's translation has no New Testament).
 *
 * LXX verse numbering is kept as-is: Psalms follow the LXX count, Esther's
 * additions stay as lettered verses (1b-1s etc., a label the reader renders
 * explicitly), Malachi ends at chapter 3, and Psalm 151 is kept in the data
 * though the 150-psalm canon never serves it. Ezra is the LXX 2 Esdras:
 * chapters 1-10 are Ezra, chapters 11-23 become Nehemiah 1-13. Daniel comes
 * from the Greek Daniel (DAG); Susanna and Bel are separate books and are
 * not built. Brenton's margin (USFM footnotes: "Gr." renderings and
 * Alexandrian variants) is stripped; the reading text only is kept.
 * Deuterocanonical books are present in the source but not built: the app
 * canon is the 66 books and is not expanded.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "brenton", "eng-Brenton_usfm.zip");
const OUT_DIR = path.join(ROOT, "data", "translations", "brenton");

// USFM code -> [display name, source member suffix, chapter offset].
// Esther uses the Greek Esther (ESG), which is this edition's only Esther;
// Nehemiah is chapters 11-23 of 2 Esdras (EZR); Daniel is the Greek Daniel.
const BOOKS = {
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers",
  DEU: "Deuteronomy", JOS: "Joshua", JDG: "Judges", RUT: "Ruth",
  "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
  "1CH": "1 Chronicles", "2CH": "2 Chronicles", EZR: "Ezra",
  NEH: ["Nehemiah", "EZR", 10],
  ESG: ["Esther", "ESG", 0],
  JOB: "Job", PSA: "Psalms", PRO: "Proverbs", ECC: "Ecclesiastes",
  SNG: "Song of Solomon", ISA: "Isaiah", JER: "Jeremiah",
  LAM: "Lamentations", EZK: "Ezekiel", DAG: ["Daniel", "DAG", 0],
  HOS: "Hosea", JOL: "Joel", AMO: "Amos", OBA: "Obadiah", JON: "Jonah",
  MIC: "Micah", NAM: "Nahum", HAB: "Habakkuk", ZEP: "Zephaniah",
  HAG: "Haggai", ZEC: "Zechariah", MAL: "Malachi",
};

const memberCache = new Map();
function member(name) {
  if (!memberCache.has(name)) {
    memberCache.set(
      name,
      execFileSync("unzip", ["-p", ZIP, name], { maxBuffer: 1 << 28 })
        .toString("utf8")
        .replace(/\r/g, "")
    );
  }
  return memberCache.get(name);
}

/** Reading text only: drop footnotes and cross-ref notes, drop marker codes. */
function clean(s) {
  return s
    .replace(/\\[fx]\s.*?\\[fx]\*/g, "")
    .replace(/\\[a-z0-9]+\*?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse one USFM member into chapter number -> verses[{verse, text}]. */
function parseBook(usfm) {
  const chapters = new Map();
  let chapter = null;
  let current = null;
  const warnings = [];
  for (const line of usfm.split("\n")) {
    const c = line.match(/^\\c\s+(\d+)/);
    if (c) {
      chapter = Number(c[1]);
      current = null;
      continue;
    }
    const v = line.match(/^\\v\s+(\S+)\s+(.*)$/);
    if (v && chapter !== null) {
      const [, label, rest] = v;
      if (!/^\d+[a-z]?$/.test(label)) {
        warnings.push(`unusual verse label "${label}" in chapter ${chapter}`);
        continue;
      }
      if (!chapters.has(chapter)) chapters.set(chapter, []);
      current = { verse: label, text: clean(rest) };
      chapters.get(chapter).push(current);
      continue;
    }
    // A continuation line of the current verse (rare in this edition).
    if (current && line.trim() && !line.startsWith("\\")) {
      current.text += " " + clean(line);
    }
  }
  return { chapters, warnings };
}

const fileIndex = new Map(
  execFileSync("unzip", ["-Z1", ZIP]).toString("utf8").trim().split("\n")
    .map((n) => [n.match(/-([A-Z0-9]+)eng-Brenton\.usfm$/)?.[1], n])
);

fs.mkdirSync(OUT_DIR, { recursive: true });
let booksOut = 0;
let versesTotal = 0;
const notes = [];
for (const [code, spec] of Object.entries(BOOKS)) {
  const [name, srcCode, offset] = Array.isArray(spec) ? spec : [spec, code, 0];
  const file = fileIndex.get(srcCode);
  if (!file) {
    notes.push(`${name}: no ${srcCode} member in zip, skipped`);
    continue;
  }
  const { chapters, warnings } = parseBook(member(file));
  const out = [];
  for (const [n, verses] of [...chapters.entries()].sort((a, z) => a[0] - z[0])) {
    if (n <= offset) continue; // Ezra half of 2 Esdras when building Nehemiah
    out.push({ chapter: String(n - offset), verses });
    versesTotal += verses.length;
  }
  fs.writeFileSync(
    path.join(OUT_DIR, `${name.replace(/ /g, "")}.json`),
    JSON.stringify({ book: name, chapters: out })
  );
  booksOut++;
  for (const w of warnings) notes.push(`${name}: ${w}`);
}
console.log(`Wrote ${booksOut} books, ${versesTotal} verses to ${path.relative(ROOT, OUT_DIR)}/`);
if (notes.length) {
  console.log(`Notes (${notes.length}):`);
  for (const n of notes.slice(0, 20)) console.log(`  ${n}`);
}
