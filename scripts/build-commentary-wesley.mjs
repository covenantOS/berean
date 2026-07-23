#!/usr/bin/env node
/**
 * Normalize the CrossWire SWORD zCom module of John Wesley's Explanatory
 * Notes on the Bible into the format read by src/lib/commentary.ts.
 *
 * Source: data/_sources/wesley/Wesley.zip (see data/_sources/wesley/PROVENANCE.md)
 * Output: data/commentary/wesley/<BookFile>.json.
 *
 * A zCom module is verse-indexed: <t>.bzs lists zlib-compressed blocks in
 * <t>.bzz; <t>.bzv holds one 10-byte record per slot (uint32 block, uint32
 * offset in the uncompressed block, uint16 length). Slots are positional in
 * KJV order: slot 0 is the testament marker, slot 1 an importer milestone,
 * then per book one book-introduction slot, and per chapter one
 * chapter-introduction slot plus one slot per verse (verified against the
 * module's record counts: 24115 OT, 8246 NT). Wesley's module carries no
 * book or chapter introductions, only verse notes, so the slot geometry
 * alone anchors every note; empty slots are verses Wesley passes over.
 *
 * The module duplicates a multi-verse note into every slot it covers. A
 * short run of identical text inside one chapter (five verses or fewer) is a
 * genuine span note and ships as one range section ("3-5"). Longer runs are
 * flood damage from the module's production: lost notes overwritten by a
 * neighboring note (all of Judges by a Joshua fragment, all of Jonah by the
 * Amos 9:15 note, Psalm 143:1-8 by the 143:8 note, and like runs). A
 * flooded run ships only its first verse as a single-verse section, and
 * only when the note's opening catch-phrase is found in that verse's KJV
 * text; otherwise the whole run is dropped as displaced or unverifiable.
 * A book whose slots one text covers at 90% or more is dropped entirely
 * (Judges, Jonah). 1 Kings and Philemon are absent from the source module.
 * Every drop is counted and reported.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "wesley", "Wesley.zip");
const OUT_DIR = path.join(ROOT, "data", "commentary", "wesley");

/* Canonical book files in KJV order, mirroring src/lib/canon.ts; the
 * per-chapter verse counts and verse texts come from the shipped KJV so the
 * slot map and the catch-phrase checks match Berean's own canon. */
const ORDER = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
  "Judges", "Ruth", "1Samuel", "2Samuel", "1Kings", "2Kings",
  "1Chronicles", "2Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
  "Psalms", "Proverbs", "Ecclesiastes", "SongofSolomon", "Isaiah",
  "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
  "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1Corinthians", "2Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1Thessalonians", "2Thessalonians",
  "1Timothy", "2Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1Peter", "2Peter", "1John", "2John", "3John", "Jude", "Revelation",
];

const canon = ORDER.map((file, i) => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kjv", `${file}.json`), "utf8"));
  return {
    book: d.book,
    file,
    ot: i < 39,
    chapters: d.chapters.map((c) => c.verses.length),
    kjv: d.chapters.map((c) => c.verses.map((v) => v.text)),
  };
});

/** Read one member of the zip via the system unzip (no new dependencies). */
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

/** ThML fragment -> plain paragraphs. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/<br\s*\/?>/g, "\n");
  s = s.replace(/<\/p>/g, "\n\n");
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
    yield { rec, text: raw.subarray(start, start + size).toString("utf8") };
  }
}

const STOP = new Set(["the", "and", "for", "that", "this", "with", "from", "shall", "will", "have", "has", "not", "but", "are", "was", "were", "his", "him", "her", "she", "thou", "thee", "thy", "ye", "you", "your", "our", "out", "who", "whom", "said", "say", "unto", "upon", "they", "them", "their", "which", "when", "then", "than", "into", "also"]);

/** The note's catch-phrase (Wesley's "phrase - comment" opener), and whether
 * any of its content words appear in the verse's KJV text. Short words are
 * matched whole ("I", "We", "He"); longer words by word boundary. A
 * catch-phrase that is one short word ("I") is tested as a whole word. */
