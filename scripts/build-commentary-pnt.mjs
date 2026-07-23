#!/usr/bin/env node
/**
 * Normalize the CrossWire SWORD zCom module of B. W. Johnson's People's New
 * Testament into the format read by src/lib/commentary.ts.
 *
 * Source: data/_sources/pnt/PNT.zip (see data/_sources/pnt/PROVENANCE.md)
 * Output: data/commentary/pnt/<BookFile>.json.
 *
 * A zCom module is verse-indexed: <t>.bzs lists zlib-compressed blocks in
 * <t>.bzz; <t>.bzv holds one 10-byte record per slot (uint32 block, uint32
 * offset in the uncompressed block, uint16 length). Slots are positional in
 * KJV order: slot 0 is the testament marker, slot 1 an importer milestone,
 * then per book one book-introduction slot, and per chapter one
 * chapter-introduction slot plus one slot per verse (verified against the
 * module's record count: 8246 NT). The module is New Testament only; the
 * zip carries no Old Testament files, so Old Testament books honestly have
 * no volume. The markup is ThML, not OSIS.
 *
 * The module's condition, mapped record by record:
 *
 * - Johnson opens most chapters with a heading and a "SUMMARY OF <BOOK> N:"
 *   outline riding the chapter's first-verse slot ahead of the verse-1
 *   notes. The split ships the heading and summary as an intro section
 *   (verses ""), the convention of the other builds, and the rest as the
 *   verse-1 note. The summary's own book and chapter name govern where the
 *   intro shelves: Matthew 8's summary rides the 9:1 slot and Matthew 9's
 *   summary the 8:1 slot (production swap; each intro shelves at the
 *   chapter its summary names). Some records are heading and summary alone
 *   (Matthew 11:1), yielding an intro and no verse note; some chapters
 *   carry no summary at all (Jude).
 * - Sixteen books carry a spurious record in their chapter-1 introduction
 *   slot: an exact duplicate of a verse note from the previous book (Mark 1
 *   holds Matthew 27:66's note, Acts 1 holds John 20:31's, and so on).
 *   These are production artifacts, not introductions; they are dropped and
 *   counted (spuriousDupes).
 * - Ten records run past their own verse: the note for verse v is
 *   followed by an embedded "c:v+1" marker and the next verse's note, and
 *   the whole record is duplicated into the covered slots (Luke 10:25, John
 *   13:14, Acts 25:9, and seven records in Revelation, one of which (13:18)
 *   runs through the chapter seam into 14:1 and 14:2, chapter summary
 *   included; Luke 10:24's own note is absent, its slot holding only the
 *   10:25 continuation). The build splits each such record at its embedded
 *   markers and shelves each piece at the verse the marker names
 *   (seamSplits); slots whose text is a record already consumed by a split
 *   are dropped (floodDupes).
 *
 * Notes are keyed to the verse Johnson hung them on; verses without a note
 * simply do not appear. The module has no Philemon content at all, so
 * Philemon honestly has no volume.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "pnt", "PNT.zip");
const OUT_DIR = path.join(ROOT, "data", "commentary", "pnt");

/* Canonical book files in KJV order, mirroring src/lib/canon.ts; the
 * per-chapter verse counts come from the shipped KJV text so the slot map
 * matches Berean's own canon. Only the New Testament is walked: the module
 * carries no Old Testament files. */
const ORDER = [
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
  "1Corinthians", "2Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1Thessalonians", "2Thessalonians", "1Timothy", "2Timothy",
  "Titus", "Philemon", "Hebrews", "James", "1Peter", "2Peter", "1John",
  "2John", "3John", "Jude", "Revelation",
];

