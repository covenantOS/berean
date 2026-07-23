#!/usr/bin/env node
/**
 * Normalize the CrossWire SWORD zCom4 module of C. H. Spurgeon's Treasury of
 * David into the format read by src/lib/commentary.ts.
 *
 * Source: data/_sources/tdavid/TDavid.zip (see data/_sources/tdavid/PROVENANCE.md)
 * Output: data/commentary/tdavid/Psalms.json.
 *
 * A zCom4 module is the wide-offset variant of zCom: <t>.bzs lists
 * zlib-compressed blocks in <t>.bzz; <t>.bzv holds one 12-byte record per
 * slot (uint32 block, uint32 offset in the uncompressed block, uint32
 * length). Slots are positional in KJV order: slot 0 is the testament
 * marker, slot 1 an importer milestone, then per book one book-introduction
 * slot, and per chapter one chapter-introduction slot plus one slot per
 * verse (verified against the module's record count: 24115 OT). Only the
 * Psalms are populated; Spurgeon's preface rides the book-introduction slot.
 *
 * Each psalm's whole content sits in one or two records somewhere between
 * the chapter-introduction slot and the last verse slot, so the script
 * concatenates every non-empty slot of the psalm and re-splits by the
 * module's own structure: <title type="x-s"> parts (OVERVIEW, TITLE,
 * DIVISION, EXPOSITION, EXPLANATORY NOTES AND QUAINT SAYINGS, HINTS TO THE
 * VILLAGE PREACHER, and the bibliographic WORKS UPON ... sections, which are
 * apparatus and are dropped), then, inside EXPOSITION and the NOTES, <hi
 * type="bold">Verse N.</hi> markers (also "Verses N, M." and "Verses N-M.")
 * anchor each chunk to its verse. Overview-level parts ship as unanchored
 * intro sections (verses ""), the convention of the other builds. A verse
 * label beyond the psalm's own count means a source spill; those chunks are
 * dropped and counted.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "tdavid", "TDavid.zip");
const OUT_DIR = path.join(ROOT, "data", "commentary", "tdavid");

/* Canonical book files in KJV order through Psalms, mirroring
 * src/lib/canon.ts; per-chapter verse counts come from the shipped KJV text
 * so the slot map matches Berean's own canon. */
const ORDER = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
  "Judges", "Ruth", "1Samuel", "2Samuel", "1Kings", "2Kings",
  "1Chronicles", "2Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
  "Psalms",
];

const canon = ORDER.map((file, i) => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kjv", `${file}.json`), "utf8"));
  return { book: d.book, file, ot: true, chapters: d.chapters.map((c) => c.verses.length) };
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

/** OSIS fragment -> plain paragraphs. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/<div[^>]*type="x-p"[^>]*\/>/g, "\n\n");
  s = s.replace(/<\/item>/g, "\n");
  s = s.replace(/<\/p>/g, "\n\n");
  s = s.replace(/<br\s*\/?>/g, "\n");
  s = s.replace(/<lb\s*\/?>/g, "\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ");
  s = s.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join("\n\n");
  return s.trim();
}

function* records(bzs, bzv, bzz) {
  const n = Math.floor(bzv.length / 12);
  const blockCache = new Map();
  for (let rec = 0; rec < n; rec++) {
    const block = bzv.readUInt32LE(rec * 12);
    const start = bzv.readUInt32LE(rec * 12 + 4);
    const size = bzv.readUInt32LE(rec * 12 + 8);
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

const VERSE_MARK = /<hi type="bold">\s*(?:Verses?|Ver)\.?\s+([\d,\s–—-]+?)\s*\.?\s*<\/hi>/g;

/** Splits an EXPOSITION / NOTES / HINTS body into per-verse chunks on the
 * bold "Verse N." markers. The marker itself is stripped from the chunk
 * text; preamble text ahead of the first marker rides with the first chunk.
 * When the next marker skips numbers (1 then 3), the chunk covers the gap
 * and its label becomes the true range ("1-2"). */
function splitVerses(body) {
  const marks = [...body.matchAll(new RegExp(VERSE_MARK.source, "g"))];
  if (!marks.length) return null;
  const chunks = [];
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].index + marks[i][0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : body.length;
    let label = marks[i][1].replace(/\s+/g, "").replace(/[–—]/g, "-");
    const next = i + 1 < marks.length ? Number(marks[i + 1][1].match(/\d+/)?.[0]) : null;
    const start = labelStart(label);
    if (!/[-,]/.test(label) && next && next > start + 1) label = `${start}-${next - 1}`;
    const preamble = i === 0 ? body.slice(0, marks[0].index) : "";
    chunks.push({ label, text: preamble + body.slice(from, to) });
  }
  return chunks;
}

