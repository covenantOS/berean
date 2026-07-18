#!/usr/bin/env node
/**
 * Normalize the CrossWire SWORD zCom module of Adam Clarke's Commentary and
 * Critical Notes on the Bible into the format read by src/lib/commentary.ts.
 *
 * Source: data/_sources/clarke/Clarke.zip (see data/_sources/clarke/PROVENANCE.md)
 * Output: data/commentary/clarke/<BookFile>.json.
 *
 * A zCom module is verse-indexed: <t>.bzs lists zlib-compressed blocks in
 * <t>.bzz; <t>.bzv holds one 10-byte record per slot (uint32 block, uint32
 * offset in the uncompressed block, uint16 length), with slots in KJV order
 * (testament marker, then per book: book intro, then per chapter: chapter
 * intro plus one slot per verse). Rather than trusting slot geometry, this
 * script walks every record in order and follows the OSIS markers in the
 * text: book divisions, <chapter n="N"> milestones, and "Verse N" headings.
 * Verses Clarke passes over have empty slots and are skipped. Commentary
 * ahead of the first verse heading (book prefaces, chapter introductions) is
 * kept as an unanchored intro section.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "clarke", "Clarke.zip");
const OUT_DIR = path.join(ROOT, "data", "commentary", "clarke");

// OSIS book abbreviation -> display name, mirroring src/lib/canon.ts.
const BOOKS = {
  Gen: "Genesis", Exod: "Exodus", Lev: "Leviticus", Num: "Numbers",
  Deut: "Deuteronomy", Josh: "Joshua", Judg: "Judges", Ruth: "Ruth",
  "1Sam": "1 Samuel", "2Sam": "2 Samuel", "1Kgs": "1 Kings", "2Kgs": "2 Kings",
  "1Chr": "1 Chronicles", "2Chr": "2 Chronicles", Ezra: "Ezra",
  Neh: "Nehemiah", Esth: "Esther", Job: "Job", Ps: "Psalms",
  Prov: "Proverbs", Eccl: "Ecclesiastes", Song: "Song of Solomon",
  Isa: "Isaiah", Jer: "Jeremiah", Lam: "Lamentations",
  Ezek: "Ezekiel", Dan: "Daniel", Hos: "Hosea", Joel: "Joel", Amos: "Amos",
  Obad: "Obadiah", Jonah: "Jonah", Mic: "Micah", Nah: "Nahum",
  Hab: "Habakkuk", Zeph: "Zephaniah", Hag: "Haggai",
  Zech: "Zechariah", Mal: "Malachi", Matt: "Matthew", Mark: "Mark",
  Luke: "Luke", John: "John", Acts: "Acts", Rom: "Romans",
  "1Cor": "1 Corinthians", "2Cor": "2 Corinthians", Gal: "Galatians",
  Eph: "Ephesians", Phil: "Philippians", Col: "Colossians",
  "1Thess": "1 Thessalonians", "2Thess": "2 Thessalonians",
  "1Tim": "1 Timothy", "2Tim": "2 Timothy", Titus: "Titus", Phlm: "Philemon",
  Heb: "Hebrews", Jas: "James", "1Pet": "1 Peter", "2Pet": "2 Peter",
  "1John": "1 John", "2John": "2 John", "3John": "3 John", Jude: "Jude",
  Rev: "Revelation",
};

/** Read one member of a zip via the system unzip (no new dependencies). */
function unzipMember(member) {
  return execFileSync("unzip", ["-p", ZIP, member], { maxBuffer: 1 << 28 });
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** OSIS fragment -> plain paragraphs, keeping verse-heading lines marked. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/<div[^>]*type="x-p"[^>]*\/>/g, "\n\n");
  s = s.replace(/<\/p>/g, "\n\n");
  s = s.replace(/<br\s*\/?>/g, "\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ");
  s = s.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join("\n\n");
  return s.trim();
}

function* records(bzs, bzv, bzz) {
  const n = Math.floor(bzv.length / 10);
  const blockCache = new Map();
  for (let rec = 0; rec < n; rec++) {
    const block = bzv.readUInt32LE(rec * 10);
    const start = bzv.readUInt32LE(rec * 10 + 4);
    const size = bzv.readUInt16LE(rec * 10 + 8);
    if (size === 0) continue;
    let raw = blockCache.get(block);
    if (!raw) {
      const off = bzs.readUInt32LE(block * 12);
      const csize = bzs.readUInt32LE(block * 12 + 4);
      raw = zlib.inflateSync(bzz.subarray(off, off + csize));
      blockCache.set(block, raw);
    }
    yield raw.subarray(start, start + size).toString("utf8");
  }
}

// book name -> chapter number -> sections[]
const books = new Map();
const warnings = [];
let book = null;
let chapter = 0;
let verse = 0;
let buffer = [];

function flush() {
  const text = clean(buffer.join(" "));
  buffer = [];
  if (!text || !book) return;
  // Material ahead of the first chapter milestone is the book introduction;
  // shelve it with chapter 1 so it is reachable in the reader.
  const ch = chapter === 0 ? 1 : chapter;
  if (!books.has(book)) books.set(book, new Map());
  const chs = books.get(book);
  if (!chs.has(ch)) chs.set(ch, []);
  chs.get(ch).push({ verses: verse ? String(verse) : "", text });
}

for (const t of ["ot", "nt"]) {
  const bzs = unzipMember(`modules/comments/zcom/clarke/${t}.bzs`);
  const bzv = unzipMember(`modules/comments/zcom/clarke/${t}.bzv`);
  const bzz = unzipMember(`modules/comments/zcom/clarke/${t}.bzz`);
  for (const raw of records(bzs, bzv, bzz)) {
    // A record may open with trailing text of the previous verse, then a new
    // chapter milestone or verse heading; split on every boundary marker.
    const parts = raw.split(/(<chapter\s[^>]*\/?>|<div\s[^>]*type="book"[^>]*\/?>|<hi[^>]*>\s*Verses?\s[\d,\s–—-]+\s*<\/hi>)/g);
    for (const part of parts) {
      if (!part) continue;
      const bookDiv = part.match(/^<div\s[^>]*type="book"[^>]*\/?>$/) ? part.match(/osisID="([A-Za-z0-9]+)"/) : null;
      const chapterM = part.match(/^<chapter\s[^>]*n="(\d+)"/);
      const verseH = part.match(/^<hi[^>]*>\s*Verses?\s([\d,\s–—-]+)\s*<\/hi>$/);
      if (bookDiv) {
        flush();
        book = BOOKS[bookDiv[1]] ?? null;
        if (!book) warnings.push(`unknown book osisID ${bookDiv[1]}`);
        chapter = 0;
        verse = 0;
        continue;
      }
      if (chapterM) {
        flush();
        chapter = Number(chapterM[1]);
        verse = 0;
        buffer.push(part); // harmless; clean() strips the milestone tag
        continue;
      }
      if (verseH) {
        flush();
        const label = verseH[1].replace(/\s+/g, "").replace(/[–—]/g, "-");
        verse = label; // may be a range like "8-10"
        continue;
      }
      buffer.push(part);
    }
  }
  flush();
  book = null;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let booksOut = 0;
let chaptersTotal = 0;
let sectionsTotal = 0;
for (const [name, chs] of books) {
  const chapters = [...chs.entries()]
    .sort((a, z) => a[0] - z[0])
    .map(([n, sections]) => ({ chapter: String(n), sections }));
  chaptersTotal += chapters.length;
  sectionsTotal += chapters.reduce((t, c) => t + c.sections.length, 0);
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
