#!/usr/bin/env node
/**
 * Normalize the CrossWire SWORD zCom module of William Burkitt's Expository
 * Notes with Practical Observations on the New Testament into the format
 * read by src/lib/commentary.ts.
 *
 * Source: data/_sources/burkitt/Burkitt.zip (see data/_sources/burkitt/PROVENANCE.md)
 * Output: data/commentary/burkitt/<BookFile>.json.
 *
 * A zCom module is verse-indexed: <t>.czs lists zlib-compressed blocks in
 * <t>.czz; <t>.czv holds one 10-byte record per slot (uint32 block, uint32
 * offset in the uncompressed block, uint16 length). Slots are positional in
 * KJV order: slot 0 is the testament marker, slot 1 an importer milestone,
 * then per book one book-introduction slot, and per chapter one
 * chapter-introduction slot plus one slot per verse (verified against the
 * module's record count: 8246 NT). The module is New Testament only; the
 * zip carries no Old Testament files, so Old Testament books honestly have
 * no volume.
 *
 * Burkitt's book- and chapter-introduction slots hold only structural
 * milestones (<div osisID="Matt" type="book"/>, <chapter osisID="Matt.1"/>),
 * never text, so the work ships no introduction sections. Each verse slot
 * holds that verse's note or sits empty; verses Burkitt passes over simply
 * do not appear.
 *
 * The module duplicates a multi-verse note into every slot it covers and
 * declares the span in the record's annotateRef (one case: Hebrews 9:9-10);
 * consecutive identical texts inside one chapter merge into one range
 * section ("9-10"), the convention of the other osis2mod builds. Scripture
 * references keep their visible text.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "burkitt", "Burkitt.zip");
const OUT_DIR = path.join(ROOT, "data", "commentary", "burkitt");

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

/** OSIS fragment -> plain paragraphs. Milestone divs and chapter markers are
 * paragraph boundaries; every reference's visible text is kept. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/<div[^>]*\/>/g, "\n\n");
  s = s.replace(/<chapter[^>]*\/>/g, "\n\n");
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
    yield { rec, text: raw.subarray(start, start + size).toString("utf8") };
  }
}

const stats = { intros: 0, spanRanges: 0 };
const books = new Map();

const bzs = unzipMember("modules/comments/zcom/burkitt/nt.czs");
const bzv = unzipMember("modules/comments/zcom/burkitt/nt.czv");
const bzz = unzipMember("modules/comments/zcom/burkitt/nt.czz");

const raws = new Map();
for (const { rec, text } of records(bzs, bzv, bzz)) {
  if (text.trim()) raws.set(rec, text);
}

let slot = 2;
for (const b of canon) {
  const chs = new Map();
  /* Book- and chapter-introduction slots hold structural milestones only;
   * if any ever carried text it would ship as an intro section. */
  const bookIntro = clean(raws.get(slot) ?? "");
  if (bookIntro) stats.intros++;
  slot += 1;
  for (let ch = 1; ch <= b.chapters.length; ch++) {
    const sections = [];
    if (bookIntro && ch === 1) sections.push({ verses: "", text: bookIntro });
    const chIntro = clean(raws.get(slot) ?? "");
    if (chIntro) {
      sections.push({ verses: "", text: chIntro });
      stats.intros++;
    }
    slot += 1;
    let lastText = "";
    let lastStart = 0;
    let lastEnd = 0;
    for (let v = 1; v <= b.chapters[ch - 1]; v++) {
      const raw = raws.get(slot);
      if (raw) {
        const text = clean(raw);
        if (text) {
          if (text === lastText && v === lastEnd + 1) {
            /* The module duplicates a span note into every covered slot;
             * merge the run into one range section. */
            sections[sections.length - 1].verses = `${lastStart}-${v}`;
            lastEnd = v;
            stats.spanRanges++;
          } else {
            sections.push({ verses: String(v), text });
            lastStart = v;
            lastEnd = v;
            lastText = text;
          }
        }
      }
      slot += 1;
    }
    if (sections.length) chs.set(ch, sections);
  }
  if (chs.size) books.set(b.book, chs);
}
const actual = Math.floor(bzv.length / 10);
if (slot !== actual) {
  console.log(`warning: nt slot geometry mismatch: walked ${slot}, module holds ${actual}`);
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
console.log(`Wrote ${booksOut} books, ${chaptersTotal} chapters, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/ (${stats.intros} intro sections, ${stats.spanRanges} range merges)`);