const canon = ORDER.map((file) => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kjv", `${file}.json`), "utf8"));
  return { book: d.book, file, chapters: d.chapters.map((c) => c.verses.length) };
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

/** ThML fragment -> plain paragraphs. Every scripRef's visible text is
 * kept; <br /> separates the notes within a verse. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/<br\s*\/?>/g, "\n\n");
  s = s.replace(/<\/p>/g, "\n\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ");
  s = s.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join("\n\n");
  return s.trim();
}

/** Splits a first-verse slot's text into the chapter's heading-plus-summary
 * intro and the verse-1 notes. The summary names its own book and chapter
 * ("SUMMARY OF MATTHEW 8:"), and two of them ride a neighboring first-verse
 * slot (Matthew 8's summary sits in the 9:1 slot, Matthew 9's in the 8:1
 * slot), so the intro routes to the chapter the summary names. One-chapter
 * books carry no number ("SUMMARY OF II JOHN:"). A record that is heading
 * and summary alone (Matthew 11) yields an intro and no note. Returns
 * { introChapter, intro, note }; intro is null when the slot carries no
 * summary. */
const SUMMARY_RE =
  /^\s*((?:<b>[^<]*<\/b>[.\s]*)?SUMMARY OF ([A-Z0-9]+(?: [A-Z0-9]+)*?)\s*(\d+)?\s*[.:]\s*[\s\S]*?)(?:<br\s*\/?>([\s\S]*))?$/;

function splitSummary(raw, bookName, chapter) {
  const m = raw.match(SUMMARY_RE);
  if (!m) return { introChapter: null, intro: null, note: raw };
  /* "SUMMARY OF CHAPTER N:" (Hebrews 5 and 6) names no book at all. */
  const named = m[2] === "CHAPTER" ? normalizeBook(bookName) : normalizeBook(m[2]);
  const namedChapter = m[3] ? Number(m[3]) : 1;
  return {
    introChapter: named === normalizeBook(bookName) ? namedChapter : null,
    intro: m[1],
    note: m[4] ?? "",
    named,
  };
}

/** Uppercase, space-insensitive book comparison; the module writes John as
 * JOH, Hebrews as HEBREW, and Corinthians in the singular, and the epistles
 * of John and Corinthians with Roman numerals. */
const BOOK_ALIASES = {
  JOH: "JOHN",
  HEBREW: "HEBREWS",
  "1CORINTHIAN": "1CORINTHIANS",
  "2CORINTHIAN": "2CORINTHIANS",
};

function normalizeBook(name) {
  let s = name.toUpperCase().replace(/\s+/g, "");
  s = s.replace(/^III/, "3").replace(/^II/, "2").replace(/^I(?!V)/, "1");
  return BOOK_ALIASES[s] ?? s;
}

/** Embedded verse markers a flooded record carries, e.g. "14:1 <scripRef>Re
 * 14:1</scripRef>": the marker's own numbers must agree with the scripRef's
 * visible reference. */
function seams(raw) {
  const out = [];
  for (const m of raw.matchAll(/(\d{1,3}):(\d{1,3})\s*<scripRef>([^<]*)<\/scripRef>/g)) {
    const ch = Number(m[1]);
    const v = Number(m[2]);
    const refMatch = m[3].match(/(\d{1,3}):(\d{1,3})/);
    if (!refMatch || Number(refMatch[1]) !== ch || Number(refMatch[2]) !== v) continue;
    out.push({ index: m.index, len: m[0].length, ch, v });
  }
  return out;
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

const stats = {
  intros: 0,
  spuriousDupes: 0,
  seamSplits: 0,
  floodDupes: 0,
  spanRanges: 0,
  displacedIntros: 0,
  droppedIntros: 0,
  summaryBookMismatch: 0,
};
const books = new Map();

const bzs = unzipMember("modules/comments/zcom/pnt/nt.bzs");
const bzv = unzipMember("modules/comments/zcom/pnt/nt.bzv");
const bzz = unzipMember("modules/comments/zcom/pnt/nt.bzz");

const raws = new Map();
for (const { rec, text } of records(bzs, bzv, bzz)) {
  if (text.trim()) raws.set(rec, text);
}

/* Slot map: slot 2 is the first book-introduction slot. */
function slotOf(bookIdx, chapter, verse) {
  let slot = 2;
  for (let i = 0; i < bookIdx; i++) {
    slot += 1 + canon[i].chapters.reduce((t, n) => t + 1 + n, 0);
  }
  slot += 1; /* book introduction */
  for (let c = 1; c < chapter; c++) slot += 1 + canon[bookIdx].chapters[c - 1];
  slot += 1; /* chapter introduction */
  return slot + (verse - 1);
}

/** Shelves one note at its reference, splitting off the chapter summary
 * when the note opens a chapter. The intro goes to the chapter the summary
 * names, which is the note's own chapter in every case but the two swapped
 * Matthew summaries. */
function shelve(bookIdx, ch, v, raw) {
  const b = canon[bookIdx];
  let chs = books.get(b.book);
  if (!chs) {
    chs = new Map();
    books.set(b.book, chs);
  }
  let note = raw;
  if (v === 1) {
    const { introChapter, intro, note: rest, named } = splitSummary(raw, b.book, ch);
    if (intro !== null) {
      const c = clean(intro);
      const targetChapter = introChapter ?? ch;
      if (introChapter === null) {
        console.log(`warning: summary at ${b.book} ${ch}:1 names ${named}; shelved at its own chapter`);
        stats.summaryBookMismatch++;
      }
      if (introChapter !== null && introChapter !== ch) stats.displacedIntros++;
      if (c) {
        let sections = chs.get(targetChapter);
        if (!sections) {
          sections = [];
          chs.set(targetChapter, sections);
        }
        if (sections.some((s) => s.verses === "")) {
          console.log(`warning: second intro for ${b.book} ${targetChapter}; dropped`);
          stats.droppedIntros++;
        } else {
          sections.unshift({ verses: "", text: c });
          stats.intros++;
        }
      }
    }
    note = rest;
  }
  const text = clean(note);
  if (!text) return;
  const sections = chs.get(ch) ?? [];
  if (!chs.get(ch)) chs.set(ch, sections);
  const last = sections[sections.length - 1];
  if (last && last.verses !== "" && last.text === text) {
    /* A duplicated span note merges into one range section. */
    const m = last.verses.match(/^(\d+)$/);
    if (m) {
      last.verses = `${m[1]}-${v}`;
      stats.spanRanges++;
    }
    return;
  }
  sections.push({ verses: String(v), text });
}

/* Pass 1: repair flooded records. A record with embedded verse markers is
 * split at its markers; the head stays at its own verse and each following
 * segment is shelved at the verse its marker names. Blobs consumed this way
 * are remembered so their duplicate slots are dropped in pass 2. */
const consumedBlobs = new Set();
const seenVerseTexts = new Set();
for (let bi = 0; bi < canon.length; bi++) {
  const b = canon[bi];
  for (let ch = 1; ch <= b.chapters.length; ch++) {
    for (let v = 1; v <= b.chapters[ch - 1]; v++) {
      const raw = raws.get(slotOf(bi, ch, v));
      if (!raw) continue;
      seenVerseTexts.add(raw);
      if (consumedBlobs.has(raw)) continue; /* a later duplicate of a split record */
      const marks = seams(raw);
      if (!marks.length) continue;
      /* The segments must stay inside this book and move forward. */
      const valid = marks.every(
        (m, i) =>
          m.ch <= b.chapters.length &&
          m.v <= b.chapters[m.ch - 1] &&
          (m.ch > ch || (m.ch === ch && m.v > v)) &&
          (i === 0 || m.ch > marks[i - 1].ch || (m.ch === marks[i - 1].ch && m.v > marks[i - 1].v))
      );
      if (!valid) {
        console.log(`warning: embedded markers at ${b.book} ${ch}:${v} do not form a forward run; left as one note`);
        continue;
      }
      const head = raw.slice(0, marks[0].index);
      shelve(bi, ch, v, head);
      for (let i = 0; i < marks.length; i++) {
        const end = i + 1 < marks.length ? marks[i + 1].index : raw.length;
        const seg = raw
          .slice(marks[i].index + marks[i].len, end)
          .replace(/^(\s*<br\s*\/?>)+/, "");
        shelve(bi, marks[i].ch, marks[i].v, seg);
      }
      consumedBlobs.add(raw);
      stats.seamSplits++;
    }
  }
}

/* Pass 2: the regular walk. Slots whose text was consumed by a split, and
 * chapter-1 introduction slots duplicating a verse note of the previous
 * book, are dropped. */
for (let bi = 0; bi < canon.length; bi++) {
  const b = canon[bi];
  for (let ch = 1; ch <= b.chapters.length; ch++) {
    const ciRaw = raws.get(slotOf(bi, ch, 0));
    if (ciRaw) {
      if (ch === 1 && seenVerseTexts.has(ciRaw)) stats.spuriousDupes++;
      else {
        /* A genuine chapter introduction would ship as an intro section;
         * the module carries none. */
        const c = clean(ciRaw);
        if (c) {
          let chs = books.get(b.book);
          if (!chs) {
            chs = new Map();
            books.set(b.book, chs);
          }
          const sections = chs.get(ch) ?? [];
          sections.unshift({ verses: "", text: c });
          chs.set(ch, sections);
          stats.intros++;
        }
      }
    }
    for (let v = 1; v <= b.chapters[ch - 1]; v++) {
      const raw = raws.get(slotOf(bi, ch, v));
      if (!raw) continue;
      if (consumedBlobs.has(raw)) {
        stats.floodDupes++;
        continue;
      }
      if (seams(raw).length) continue; /* already shelved by pass 1 */
      shelve(bi, ch, v, raw);
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
/* Drop stale outputs for books this build no longer emits. */
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
console.log(`Wrote ${booksOut} books, ${chaptersTotal} chapters, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/ (${stats.intros} intro sections (${stats.displacedIntros} displaced, ${stats.droppedIntros} dropped, ${stats.summaryBookMismatch} book mismatches), ${stats.spuriousDupes} spurious intro dupes dropped, ${stats.seamSplits} seam splits, ${stats.floodDupes} flood dupes dropped, ${stats.spanRanges} range merges)`);
