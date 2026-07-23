#!/usr/bin/env node
/**
 * Normalize the CrossWire SWORD zCom module of the Scofield Reference Notes
 * (1917 edition) into the format read by src/lib/commentary.ts.
 *
 * Source: data/_sources/scofield/Scofield.zip (see data/_sources/scofield/PROVENANCE.md)
 * Output: data/commentary/scofield/<BookFile>.json.
 *
 * A zCom module is verse-indexed: <t>.bzs lists zlib-compressed blocks in
 * <t>.bzz; <t>.bzv holds one 10-byte record per slot (uint32 block, uint32
 * offset in the uncompressed block, uint16 length). Slots are positional in
 * KJV order: slot 0 is the testament marker, slot 1 an importer milestone,
 * then per book one book-introduction slot, and per chapter one
 * chapter-introduction slot plus one slot per verse (verified against the
 * module's record counts: 24115 OT, 8246 NT). Empty slots are verses the
 * notes pass over.
 *
 * Scofield's book introductions ride different slots book by book: the
 * book-introduction slot, the first chapter-introduction slot, or the first
 * verse slot wrapped in a preverse milestone. This script collects
 * introduction text from all three, in that order, and shelves it with
 * chapter 1 as unanchored intro sections (the convention of the other
 * builds). A verse slot's text after the last preverse close milestone is
 * that verse's note. The module's "Read first chapter of X" navigation
 * references are dropped; every other reference's visible text is kept.
 *
 * Like the other osis2mod builds, the module duplicates a multi-verse note
 * into every slot it covers; consecutive identical texts inside one chapter
 * merge into one range section ("3-5").
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "scofield", "Scofield.zip");
const OUT_DIR = path.join(ROOT, "data", "commentary", "scofield");

/* Canonical book files in KJV order, mirroring src/lib/canon.ts; the
 * per-chapter verse counts come from the shipped KJV text so the slot map
 * matches Berean's own canon. */
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
  return { book: d.book, file, ot: i < 39, chapters: d.chapters.map((c) => c.verses.length) };
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

/** OSIS fragment -> plain paragraphs. The module's "Read first chapter"
 * navigation references are navigation, not commentary, and are removed. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/<reference[^>]*>\s*Read first chapter of[^<]*<\/reference>/g, " ");
  s = s.replace(/<div[^>]*type="x-p"[^>]*\/>/g, "\n\n");
  s = s.replace(/<title[^>]*>/g, "\n\n");
  s = s.replace(/<\/title>/g, "\n\n");
  s = s.replace(/<\/item>/g, "\n");
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

/** Splits a verse slot into preverse material (introduction) and the verse
 * note proper, at the last preverse close milestone. */
function splitPreverse(raw) {
  const marks = [...raw.matchAll(/<div type="x-milestone" subType="x-preverse" eID="[^"]*"\s*\/>/g)];
  if (marks.length) {
    const last = marks[marks.length - 1];
    return { intro: raw.slice(0, last.index + last[0].length), note: raw.slice(last.index + last[0].length) };
  }
  if (/subType="x-preverse"/.test(raw) || /Book Introduction/.test(raw)) {
    return { intro: raw, note: "" };
  }
  return { intro: "", note: raw };
}

const stats = { intros: 0, spanRanges: 0 };
const books = new Map();

for (const t of ["ot", "nt"]) {
  const bzs = unzipMember(`modules/comments/zcom/scofield/${t}.bzs`);
  const bzv = unzipMember(`modules/comments/zcom/scofield/${t}.bzv`);
  const bzz = unzipMember(`modules/comments/zcom/scofield/${t}.bzz`);

  const raws = new Map();
  for (const { rec, text } of records(bzs, bzv, bzz)) {
    if (text.trim()) raws.set(rec, text);
  }

  let slot = 2;
  for (const b of canon.filter((x) => x.ot === (t === "ot"))) {
    const chs = new Map();
    const firstSections = [];
    const pushIntro = (raw) => {
      const c = clean(raw);
      if (!c) return;
      firstSections.push({ verses: "", text: c });
      stats.intros++;
    };

    pushIntro(raws.get(slot) ?? "");
    slot += 1;

    for (let ch = 1; ch <= b.chapters.length; ch++) {
      const sections = ch === 1 ? firstSections : [];
      if (ch !== 1) pushChapterIntro(sections, raws.get(slot));
      else {
        const c = clean(raws.get(slot) ?? "");
        if (c) {
          firstSections.push({ verses: "", text: c });
          stats.intros++;
        }
      }
      slot += 1;

      let lastText = "";
      let lastStart = 0;
      let lastEnd = 0;
      for (let v = 1; v <= b.chapters[ch - 1]; v++) {
        const raw = raws.get(slot);
        if (raw) {
          const { intro, note } = splitPreverse(raw);
          if (intro) {
            const c = clean(intro);
            if (c) {
              sections.push({ verses: "", text: c });
              stats.intros++;
            }
          }
          const text = clean(note);
          if (text) {
            if (text === lastText && v === lastEnd + 1) {
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
    console.log(`warning: ${t} slot geometry mismatch: walked ${slot}, module holds ${actual}`);
  }
}

function pushChapterIntro(sections, raw) {
  const c = clean(raw ?? "");
  if (c) {
    sections.push({ verses: "", text: c });
    stats.intros++;
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
console.log(`Wrote ${booksOut} books, ${chaptersTotal} chapters, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/ (${stats.intros} intro sections, ${stats.spanRanges} range merges)`);
