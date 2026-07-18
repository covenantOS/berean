#!/usr/bin/env node
/**
 * Normalize STEPBible-Data TAHOT (Hebrew OT) and TAGNT (Greek NT) into the
 * per-book tagged-text format read by src/lib/tagged.ts.
 *
 * Sources: data/_sources/stepbible/ (see PROVENANCE.md; CC BY 4.0,
 * Tyndale House Cambridge / STEPBible.org). Header lines in the TSVs are
 * documentation, not data; only rows beginning with a verse reference are
 * parsed.
 *
 * Output: data/tahot/<BookFile>.json (39 OT books) and
 * data/tagnt/<BookFile>.json (27 NT books), plus _meta.json in each
 * directory recording attribution.
 *
 * Word objects carry: surface text, transliteration, lemma, extended
 * Strong's numbers, morphology code (ETCBC/OpenScriptures for Hebrew,
 * Robinson for Greek), an English gloss, the source text-type flag, and
 * for TAGNT the list of editions containing the word.
 *
 * Versification follows the source: English (NRSV) numbering, with the
 * Hebrew (TAHOT) or KJV/other-edition (TAGNT) numbering recorded on the
 * verse when it differs. Psalm titles are verse 0.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "_sources", "stepbible");

const ATTRIBUTION =
  "Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). https://github.com/STEPBible/STEPBible-Data";

// STEP book abbreviations -> canonical naming, mirroring src/lib/canon.ts.
const BOOK_ABBREV = {
  Gen: "Genesis", Exo: "Exodus", Lev: "Leviticus", Num: "Numbers", Deu: "Deuteronomy",
  Jos: "Joshua", Jdg: "Judges", Rut: "Ruth", "1Sa": "1 Samuel", "2Sa": "2 Samuel",
  "1Ki": "1 Kings", "2Ki": "2 Kings", "1Ch": "1 Chronicles", "2Ch": "2 Chronicles",
  Ezr: "Ezra", Neh: "Nehemiah", Est: "Esther", Job: "Job", Psa: "Psalms",
  Pro: "Proverbs", Ecc: "Ecclesiastes", Sng: "Song of Solomon", Isa: "Isaiah",
  Jer: "Jeremiah", Lam: "Lamentations", Ezk: "Ezekiel", Dan: "Daniel", Hos: "Hosea",
  Jol: "Joel", Amo: "Amos", Oba: "Obadiah", Jon: "Jonah", Mic: "Micah",
  Nam: "Nahum", Hab: "Habakkuk", Zep: "Zephaniah", Hag: "Haggai", Zec: "Zechariah",
  Mal: "Malachi",
  Mat: "Matthew", Mrk: "Mark", Luk: "Luke", Jhn: "John", Act: "Acts",
  Rom: "Romans", "1Co": "1 Corinthians", "2Co": "2 Corinthians", Gal: "Galatians",
  Eph: "Ephesians", Php: "Philippians", Col: "Colossians", "1Th": "1 Thessalonians",
  "2Th": "2 Thessalonians", "1Ti": "1 Timothy", "2Ti": "2 Timothy", Tit: "Titus",
  Phm: "Philemon", Heb: "Hebrews", Jas: "James", "1Pe": "1 Peter", "2Pe": "2 Peter",
  "1Jn": "1 John", "2Jn": "2 John", "3Jn": "3 John", Jud: "Jude", Rev: "Revelation",
};

// Ref: Book.chapter.verse, then optional (Hebrew), [KJV] or {other-edition}
// numbering, then #wordNumber=sourceType.
const REF_RE = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+[a-z]?)(?:\(([\d.]+)\))?(?:\[([\d.]+)\])?(?:\{([\d.]+)\})?#(\d+)=(\S+)\t/;

function stripMarks(s) {
  // "/" separates prefixes/suffixes; "\" introduces punctuation markers.
  return s.split("\\")[0].replaceAll("/", "").trim();
}

/** Parse the expanded Strong's tags column for the root's lexical form. */
function lemmaFromExpanded(expanded) {
  const m = expanded.match(/\{[^=}]+=([^=}]*)=/);
  return m ? m[1].trim() : "";
}

/** dStrongs column like "H9009/{H0776G}\H9016" -> { strongs, root }. */
function parseDStrongs(col) {
  const main = col.split("\\")[0];
  const parts = main.split("/").map((p) => p.trim()).filter(Boolean);
  const strongs = [];
  let root = "";
  for (const p of parts) {
    const m = p.match(/^\{([^}]+?)\+?\}$/);
    if (m) {
      root = m[1];
      strongs.push(m[1]);
    } else {
      strongs.push(p.replace(/\+$/, ""));
    }
  }
  return { strongs, root };
}

function parseTahotRow(line) {
  const m = line.match(REF_RE);
  if (!m) return null;
  const cols = line.split("\t");
  const [, abbrev, chapter, verse, hebRef, , , wordNum, type] = m;
  const name = BOOK_ABBREV[abbrev];
  if (!name) return null;
  const { strongs, root } = parseDStrongs(cols[4] ?? "");
  const word = {
    t: stripMarks(cols[1] ?? ""),
    s: strongs,
    m: (cols[5] ?? "").trim(),
    type,
  };
  const xlit = stripMarks(cols[2] ?? "");
  if (xlit) word.x = xlit;
  const gloss = (cols[3] ?? "").split("\\")[0].replaceAll("/", " ").replace(/\s+/g, " ").trim();
  if (gloss) word.g = gloss;
  const lemma = lemmaFromExpanded(cols[11] ?? "");
  if (lemma) word.l = lemma;
  if (root) word.r = root;
  return { name, chapter, verse, altRef: hebRef ?? null, wordNum: Number(wordNum), word };
}

