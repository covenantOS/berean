#!/usr/bin/env node
/**
 * Extract words-of-Christ verse flags from the World English Bible USFM
 * into the per-book format read by src/lib/redletter.ts.
 *
 * Source: data/_sources/web-usfm/*.usfm (eBible.org eng-web; the WEB text and
 * paratext are dedicated to the public domain).
 * Output: data/redletter/<BookFile>.json for all 66 books.
 *
 * A verse is dominical when a \wj...\wj* span is open at any point inside
 * it. The shipped granularity is the verse: span offsets belong to the WEB
 * wording and do not transfer onto another translation's words, while the
 * flags anchor by canon reference and every furnished text wears them
 * (the pericope set's idiom). Footnote and cross-reference blocks are
 * stripped before the scan so a quotation inside an apparatus note never
 * flags the verse above it. The build also reports how much of each
 * dominical verse the spans cover, so the verse-level choice stays honest.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "_sources", "web-usfm");
const OUT_DIR = path.join(ROOT, "data", "redletter");

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

/** Drop apparatus blocks whose quotations are not the verse text. */
function stripApparatus(line) {
  return line
    .replace(/\\f \+.*?\\f\*/g, " ")
    .replace(/\\x \+.*?\\x\*/g, " ")
    .replace(/\\fig .*?\\fig\*/g, " ");
}

/** Length of the readable text in a chunk: markup and Strong's attributes out. */
function plainLen(chunk) {
  return chunk
    .replace(/\|strong="[^"]*"/g, "")
    .replace(/\\\+?[a-z0-9]+\*?/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let totalVerses = 0;
let fullVerses = 0;
let partVerses = 0;
const flaggedBooks = [];
const warnings = [];

for (const [code, file] of BOOKS) {
  const src = fs
    .readdirSync(SRC_DIR)
    .find((name) => name.endsWith(`${code}eng-web.usfm`));
  if (!src) throw new Error(`No USFM source for ${code}`);
  const lines = fs.readFileSync(path.join(SRC_DIR, src), "utf8").split(/\r?\n/);

  let chapter = 0;
  let verse = null;
  let open = false;
  const chapters = new Map(); // chapter number -> Set of dominical verses
  const coverage = new Map(); // "chapter:verse" -> [dominical chars, verse chars]
  const mark = () => {
    if (verse === null) return;
    let set = chapters.get(chapter);
    if (!set) {
      set = new Set();
      chapters.set(chapter, set);
    }
    set.add(verse);
  };

  for (const raw of lines) {
    const line = stripApparatus(raw);
    // Span and verse tokens in document order; the text between tokens
    // belongs to the current verse, inside the span while it is open.
    const tokenRe = /\\\+?wj(\*)?|\\v (\d+)|\\c (\d+)/g;
    let last = 0;
    for (let m = tokenRe.exec(line); m; m = tokenRe.exec(line)) {
      const chunk = line.slice(last, m.index);
      last = tokenRe.lastIndex;
      if (verse !== null) {
        const key = `${chapter}:${verse}`;
        const acc = coverage.get(key) ?? [0, 0];
        acc[1] += plainLen(chunk);
        if (open) acc[0] += plainLen(chunk);
        coverage.set(key, acc);
      }
      if (m[3] !== undefined) {
        chapter = Number(m[3]);
        verse = null;
      } else if (m[2] !== undefined) {
        verse = Number(m[2]);
        if (open) mark();
      } else if (m[1] === "*") {
        if (!open) warnings.push(`${file}: \\wj* without an open span near ${chapter}:${verse}`);
        open = false;
      } else {
        open = true;
        mark();
      }
    }
    if (verse !== null) {
      const key = `${chapter}:${verse}`;
      const acc = coverage.get(key) ?? [0, 0];
      acc[1] += plainLen(line.slice(last));
      if (open) acc[0] += plainLen(line.slice(last));
      coverage.set(key, acc);
    }
  }
  if (open) warnings.push(`${file}: a span never closes; it runs to the book's end`);

  const out = {
    book: file,
    chapters: [...chapters.entries()]
      .sort(([a], [b]) => a - b)
      .map(([n, set]) => ({ chapter: n, verses: [...set].sort((a, b) => a - b) })),
  };
  const bookCount = out.chapters.reduce((n, c) => n + c.verses.length, 0);
  if (bookCount > 0) flaggedBooks.push(`${file}: ${bookCount}`);
  totalVerses += bookCount;
  for (const c of out.chapters) {
    for (const v of c.verses) {
      const [dom, all] = coverage.get(`${c.chapter}:${v}`) ?? [0, 0];
      if (all > 0 && dom / all >= 0.9) fullVerses++;
      else partVerses++;
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, `${file}.json`), JSON.stringify(out));
}
console.log(`Wrote ${BOOKS.length} books to ${path.relative(ROOT, OUT_DIR)}/`);
console.log(`Dominical verses: ${totalVerses} (span covers the whole verse: ${fullVerses}, part: ${partVerses})`);
console.log(`Books carrying flags: ${flaggedBooks.length}`);
if (flaggedBooks.length) console.log(`  ${flaggedBooks.join(", ")}`);
if (warnings.length) {
  console.log(`Warnings: ${warnings.length}`);
  console.log(`  ${warnings.join("\n  ")}`);
}
