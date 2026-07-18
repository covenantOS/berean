#!/usr/bin/env node
/**
 * Normalize the Treasury of Scripture Knowledge (TSK) export into the
 * per-book cross-reference format read by src/lib/crossrefs.ts.
 *
 * Source: data/_sources/tskxref.txt (TAB-delimited; see data/_sources/tsk-readme.txt)
 * Output: data/crossrefs/<BookFile>.json for all 66 books.
 *
 * TSK rows are per (verse, anchor-phrase); this script merges every row for a
 * source verse into one de-duplicated ref list. TSK carries no popularity
 * votes, so `votes` is emitted as 0.
 *
 * Refs pointing at chapters/verses that do not exist in data/kjv-strongs are
 * dropped (and counted), never clamped.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "data", "_sources", "tskxref.txt");
const KJV_DIR = path.join(ROOT, "data", "kjv-strongs");
const OUT_DIR = path.join(ROOT, "data", "crossrefs");

// Canonical books, mirroring src/lib/canon.ts (slug = lowercase name, spaces -> hyphens).
const BOOKS = [
  [1, "Genesis"], [2, "Exodus"], [3, "Leviticus"], [4, "Numbers"], [5, "Deuteronomy"],
  [6, "Joshua"], [7, "Judges"], [8, "Ruth"], [9, "1 Samuel"], [10, "2 Samuel"],
  [11, "1 Kings"], [12, "2 Kings"], [13, "1 Chronicles"], [14, "2 Chronicles"],
  [15, "Ezra"], [16, "Nehemiah"], [17, "Esther"], [18, "Job"], [19, "Psalms"],
  [20, "Proverbs"], [21, "Ecclesiastes"], [22, "Song of Solomon"], [23, "Isaiah"],
  [24, "Jeremiah"], [25, "Lamentations"], [26, "Ezekiel"], [27, "Daniel"], [28, "Hosea"],
  [29, "Joel"], [30, "Amos"], [31, "Obadiah"], [32, "Jonah"], [33, "Micah"],
  [34, "Nahum"], [35, "Habakkuk"], [36, "Zephaniah"], [37, "Haggai"], [38, "Zechariah"],
  [39, "Malachi"], [40, "Matthew"], [41, "Mark"], [42, "Luke"], [43, "John"],
  [44, "Acts"], [45, "Romans"], [46, "1 Corinthians"], [47, "2 Corinthians"],
  [48, "Galatians"], [49, "Ephesians"], [50, "Philippians"], [51, "Colossians"],
  [52, "1 Thessalonians"], [53, "2 Thessalonians"], [54, "1 Timothy"], [55, "2 Timothy"],
  [56, "Titus"], [57, "Philemon"], [58, "Hebrews"], [59, "James"], [60, "1 Peter"],
  [61, "2 Peter"], [62, "1 John"], [63, "2 John"], [64, "3 John"], [65, "Jude"],
  [66, "Revelation"],
].map(([num, name]) => ({
  num,
  name,
  file: name.replace(/ /g, ""),
  slug: name.toLowerCase().replace(/ /g, "-"),
}));

// TSK abbreviations, per data/_sources/tsk-readme.txt.
const ABBREV = {
  ge: 1, ex: 2, le: 3, nu: 4, de: 5, jos: 6, jud: 7, ru: 8, "1sa": 9, "2sa": 10,
  "1ki": 11, "2ki": 12, "1ch": 13, "2ch": 14, ezr: 15, ne: 16, es: 17, job: 18,
  ps: 19, pr: 20, ec: 21, so: 22, isa: 23, jer: 24, la: 25, eze: 26, da: 27,
  ho: 28, joe: 29, am: 30, ob: 31, jon: 32, mic: 33, na: 34, hab: 35, zep: 36,
  hag: 37, zec: 38, mal: 39, mt: 40, mr: 41, lu: 42, joh: 43, ac: 44, ro: 45,
  "1co": 46, "2co": 47, ga: 48, eph: 49, php: 50, col: 51, "1th": 52, "2th": 53,
  "1ti": 54, "2ti": 55, tit: 56, phm: 57, heb: 58, jas: 59, "1pe": 60, "2pe": 61,
  "1jo": 62, "2jo": 63, "3jo": 64, jude: 65, re: 66,
};

// Actual verse counts per chapter, from the shipped KJV text.
const verseCounts = new Map(); // bookNum -> Map(chapter -> verseCount)
for (const b of BOOKS) {
  const raw = JSON.parse(fs.readFileSync(path.join(KJV_DIR, `${b.file}.json`), "utf8"));
  verseCounts.set(b.num, new Map(raw.chapters.map((c) => [Number(c.chapter), c.verses.length])));
}
function verseExists(bookNum, chapter, verse) {
  return verse <= (verseCounts.get(bookNum)?.get(chapter) ?? 0);
}

/** Parse one TSK ref like "pr 8:22-24" or "ps 33:6,9" into {bookNum, chapter, ranges[]}. */
function parseRef(token) {
  const m = token.trim().match(/^([a-z0-9]+)\s+(\d+):(\d+(?:-\d+)?(?:\s*,\s*\d+(?:-\d+)?)*)$/);
  if (!m) return null;
  const bookNum = ABBREV[m[1]];
  if (!bookNum) return null;
  const chapter = Number(m[2]);
  const ranges = m[3].split(",").map((part) => {
    const [a, b] = part.trim().split("-").map(Number);
    return { start: a, end: b ?? a };
  });
  return { bookNum, chapter, ranges };
}