function parseTagntRow(line) {
  const m = line.match(REF_RE);
  if (!m) return null;
  const cols = line.split("\t");
  const [, abbrev, chapter, verse, , kjvRef, otherRef, wordNum, type] = m;
  const name = BOOK_ABBREV[abbrev];
  if (!name) return null;
  const greekCol = cols[1] ?? "";
  const gm = greekCol.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const [dg = "", morph = ""] = (cols[3] ?? "").split("=").map((s) => s.trim());
  const [lemma = "", dictGloss = ""] = (cols[4] ?? "").split("=").map((s) => s.trim());
  const word = {
    t: (gm ? gm[1] : greekCol).trim(),
    s: dg ? [dg] : [],
    m: morph,
    type,
  };
  if (gm && gm[2]) word.x = gm[2].trim();
  const gloss = (cols[2] ?? "").trim();
  if (gloss) word.g = gloss;
  if (lemma) word.l = lemma;
  if (dictGloss && dictGloss !== gloss) word.dg = dictGloss;
  const editions = (cols[5] ?? "").split("+").map((e) => e.trim()).filter(Boolean);
  if (editions.length) word.e = editions;
  return {
    name,
    chapter,
    verse,
    altRef: kjvRef ?? otherRef ?? null,
    wordNum: Number(wordNum),
    word,
  };
}

function buildDataset({ files, outDir, parseRow, id, title, expectedBooks }) {
  // book name -> Map("chapter:verse" -> { altRef, words: [{num, word}] })
  const books = new Map();
  let rows = 0;
  let skipped = 0;
  for (const file of files) {
    const text = fs.readFileSync(path.join(SRC_DIR, file), "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!REF_RE.test(line)) continue;
      const parsed = parseRow(line);
      if (!parsed) {
        skipped++;
        continue;
      }
      rows++;
      const key = `${parsed.chapter}:${parsed.verse}`;
      let verseMap = books.get(parsed.name);
      if (!verseMap) {
        verseMap = new Map();
        books.set(parsed.name, verseMap);
      }
      let v = verseMap.get(key);
      if (!v) {
        v = { altRef: parsed.altRef, words: [] };
        verseMap.set(key, v);
      }
      v.words.push({ num: parsed.wordNum, word: parsed.word });
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  let totalWords = 0;
  const written = [];
  for (const [name, verseMap] of books) {
    const chapters = new Map(); // chapter -> verses[]
    const keys = [...verseMap.keys()].sort((a, z) => {
      const [ac, av] = a.split(":");
      const [zc, zv] = z.split(":");
      return Number(ac) - Number(zc) || Number(av) - Number(zv) || av.localeCompare(zv);
    });
    for (const key of keys) {
      const [chapter, verse] = key.split(":");
      const v = verseMap.get(key);
      const outVerse = {
        verse,
        words: v.words.sort((a, z) => a.num - z.num).map((w) => w.word),
      };
      if (v.altRef) outVerse.alt = v.altRef;
      totalWords += outVerse.words.length;
      if (!chapters.has(chapter)) chapters.set(chapter, []);
      chapters.get(chapter).push(outVerse);
    }
    const out = {
      book: name,
      chapters: [...chapters.entries()].map(([chapter, verses]) => ({ chapter, verses })),
    };
    fs.writeFileSync(path.join(outDir, `${name.replace(/ /g, "")}.json`), JSON.stringify(out));
    written.push(name);
  }
  fs.writeFileSync(
    path.join(outDir, "_meta.json"),
    JSON.stringify({ id, title, attribution: ATTRIBUTION, retrieved: "2026-07-18", builtBy: "scripts/build-step.mjs" }, null, 2) + "\n"
  );
  console.log(
    `${id}: wrote ${written.length} books (${totalWords} words) to ${path.relative(ROOT, outDir)}/` +
      (skipped ? ` — ${skipped} rows skipped` : "")
  );
  const missing = expectedBooks.filter((b) => !books.has(b));
  if (written.length !== expectedBooks.length || missing.length) {
    console.error(`${id}: expected ${expectedBooks.length} books, missing: ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}

const OT_BOOKS = Object.values(BOOK_ABBREV).slice(0, 39);
const NT_BOOKS = Object.values(BOOK_ABBREV).slice(39);

buildDataset({
  id: "tahot",
  title: "TAHOT: Translators Amalgamated Hebrew OT",
  files: ["TAHOT-Gen-Deu.txt", "TAHOT-Jos-Est.txt", "TAHOT-Job-Sng.txt", "TAHOT-Isa-Mal.txt"],
  outDir: path.join(ROOT, "data", "tahot"),
  parseRow: parseTahotRow,
  expectedBooks: OT_BOOKS,
});

buildDataset({
  id: "tagnt",
  title: "TAGNT: Translators Amalgamated Greek NT",
  files: ["TAGNT-Mat-Jhn.txt", "TAGNT-Act-Rev.txt"],
  outDir: path.join(ROOT, "data", "tagnt"),
  parseRow: parseTagntRow,
  expectedBooks: NT_BOOKS,
});
