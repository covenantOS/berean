#!/usr/bin/env node
/**
 * Extract pericope boundaries and headings from the Berean Study Bible USFM
 * into the per-book format read by src/lib/pericopes.ts.
 *
 * Source: data/_sources/bsb-usfm/*.usfm (eBible.org engbsb; the BSB text and
 * paratext are dedicated to the public domain).
 * Output: data/pericopes/<BookFile>.json for all 66 books.
 *
 * A \s1 or \s2 heading names the passage that starts at the next verse; a
 * \r line under a heading carries its parallel passages. Headings sharing a
 * start verse merge into one entry. Psalm superscriptions (\d) and book
 * divisions (\ms1) are not pericopes and stay out.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "_sources", "bsb-usfm");
const OUT_DIR = path.join(ROOT, "data", "pericopes");

// USFM book code -> canonical book file, mirroring src/lib/canon.ts.
const BOOKS = [
  ["GEN", "Genesis"], ["EXO", "Exodus"], ["LEV", "Leviticus"], ["NUM", "Numbers"],
  ["DEU", "Deuteronomy"], ["JOS", "Joshua"], ["JDG", "Judges"], ["RUT", "Ruth"],
  ["1SA", "1Samuel"], ["2SA", "2Samuel"], ["1KI", "1Kings"], ["2KI", "2Kings"],
  ["1CH", "1Chronicles"], ["2CH", "2Chronicles"], ["EZR", "Ezra"], ["NEH", "Nehemiah"],
  ["EST", "Esther"], ["JOB", "Job"], ["PSA", "Psalms"], ["PRO", "Proverbs"],
  ["ECC", "Ecclesiastes"], ["SNG", "SongofSolomon"], ["ISA", "Isaiah"], ["JER", "Jeremiah"],
  ["LAM", "Lamentations"], ["EZK", "Ezekiel"], ["DAN", "Daniel"], ["HOS", "Hosea"],
  ["JOL", "Joel"], ["AMO", "Amos"], ["OBA", "Obadiah"], ["JON", "Jonah"],
  ["MIC", "Micah"], ["NAM", "Nahum"], ["HAB", "Habakkuk"], ["ZEP", "Zephaniah"],
  ["HAG", "Haggai"], ["ZEC", "Zechariah"], ["MAL", "Malachi"], ["MAT", "Matthew"],
  ["MRK", "Mark"], ["LUK", "Luke"], ["JHN", "John"], ["ACT", "Acts"],
  ["ROM", "Romans"], ["1CO", "1Corinthians"], ["2CO", "2Corinthians"], ["GAL", "Galatians"],
  ["EPH", "Ephesians"], ["PHP", "Philippians"], ["COL", "Colossians"], ["1TH", "1Thessalonians"],
  ["2TH", "2Thessalonians"], ["1TI", "1Timothy"], ["2TI", "2Timothy"], ["TIT", "Titus"],
  ["PHM", "Philemon"], ["HEB", "Hebrews"], ["JAS", "James"], ["1PE", "1Peter"],
  ["2PE", "2Peter"], ["1JN", "1John"], ["2JN", "2John"], ["3JN", "3John"],
  ["JUD", "Jude"], ["REV", "Revelation"],
];

/** Strip USFM word markup and Strong's attributes from a heading line. */
function cleanHeading(text) {
  return text
    .replace(/\\w\s+/g, "")
    .replace(/\\w\*/g, "")
    .replace(/\|strong="[^"]*"/g, "")
    .replace(/\\[a-z0-9]+\*?\s?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip the wrapping parentheses from a \r parallel list. */
function cleanParallels(text) {
  return text.replace(/^\s*\((.*)\)\s*$/, "$1").trim();
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let totalSections = 0;
let totalParallels = 0;
const emptyChapters = [];

for (const [code, file] of BOOKS) {
  const src = fs
    .readdirSync(SRC_DIR)
    .find((name) => name.endsWith(`${code}engbsb.usfm`));
  if (!src) throw new Error(`No USFM source for ${code}`);
  const lines = fs.readFileSync(path.join(SRC_DIR, src), "utf8").split(/\r?\n/);

  let chapter = 0;
  let pending = []; // headings waiting for the verse that starts their passage
  const chapters = new Map(); // chapter number -> sections[]
  const flush = (verse) => {
    if (pending.length === 0) return;
    let sections = chapters.get(chapter);
    if (!sections) {
      sections = [];
      chapters.set(chapter, sections);
    }
    for (const p of pending) {
      const existing = sections.find((s) => s.verse === verse);
      if (existing) {
        existing.heading = `${existing.heading} · ${p.heading}`;
        if (p.parallels) {
          existing.parallels = existing.parallels
            ? `${existing.parallels}; ${p.parallels}`
            : p.parallels;
        }
      } else {
        sections.push({ verse, heading: p.heading, ...(p.parallels ? { parallels: p.parallels } : {}) });
        totalSections++;
      }
    }
    pending = [];
  };

  for (const line of lines) {
    const head = line.match(/^\\([a-z0-9]+)\s?(.*)$/);
    if (!head) continue;
    const [, marker, rest] = head;
    if (marker === "c") {
      pending = []; // a heading after the chapter's last verse names nothing here
      chapter = Number(rest);
    } else if (marker === "s1" || marker === "s2") {
      const heading = cleanHeading(rest);
      if (heading) pending.push({ heading });
    } else if (marker === "r") {
      const parallels = cleanParallels(rest);
      if (parallels && pending.length > 0) {
        pending[pending.length - 1].parallels = parallels;
        totalParallels++;
      }
    } else if (marker === "v") {
      const verse = parseInt(rest, 10);
      if (Number.isInteger(verse)) flush(verse);
    }
  }

  const out = {
    book: file,
    chapters: [...chapters.entries()]
      .sort(([a], [b]) => a - b)
      .map(([n, sections]) => ({ chapter: n, sections })),
  };
  const covered = new Set(out.chapters.map((c) => c.chapter));
  for (let c = 1; c <= chapter; c++) {
    if (!covered.has(c)) emptyChapters.push(`${file} ${c}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, `${file}.json`), JSON.stringify(out));
}
console.log(`Wrote ${BOOKS.length} books to ${path.relative(ROOT, OUT_DIR)}/`);
console.log(`Total pericopes: ${totalSections}, with parallels: ${totalParallels}`);
console.log(`Chapters without a heading: ${emptyChapters.length}`);
if (emptyChapters.length) console.log(`  ${emptyChapters.join(", ")}`);
