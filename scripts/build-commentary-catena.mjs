#!/usr/bin/env node
/**
 * Normalize the CrossWire SWORD zCom module of Thomas Aquinas's Catena Aurea
 * (John Henry Newman's English translation) into the format read by
 * src/lib/commentary.ts.
 *
 * Source: data/_sources/catena/Catena.zip (see data/_sources/catena/PROVENANCE.md)
 * Output: data/commentary/catena/<BookFile>.json.
 *
 * A zCom module is verse-indexed: <t>.czs lists zlib-compressed blocks in
 * <t>.czz; <t>.czv holds one 10-byte record per slot (uint32 block, uint32
 * offset in the uncompressed block, uint16 length). Slots are positional in
 * KJV order: slot 0 is the testament marker, slot 1 an importer milestone,
 * then per book one book-introduction slot, and per chapter one
 * chapter-introduction slot plus one slot per verse (verified against the
 * module's record count: 8246 NT). The Catena comments on the four Gospels
 * only; every slot outside Matthew, Mark, Luke, and John is empty, so the
 * other books honestly have no volume. (The zip also carries an empty
 * nt.bzs stub; the chapter-blocked nt.cz* files hold the data.)
 *
 * Each populated slot holds one catena entry: the lemma (Newman's "Ver. N."
 * quotation of the verse or verses the entry covers), then the patristic
 * comments as paragraphs, each opening with its attribution (Chrysostom,
 * Augustine, Jerome, the Glosses, and the rest). Attributions are the
 * work's own text and ship intact. Newman's editorial footnotes ride OSIS
 * <note> elements mid-sentence; they are lifted out of the prose flow and
 * appended, text unchanged, as the section's trailing paragraphs.
 *
 * The module keys each entry by its lemma header, but anchors it at the
 * first slot after the previous entry's span, so an entry following a
 * multi-verse entry sits one or more slots before the verse its lemma
 * names (the "Ver. 3." entry of Matthew 24 rides slot 24:2, "Ver. 35." of
 * Luke 18 rides 18:34). The build keys every entry by its lemma header,
 * which is the work's own keying: the header verse is the anchor when it
 * parses ahead of the slot verse; the slot verse is the anchor otherwise
 * (one header reads "2." where the lemma quotes Matthew 23:32; three
 * headers carry OCR letter-for-digit substitutions like "l" for 1; three
 * open with part letters, "1a", and one omits the number). Entries whose
 * header carries an explicit range ("Ver. 3-6.") ship as that range;
 * otherwise the lemma's embedded verse numbers give the span. Where a
 * lemma runs a partial quotation into the next entry's first verse as a
 * connective, the earlier span trims back to the next entry's anchor (the
 * text ships unchanged). Every reseat, anomaly, fallback, and trim is
 * counted.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ZIP = path.join(ROOT, "data", "_sources", "catena", "Catena.zip");
const OUT_DIR = path.join(ROOT, "data", "commentary", "catena");

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

/** OSIS fragment -> plain paragraphs. Milestone divs are paragraph
 * boundaries; every reference's visible text is kept. Nine records carry a
 * literal \par left over from the module's conversion; it is a paragraph
 * break, not text. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/\\par\b/g, "\n\n");
  s = s.replace(/<div[^>]*\/>/g, "\n\n");
  s = s.replace(/<\/p>/g, "\n\n");
  s = s.replace(/<br\s*\/?>/g, "\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ");
  s = s.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join("\n\n");
  return s.trim();
}

/** The module's OCR writes some header digits as letters. */
function ocrDigits(token) {
  return token.replace(/l/g, "1").replace(/O/g, "0");
}

function parseRange(verses) {
  const parts = verses.split("-").map(Number);
  return [parts[0], parts[1] ?? parts[0]];
}

/** Parses the lemma header at the start of a record (after the leading
 * milestone divs): an optional bold "Ver." marker, the verse number with an
 * optional part letter, an optional explicit range end, and a "." or ":"
 * separator. Falls back to a bare leading number. Returns { anchor, end,
 * headerLen } with headerLen 0 when nothing parses. */
function parseHeader(text) {
  let m = text.match(
    /^(?:<hi type="bold">Ver\.?<\/hi>|Ver)\s*\.?\s*([0-9lO]+)([ab])?\s*(?:-\s*([0-9lO]+)([ab])?)?\s*[.:]?/
  );
  if (!m) {
    m = text.match(/^([0-9lO]{1,3})([ab])?\s*(?:-\s*([0-9lO]{1,3}))?\s*\./);
    if (!m) return { anchor: null, end: null, headerLen: 0 };
  }
  return {
    anchor: Number(ocrDigits(m[1])),
    end: m[3] ? Number(ocrDigits(m[3])) : null,
    headerLen: m[0].length,
  };
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
  entries: 0,
  spans: 0,
  reseats: 0,
  headerAnomalies: 0,
  fallbacks: 0,
  collisions: 0,
  boundaryTrims: 0,
  footnotes: 0,
  intros: 0,
};
const books = new Map();