function anchorsToVerse(noteText, verseText) {
  const catchPhrase = noteText.split(" - ")[0].slice(0, 80).trim();
  const hay = ` ${verseText.toLowerCase().replace(/[^a-z'\s]/g, " ")} `;
  const probe = (w) => hay.includes(` ${w} `) || hay.includes(` ${w}s `) || hay.includes(` ${w}eth `) || hay.includes(` ${w}ed `);
  if (/^[a-z']{1,3}$/i.test(catchPhrase)) return probe(catchPhrase.toLowerCase());
  const words = catchPhrase.toLowerCase().match(/[a-z']+/g) ?? [];
  for (const w of words) {
    if (w.length >= 4 && !STOP.has(w) && probe(w)) return true;
  }
  for (const w of words) {
    if (w.length >= 2 && w.length < 4 && probe(w)) return true;
  }
  return false;
}

const stats = { spanRanges: 0, floodKept: 0, floodDropped: 0, booksDropped: [] };
const books = new Map();

for (const t of ["ot", "nt"]) {
  const bzs = unzipMember(`modules/comments/zcom/wesley/${t}.bzs`);
  const bzv = unzipMember(`modules/comments/zcom/wesley/${t}.bzv`);
  const bzz = unzipMember(`modules/comments/zcom/wesley/${t}.bzz`);

  const texts = new Map();
  for (const { rec, text } of records(bzs, bzv, bzz)) {
    const c = clean(text);
    if (c) texts.set(rec, c);
  }

  let slot = 2;
  for (const b of canon.filter((x) => x.ot === (t === "ot"))) {
    slot += 1; // book-introduction slot (always empty in this module)

    /* Gather the book's verse notes with their references and group
     * consecutive identical texts into runs. */
    const notes = [];
    for (let ch = 1; ch <= b.chapters.length; ch++) {
      slot += 1; // chapter-introduction slot
      for (let v = 1; v <= b.chapters[ch - 1]; v++) {
        const text = texts.get(slot);
        if (text) notes.push({ ch, v, text });
        slot += 1;
      }
    }
    const runs = [];
    for (const n of notes) {
      const last = runs[runs.length - 1];
      if (last && last.text === n.text) last.end = n;
      else runs.push({ text: n.text, start: n, end: n });
    }

    /* Whole-book flood: one text covering nearly every noted slot means the
     * book's own notes are lost in the source; drop the book. */
    const total = notes.length;
    const dominant = runs.reduce((m, r) => {
      const n = countSlots(b, r);
      return n > m.n ? { n, r } : m;
    }, { n: 0, r: null });
    if (total > 0 && dominant.n / total >= 0.9 && dominant.n >= 20) {
      stats.booksDropped.push(`${b.book} (one text floods ${dominant.n}/${total} noted slots)`);
      continue;
    }

    const chs = new Map();
    for (const r of runs) {
      const slots = countSlots(b, r);
      const sameChapter = r.start.ch === r.end.ch;
      const push = (ch, sections) => {
        if (!chs.has(ch)) chs.set(ch, []);
        chs.get(ch).push(sections);
      };
      if (sameChapter && slots <= 5) {
        const label = slots === 1 ? String(r.start.v) : `${r.start.v}-${r.end.v}`;
        if (slots > 1) stats.spanRanges++;
        push(r.start.ch, { verses: label, text: r.text });
        continue;
      }
      /* Flood damage: ship only the first verse, and only when the note's
       * catch-phrase verifies against that verse's KJV text. */
      if (anchorsToVerse(r.text, b.kjv[r.start.ch - 1][r.start.v - 1])) {
        push(r.start.ch, { verses: String(r.start.v), text: r.text });
        stats.floodKept++;
      } else {
        stats.floodDropped++;
      }
    }
    if (chs.size) books.set(b.book, chs);
  }
  const actual = Math.floor(bzv.length / 10);
  if (slot !== actual) {
    console.log(`warning: ${t} slot geometry mismatch: walked ${slot}, module holds ${actual}`);
  }
}

/** The number of verse slots a run covers (chapters may differ). */
function countSlots(book, r) {
  if (r.start.ch === r.end.ch) return r.end.v - r.start.v + 1;
  let n = book.chapters[r.start.ch - 1] - r.start.v + 1;
  for (let ch = r.start.ch + 1; ch < r.end.ch; ch++) n += book.chapters[ch - 1];
  return n + r.end.v;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
/* Drop stale outputs for books this build no longer emits (flood-dropped
 * books, coverage changes). */
for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, f));
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
console.log(`Span ranges merged: ${stats.spanRanges}; flooded runs kept at first verse: ${stats.floodKept}; flooded runs dropped: ${stats.floodDropped}`);
if (stats.booksDropped.length) console.log(`Books dropped as flood-damaged: ${stats.booksDropped.join("; ")}`);
