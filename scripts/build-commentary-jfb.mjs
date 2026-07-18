#!/usr/bin/env node
/**
 * Normalize the CCEL ThML export of Jamieson, Fausset & Brown's Commentary
 * Critical and Explanatory on the Whole Bible into the format read by
 * src/lib/commentary.ts.
 *
 * Source: data/_sources/jfb/jfb.xml (see data/_sources/jfb/PROVENANCE.md)
 * Output: data/commentary/jfb/<BookFile>.json for every canonical book present.
 *
 * The ThML document anchors every commented verse block with a
 * <scripCom type="Commentary" passage="Ge 1:1" osisRef="Bible:Gen.1.1"/>
 * marker; the commentary text follows in a <div class="Commentary">. Chapter
 * markers (passage="Genesis 1") carry no commentary of their own. Ranges
 * appear as passage="Ex 24:4-8". Cross-references are inline <scripRef>
 * elements whose visible text is kept.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "data", "_sources", "jfb", "jfb.xml");
const OUT_DIR = path.join(ROOT, "data", "commentary", "jfb");

// OSIS book abbreviation -> display name, mirroring src/lib/canon.ts.
const BOOKS = Object.fromEntries(
  [
    ["Gen", "Genesis"], ["Exod", "Exodus"], ["Lev", "Leviticus"], ["Num", "Numbers"],
    ["Deut", "Deuteronomy"], ["Josh", "Joshua"], ["Judg", "Judges"], ["Ruth", "Ruth"],
    ["1Sam", "1 Samuel"], ["2Sam", "2 Samuel"], ["1Kgs", "1 Kings"], ["2Kgs", "2 Kings"],
    ["1Chr", "1 Chronicles"], ["2Chr", "2 Chronicles"], ["Ezra", "Ezra"],
    ["Neh", "Nehemiah"], ["Esth", "Esther"], ["Job", "Job"], ["Ps", "Psalms"],
    ["Prov", "Proverbs"], ["Eccl", "Ecclesiastes"], ["Song", "Song of Solomon"],
    ["Isa", "Isaiah"], ["Jer", "Jeremiah"], ["Lam", "Lamentations"],
    ["Ezek", "Ezekiel"], ["Dan", "Daniel"], ["Hos", "Hosea"], ["Joel", "Joel"], ["Amos", "Amos"],
    ["Obad", "Obadiah"], ["Jonah", "Jonah"], ["Mic", "Micah"], ["Nah", "Nahum"],
    ["Hab", "Habakkuk"], ["Zeph", "Zephaniah"], ["Hag", "Haggai"],
    ["Zech", "Zechariah"], ["Mal", "Malachi"], ["Matt", "Matthew"], ["Mark", "Mark"],
    ["Luke", "Luke"], ["John", "John"], ["Acts", "Acts"], ["Rom", "Romans"],
    ["1Cor", "1 Corinthians"], ["2Cor", "2 Corinthians"], ["Gal", "Galatians"],
    ["Eph", "Ephesians"], ["Phil", "Philippians"], ["Col", "Colossians"],
    ["1Thess", "1 Thessalonians"], ["2Thess", "2 Thessalonians"],
    ["1Tim", "1 Timothy"], ["2Tim", "2 Timothy"], ["Titus", "Titus"], ["Phlm", "Philemon"],
    ["Heb", "Hebrews"], ["Jas", "James"], ["1Pet", "1 Peter"], ["2Pet", "2 Peter"],
    ["1John", "1 John"], ["2John", "2 John"], ["3John", "3 John"], ["Jude", "Jude"],
    ["Rev", "Revelation"],
  ]
);

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
  // Cut anything past the next structural boundary.
  s = s.split(/<div[23]\s|<scripCom\s/)[0];
  // Paragraph and line breaks before tag stripping.
  s = s.replace(/<br\s*\/?>/g, "\n");
  s = s.replace(/<\/p>/g, "\n\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ");
  // Source line wraps are not paragraph breaks; only blank lines are.
  s = s.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join("\n\n");
  return s.trim();
}

const xml = fs.readFileSync(SRC, "utf8");
const markers = [...xml.matchAll(/<scripCom\s[^>]*>/g)].map((m) => {
  const tag = m[0];
  const osis = tag.match(/osisRef="Bible:([A-Za-z0-9]+)\.(\d+)(?:\.(\d+))?/);
  const passage = tag.match(/passage="([^"]*)"/);
  return { index: m.index, end: m.index + tag.length, osis, passage: passage ? passage[1] : "" };
});

/** Verse label from the passage attribute: "Ge 1:1" -> "1", "Ex 24:4-8" -> "4-8". */
function labelFromPassage(passage) {
  const m = passage.match(/:\s*([\d,\s–—-]+)$/);
  if (!m) return "";
  return m[1].replace(/\s+/g, "").replace(/[–—]/g, "-");
}

// book name -> chapter number -> sections[]
const books = new Map();
let skipped = 0;
for (let i = 0; i < markers.length; i++) {
  const m = markers[i];
  if (!m.osis) continue;
  const [, abbr, chapter, verse] = m.osis;
  const name = BOOKS[abbr];
  if (!name) {
    skipped++;
    continue;
  }
  const next = markers[i + 1];
  const chunk = xml.slice(m.end, next ? next.index : undefined);
  let text = clean(chunk);
  if (!text) continue; // bare chapter markers and empty blocks
  if (/^(CHAPTER|PSALM|EPISTLE|BOOK)\b/i.test(text) && text.length < 40) continue; // running heads
  // The block's own heading line carries the true covered range:
  // "Ge 1:1, 2.\nThe Creation of Heaven and Earth." -> label "1, 2", title kept.
  let label = verse ? labelFromPassage(m.passage) || verse : "";
  const heading = text.match(/^[A-Za-z0-9 ]+ \d+:([\d,\s–—-]+)\.\s*/);
  if (verse && heading) {
    label = heading[1].replace(/\s+/g, "").replace(/[–—]/g, "-");
    text = text.slice(heading[0].length).trim();
    if (!text) continue;
  }
  if (!books.has(name)) books.set(name, new Map());
  const chs = books.get(name);
  if (!chs.has(Number(chapter))) chs.set(Number(chapter), []);
  chs.get(Number(chapter)).push({ verses: label, text });
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
console.log(`Wrote ${booksOut} books, ${chaptersTotal} chapters, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/ (${skipped} non-canonical markers skipped)`);