const out = new Map(BOOKS.map((b) => [b.num, new Map()])); // bookNum -> Map("c:v" -> Map(dedupeKey -> ref))
let droppedInvalid = 0;
let droppedUnparseable = 0;
const unparseableSamples = new Set();

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);
for (const line of lines) {
  if (!line.trim()) continue;
  const [bookKey, ch, vs, , , refList] = line.split("\t");
  const fromBook = Number(bookKey);
  const fromCh = Number(ch);
  const fromVs = Number(vs);
  if (!refList) continue;
  const sourceKey = `${fromCh}:${fromVs}`;
  let verseMap = out.get(fromBook).get(sourceKey);
  if (!verseMap) {
    verseMap = new Map();
    out.get(fromBook).set(sourceKey, verseMap);
  }
  for (const token of refList.split(";")) {
    const parsed = parseRef(token);
    if (!parsed) {
      if (token.trim()) {
        droppedUnparseable++;
        if (unparseableSamples.size < 10) unparseableSamples.add(token.trim());
      }
      continue;
    }
    const book = BOOKS[parsed.bookNum - 1];
    for (const { start, end } of parsed.ranges) {
      if (!verseExists(parsed.bookNum, parsed.chapter, start) || !verseExists(parsed.bookNum, parsed.chapter, end)) {
        droppedInvalid++;
        continue;
      }
      const ref = end > start
        ? `${book.name} ${parsed.chapter}:${start}-${end}`
        : `${book.name} ${parsed.chapter}:${start}`;
      const entry = { ref, slug: book.slug, chapter: parsed.chapter, verse: start, votes: 0 };
      if (end > start) entry.endVerse = end;
      verseMap.set(`${parsed.bookNum}:${parsed.chapter}:${start}:${end}`, entry);
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let totalRefs = 0;
for (const b of BOOKS) {
  const verseMap = out.get(b.num);
  const obj = {};
  const keys = [...verseMap.keys()].sort((a, z) => {
    const [ac, av] = a.split(":").map(Number);
    const [zc, zv] = z.split(":").map(Number);
    return ac - zc || av - zv;
  });
  for (const k of keys) {
    obj[k] = [...verseMap.get(k).values()].sort(
      (a, z) => a.chapter - z.chapter || a.verse - z.verse || (a.endVerse ?? 0) - (z.endVerse ?? 0)
    );
    totalRefs += obj[k].length;
  }
  fs.writeFileSync(path.join(OUT_DIR, `${b.file}.json`), JSON.stringify(obj));
}
console.log(`Wrote ${BOOKS.length} books to ${path.relative(ROOT, OUT_DIR)}/`);
console.log(`Total target refs: ${totalRefs}`);
console.log(`Dropped (invalid chapter/verse): ${droppedInvalid}`);
console.log(`Dropped (unparseable tokens): ${droppedUnparseable}`);
if (unparseableSamples.size) console.log(`Unparseable samples: ${[...unparseableSamples].join(" | ")}`);
