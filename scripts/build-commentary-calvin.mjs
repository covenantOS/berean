#!/usr/bin/env node
/**
 * Normalize the pillar-commentary-data JSON edition of John Calvin's
 * Commentaries (public domain text; see data/_sources/calvin-src/PROVENANCE.md)
 * into the format read by src/lib/commentary.ts.
 *
 * Source: data/_sources/calvin-src/c/calvin/{USFM}/{chapter}.json
 * Output: data/commentary/calvin/<BookFile>.json
 *
 * Each chapter file follows the HelloAO chapter schema: content items of
 * type "verse" carry the commented verse number and one or more text
 * fragments. Calvin covered 47 of the 66 books; only those are emitted.
 * Multi-paragraph comments arrive as separate text fragments and are rejoined
 * with blank lines. The leading item of a chapter is often the chapter
 * argument or superscription; it keeps its own verse anchor as in the source.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "_sources", "calvin-src", "c", "calvin");
const OUT_DIR = path.join(ROOT, "data", "commentary", "calvin");

// USFM code -> display name, mirroring src/lib/canon.ts.
const BOOKS = {
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers",
  DEU: "Deuteronomy", JOS: "Joshua", JDG: "Judges", RUT: "Ruth",
  "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
  "1CH": "1 Chronicles", "2CH": "2 Chronicles", EZR: "Ezra",
  NEH: "Nehemiah", EST: "Esther", JOB: "Job", PSA: "Psalms",
  PRO: "Proverbs", ECC: "Ecclesiastes", SNG: "Song of Solomon",
  ISA: "Isaiah", JER: "Jeremiah", LAM: "Lamentations",
  EZK: "Ezekiel", DAN: "Daniel", HOS: "Hosea", JOL: "Joel", AMO: "Amos",
  OBA: "Obadiah", JON: "Jonah", MIC: "Micah", NAM: "Nahum",
  HAB: "Habakkuk", ZEP: "Zephaniah", HAG: "Haggai",
  ZEC: "Zechariah", MAL: "Malachi", MAT: "Matthew", MRK: "Mark",
  LUK: "Luke", JHN: "John", ACT: "Acts", ROM: "Romans",
  "1CO": "1 Corinthians", "2CO": "2 Corinthians", GAL: "Galatians",
  EPH: "Ephesians", PHP: "Philippians", COL: "Colossians",
  "1TH": "1 Thessalonians", "2TH": "2 Thessalonians",
  "1TI": "1 Timothy", "2TI": "2 Timothy", TIT: "Titus", PHM: "Philemon",
  HEB: "Hebrews", JAS: "James", "1PE": "1 Peter", "2PE": "2 Peter",
  "1JN": "1 John", "2JN": "2 John", "3JN": "3 John", JUD: "Jude",
  REV: "Revelation",
};

function normalize(s) {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let booksOut = 0;
let chaptersTotal = 0;
let sectionsTotal = 0;
const warnings = [];
for (const [usfm, name] of Object.entries(BOOKS)) {
  const dir = path.join(SRC_DIR, usfm);
  if (!fs.existsSync(dir)) continue;
  const chapters = [];
  const files = fs.readdirSync(dir)
    .filter((f) => /^\d+\.json$/.test(f))
    .sort((a, z) => Number(a) - Number(z));
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const sections = [];
    for (const item of data.chapter.content) {
      if (item.type !== "verse") continue;
      const text = item.content.map((c) => normalize(c.text ?? "")).filter(Boolean).join("\n\n");
      if (!text) continue;
      sections.push({ verses: String(item.number), text });
    }
    if (sections.length === 0) {
      warnings.push(`${usfm}/${f}: no verse items`);
      continue;
    }
    chapters.push({ chapter: f.replace(/\.json$/, ""), sections });
    sectionsTotal += sections.length;
  }
  if (chapters.length === 0) continue;
  chaptersTotal += chapters.length;
  booksOut++;
  fs.writeFileSync(
    path.join(OUT_DIR, `${name.replace(/ /g, "")}.json`),
    JSON.stringify({ book: name, chapters })
  );
}
console.log(`Wrote ${booksOut} books, ${chaptersTotal} chapters, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings.slice(0, 20)) console.log(`  ${w}`);
}
