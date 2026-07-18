#!/usr/bin/env node
/**
 * Normalize the CrossWire SWORD zCom module of Albert Barnes's Notes on the
 * New Testament into the format read by src/lib/commentary.ts.
 *
 * Source: data/_sources/barnes/Barnes.zip (see data/_sources/barnes/PROVENANCE.md)
 * Output: data/commentary/barnes/<BookFile>.json (New Testament only; the
 * module contains no Old Testament volumes).
 *
 * The module is verse-indexed in KJV order: nt.czs lists zlib-compressed
 * blocks in nt.czz; nt.czv holds one 10-byte record per slot (uint32 block,
 * uint32 offset, uint16 length). Slots run: one testament record, one extra
 * front-matter record, then per book a book-intro slot and per chapter a
 * chapter-intro slot plus one slot per verse (verified against the record
 * count). Slot geometry gives the (book, chapter, verse) anchor; the
 * "Verse(s) N(-M)" heading inside a slot gives the true covered range.
 * Synthetic placeholder slots ("No specific Barnes text on this verse") and
 * bare cross-reference slots carry no commentary and are dropped.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "barnes", "Barnes.zip");
const KJV_DIR = path.join(ROOT, "data", "kjv");
const OUT_DIR = path.join(ROOT, "data", "commentary", "barnes");

// New Testament books in KJV order (display name, canon slug file).
const NT = [
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
  "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
  "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
  "1 John", "2 John", "3 John", "Jude", "Revelation",
].map((name) => ({ name, file: name.replace(/ /g, "") }));

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

/** ThML-ish fragment -> plain paragraphs. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/<br\s*\/?>/g, "\n");
  s = s.replace(/<\/p>/g, "\n\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  // The source module carries a handful of U+FFFD replacement characters from
  // a long-ago lossy encoding pass; they are unrecoverable and are dropped.
  s = s.replace(/\uFFFD/g, "");
  s = s.replace(/[ \t]+/g, " ");
  s = s.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join("\n\n");
  return s.trim();
}

const bzs = unzipMember("modules/comments/zcom/barnes/nt.czs");
const bzv = unzipMember("modules/comments/zcom/barnes/nt.czv");
const bzz = unzipMember("modules/comments/zcom/barnes/nt.czz");
const recordCount = Math.floor(bzv.length / 10);
const blockCache = new Map();
function record(rec) {
  const block = bzv.readUInt32LE(rec * 10);
  const start = bzv.readUInt32LE(rec * 10 + 4);
  const size = bzv.readUInt16LE(rec * 10 + 8);
  if (size === 0) return "";
  let raw = blockCache.get(block);
  if (!raw) {
    const off = bzs.readUInt32LE(block * 12);
    const csize = bzs.readUInt32LE(block * 12 + 4);
    raw = zlib.inflateSync(bzz.subarray(off, off + csize));
    blockCache.set(block, raw);
  }
  return raw.subarray(start, start + size).toString("utf8");
}

// Verse counts per chapter from the shipped KJV text.
const warnings = [];
let rec = 2; // 0: testament marker, 1: extra front-matter record
let sectionsTotal = 0;
const startOfMark = 2 + 1 + (() => {
  const kjv = JSON.parse(fs.readFileSync(path.join(KJV_DIR, "Matthew.json"), "utf8"));
  return kjv.chapters.reduce((t, c) => t + 1 + c.verses.length, 0);
})();
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const b of NT) {
  const kjv = JSON.parse(fs.readFileSync(path.join(KJV_DIR, `${b.file}.json`), "utf8"));
  const chapters = [];
  const bookStart = rec;
  const addSection = (chapter, slotVerse, rawText, allowHeaded) => {
    let text = clean(rawText);
    if (!text) return;
    if (/No specific (Barnes text|notes from Barnes)/i.test(text)) return; // synthetic placeholder
    if (/^\([a-z]+\)\s*"/.test(text)) return; // bare cross-reference slot
    // Drop running heads ("MATTHEW CHAPTER 3", "THE GOSPEL ACCORDING TO MARK",
    // "Matthew Verses 2-16").
    text = text
      .replace(/^(THE (GOSPEL|EPISTLE|ACTS|REVELATION|FIRST|SECOND|THIRD)[A-Z .&',-]+?)(?=\n|$)/i, "")
      .replace(/^[A-Z][A-Z ]*\bCHAPTER\s+[0-9IVXL]+\s*/i, "")
      .replace(/^CHAPTER\s+[0-9IVXL]+\s*/i, "")
      .replace(/^[A-Z][A-Za-z]+ Verses? [\d,\s–—-]+(?=\n|$)/, "")
      .trim();
    if (!text) return;
    // Verse comments begin with a "Verse(s) N(-M)" heading; introductory
    // matter ahead of the first heading stays unanchored.
    // Intro slots hold no verse comments of their own; headed parts found in
    // them are spillover from the previous book or chapter and are dropped.
    // (split() on a zero-width lookahead drops the leading empty string, so
    // slice by match indices instead.)
    const heads = [...text.matchAll(/^Verses?\s+\d/gm)].map((m) => m.index);
    const parts = [];
    if (heads.length === 0) parts.push(text);
    else {
      if (heads[0] > 0) parts.push(text.slice(0, heads[0]));
      for (let i = 0; i < heads.length; i++) {
        parts.push(text.slice(heads[i], heads[i + 1]));
      }
    }
    if (!allowHeaded) parts.splice(heads.length && heads[0] === 0 ? 0 : 1);
    const emit = (label, body) => {
      if (/^\([a-z]+\)\s*"/.test(body)) return; // bare cross-reference slot
      if (/^(\([a-z]+\)\s*"[^"]*"\s*[A-Za-z0-9 :,.;()–—"-]+\s*)+$/.test(body)) return;
      if (/No specific (Barnes text|notes from Barnes)/i.test(body)) return;
      if (body.length < 25) return; // header crumbs and stray reference stubs
      const ch = chapters.find((c) => c.chapter === String(chapter));
      const section = { verses: label, text: body };
      if (ch) ch.sections.push(section);
      else chapters.push({ chapter: String(chapter), sections: [section] });
      sectionsTotal++;
    };
    for (const part of parts) {
      const h = part.match(/^Verses?\s+([\d]+(?:[\s,–—-]+[\d]+)*)\s*[:.]?\s*/i);
      const label = h ? h[1].replace(/\s+/g, "").replace(/,/g, ", ").replace(/[–—]/g, "-") : "";
      const body = (h ? part.slice(h[0].length) : part).trim();
      if (!body) continue;
      // A headed block belongs to the slot it starts in; anything ahead of it
      // in the same slot is spillover from the previous passage.
      if (h && slotVerse) {
        const nums = h[1].split(/[\s,–—-]+/).filter(Boolean).map(Number);
        const start = nums[0];
        const end = h[1].includes("-") || /[–—]/.test(h[1]) ? nums[nums.length - 1] : start;
        if (!(start <= slotVerse && slotVerse <= end)) continue;
      }
      emit(label, body);
    }
  };

  // Book-intro slot.
  addSection(1, "", record(rec), false);
  rec++;
  for (const ch of kjv.chapters) {
    const chapter = Number(ch.chapter);
    // Chapter-intro slot.
    addSection(chapter, "", record(rec), false);
    rec++;
    for (const v of ch.verses) {
      addSection(chapter, v.verse, record(rec), true);
      rec++;
    }
  }
  fs.writeFileSync(
    path.join(OUT_DIR, `${b.file}.json`),
    JSON.stringify({ book: b.name, chapters })
  );
  if (b.name === "Matthew" && bookStart !== startOfMark - (rec - bookStart) && false) warnings.push("geometry");
}
if (rec !== recordCount) {
  warnings.push(`consumed ${rec} records but the index holds ${recordCount}`);
}
console.log(`Wrote ${NT.length} books, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/ (consumed ${rec}/${recordCount} records)`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ${w}`);
}