/** First number of a marker label, for spill detection. */
function labelStart(label) {
  const m = label.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

const stats = { verseChunks: 0, intros: 0, worksDropped: 0, spillsDropped: 0 };

const bzs = unzipMember("modules/comments/zcom/tdavid/ot.bzs");
const bzv = unzipMember("modules/comments/zcom/tdavid/ot.bzv");
const bzz = unzipMember("modules/comments/zcom/tdavid/ot.bzz");
const texts = new Map();
for (const { rec, text } of records(bzs, bzv, bzz)) {
  if (text.trim()) texts.set(rec, text);
}

const psalms = canon.find((b) => b.book === "Psalms");
/* Walk to the Psalms book-introduction slot: testament marker, importer
 * milestone, then the books before Psalms. */
let slot = 2;
for (const b of canon) {
  if (b.book === "Psalms") break;
  slot += 1 + b.chapters.reduce((t, nv) => t + 1 + nv, 0);
}

const preface = clean(texts.get(slot) ?? "");
slot += 1;

const chapters = new Map();
for (let ch = 1; ch <= psalms.chapters.length; ch++) {
  const verseCount = psalms.chapters[ch - 1];
  const parts = [];
  for (let s = slot; s <= slot + verseCount; s++) {
    const t = texts.get(s);
    if (t) parts.push(t);
  }
  slot += 1 + verseCount;

  const sections = [];
  if (ch === 1 && preface) {
    sections.push({ verses: "", text: preface });
    stats.intros++;
  }
  const body = parts.join("\n");

  /* Split the psalm's body into titled parts. Text ahead of the first title
   * is overview material. */
  const titleMarks = [...body.matchAll(/<title type="x-s">([^<]*)<\/title>/g)];
  const titled = [];
  if (titleMarks.length && titleMarks[0].index > 0) {
    titled.push({ name: "", body: body.slice(0, titleMarks[0].index) });
  }
  for (let i = 0; i < titleMarks.length; i++) {
    const from = titleMarks[i].index + titleMarks[i][0].length;
    const to = i + 1 < titleMarks.length ? titleMarks[i + 1].index : body.length;
    titled.push({ name: titleMarks[i][1].trim(), body: body.slice(from, to) });
  }

  const pushIntro = (text) => {
    const c = clean(text);
    if (!c) return;
    sections.push({ verses: "", text: c });
    stats.intros++;
  };
  const pushVerseChunks = (text) => {
    const chunks = splitVerses(text);
    if (!chunks) {
      pushIntro(text);
      return;
    }
    for (const chunk of chunks) {
      const c = clean(chunk.text);
      if (!c) continue;
      if (labelStart(chunk.label) > verseCount) {
        stats.spillsDropped++;
        continue;
      }
      sections.push({ verses: chunk.label, text: c });
      stats.verseChunks++;
    }
  };

  for (const part of titled) {
    const name = part.name;
    if (/^WORKS? UPON/i.test(name)) {
      stats.worksDropped++;
      continue;
    }
    if (/^(EXPOSITION|EXPLANATORY NOTES AND QUAINT SAYINGS|HINTS TO)/i.test(name)) {
      pushVerseChunks(part.body);
      continue;
    }
    /* OVERVIEW, TITLE., SUBTITLE., DIVISION., AUTHOR., SUBJECT., and the
     * one-off psalm-level parts ship as intro sections. */
    pushIntro(part.body);
  }
  if (sections.length) chapters.set(ch, sections);
}

/* The module populates only the Psalms; any content past the walk would be a
 * surprise worth reporting. */
let trailing = 0;
for (let s = slot; s < Math.floor(bzv.length / 12); s++) if (texts.has(s)) trailing++;
if (trailing) console.log(`warning: ${trailing} non-empty slots past the Psalms were not walked`);

fs.mkdirSync(OUT_DIR, { recursive: true });
const out = [...chapters.entries()]
  .sort((a, z) => a[0] - z[0])
  .map(([n, sections]) => ({ chapter: String(n), sections }));
fs.writeFileSync(
  path.join(OUT_DIR, "Psalms.json"),
  JSON.stringify({ book: "Psalms", chapters: out })
);
console.log(`Wrote ${out.length} psalms, ${stats.verseChunks} verse sections, ${stats.intros} intro sections to ${path.relative(ROOT, OUT_DIR)}/ (${stats.worksDropped} bibliography parts dropped, ${stats.spillsDropped} out-of-range chunks dropped)`);