const bzs = unzipMember("modules/comments/zcom/catena/nt.czs");
const bzv = unzipMember("modules/comments/zcom/catena/nt.czv");
const bzz = unzipMember("modules/comments/zcom/catena/nt.czz");

const raws = new Map();
for (const { rec, text } of records(bzs, bzv, bzz)) {
  if (text.trim()) raws.set(rec, text);
}

let slot = 2;
for (const b of canon) {
  const chs = new Map();
  slot += 1; /* book-introduction slot: empty throughout */
  for (let ch = 1; ch <= b.chapters.length; ch++) {
    slot += 1; /* chapter-introduction slot: empty throughout */
    const sections = [];
    for (let v = 1; v <= b.chapters[ch - 1]; v++) {
      const raw = raws.get(slot);
      slot += 1;
      if (!raw) continue;
      stats.entries++;

      /* Newman's editorial footnotes leave the prose flow and ride at the
       * end of the section, text unchanged. */
      const notes = [];
      let body = raw.replace(/<note[^>]*>([\s\S]*?)<\/note>/g, (_, inner) => {
        notes.push(inner);
        return " ";
      });
      stats.footnotes += notes.length;

      /* The leading milestones (section and paragraph markers, plus one
       * stray \par at John 19:28) come off the front before the lemma
       * header parses. */
      const stripped = body.replace(/^(?:(?:<div[^>]*\/>\s*|\\par\b\s*))+/, "");
      const { anchor: hAnchor, end: hEnd, headerLen } = parseHeader(stripped);
      const chapterVerses = b.chapters[ch - 1];
      let anchor;
      if (hAnchor === null) {
        anchor = v;
        stats.fallbacks++;
      } else if (hAnchor > v && hAnchor <= chapterVerses) {
        /* The entry follows a span and sits before the verse its lemma
         * names; the header is the work's own keying. */
        anchor = hAnchor;
        stats.reseats++;
      } else {
        anchor = v;
        if (hAnchor !== v) stats.headerAnomalies++;
      }

      /* The span: the header's explicit range end, else the lemma's
       * embedded verse numbers as a consecutive run from the anchor. */
      let end = hEnd !== null && hEnd >= anchor && hEnd <= chapterVerses ? hEnd : null;
      if (end === null) {
        const lemmaClose = stripped.search(/<div eID="[^"]*" type="x-p"\s*\/>/);
        const lemma = (lemmaClose >= 0 ? stripped.slice(0, lemmaClose) : stripped).slice(headerLen);
        end = anchor;
        /* Verse numbers in the lemma run against the previous word's
         * punctuation ("temple.2.", "saying,3."): any non-digit prefix. */
        for (const vm of lemma.matchAll(/(?:^|\D)(\d{1,3})[ab]?\.\s/g)) {
          if (Number(vm[1]) === end + 1) end = Number(vm[1]);
        }
      }
      if (end > anchor) stats.spans++;

      const text = clean(body);
      if (!text) continue;
      const withNotes = notes.length
        ? `${text}\n\n${notes.map((n) => clean(n)).filter(Boolean).join("\n\n")}`
        : text;
      const verses = end > anchor ? `${anchor}-${end}` : String(anchor);
      if (sections.some((s) => s.verses.split("-")[0] === String(anchor))) stats.collisions++;
      sections.push({ verses, text: withNotes });
    }
    if (sections.length) {
      sections.sort(
        (a, z) => Number(a.verses.split("-")[0]) - Number(z.verses.split("-")[0])
      );
      /* A lemma often runs a partial quotation of the next entry's first
       * verse as a connective; the next entry's own header anchor is the
       * work's keying for that verse, so the earlier span trims back to it.
       * The section text ships unchanged either way. */
      for (let i = 0; i + 1 < sections.length; i++) {
        const [a, e] = parseRange(sections[i].verses);
        const [nextStart] = parseRange(sections[i + 1].verses);
        if (nextStart <= e) {
          sections[i].verses = a === nextStart - 1 ? String(a) : `${a}-${nextStart - 1}`;
          stats.boundaryTrims++;
        }
      }
      chs.set(ch, sections);
    }
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
console.log(
  `Wrote ${booksOut} books, ${chaptersTotal} chapters, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/ ` +
    `(${stats.entries} entries: ${stats.spans} spans, ${stats.reseats} reseats, ${stats.headerAnomalies} header anomalies, ` +
    `${stats.fallbacks} fallbacks, ${stats.collisions} collisions, ${stats.boundaryTrims} boundary trims; ${stats.footnotes} footnotes moved)`
);
