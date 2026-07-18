#!/usr/bin/env node
/**
 * Normalize the eBible.org USFM of the Greek Septuagint printed in Brenton's
 * 1851 diglot (public domain) into the per-book JSON shape read by
 * src/lib/bible.ts.
 *
 * Source: data/_sources/lxx/grcbrent_usfm.zip (see
 * data/_sources/lxx/PROVENANCE.md)
 * Output: data/lxx/<BookFile>.json (Old Testament only; the Septuagint has
 * no New Testament).
 *
 * The shape mirrors scripts/build-brenton.mjs: LXX verse numbering kept
 * as-is, Esther's additions as lettered verses, Ezra as 2 Esdras (chapters
 * 11-23 become Nehemiah; this zip has no separate Nehemiah file), Daniel
 * from the Greek Daniel, Psalm 151 kept but never served, deuterocanon not
 * built. USFM footnotes and cross-reference notes are stripped.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "lxx", "grcbrent_usfm.zip");
const OUT_DIR = path.join(ROOT, "data", "lxx");

// USFM code -> [display name, source member code, chapter offset].
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
    if (current && line.trim() && !line.startsWith("\\")) {
      current.text += " " + clean(line);
    }
  }
  return { chapters, warnings };
}

const fileIndex = new Map(
  execFileSync("unzip", ["-Z1", ZIP]).toString("utf8").trim().split("\n")
    .map((n) => [n.match(/-([A-Z0-9]+)grcbrent\.usfm$/)?.[1], n])
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
    if (n <= offset) continue;
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
