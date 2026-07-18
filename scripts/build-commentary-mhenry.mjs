#!/usr/bin/env node
/**
 * Normalize the lyteword/mhenry-complete markdown edition of Matthew Henry's
 * complete (unabridged) Commentary on the Whole Bible into the format read by
 * src/lib/commentary.ts.
 *
 * Source: data/_sources/mhenry/volume-<n>/<slug>/chapter-<n>.md (see
 * data/_sources/mhenry/PROVENANCE.md)
 * Output: data/commentary/mhenry/<BookFile>.json for every book the source provides.
 *
 * Each markdown chapter has YAML frontmatter, a "# <Book> <n>" title, lead
 * introduction paragraphs, then "## <section>" blocks. A section opens with
 * an optional blockquotation of the covered Scripture (superscript verse
 * numbers in bold) followed by the commentary paragraphs. Henry comments in
 * verse-range blocks, so each emitted section carries the range it covers,
 * derived from the blockquotation's superscript numbers.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "_sources", "mhenry");
const OUT_DIR = path.join(ROOT, "data", "commentary", "mhenry");

// slug -> display name, mirroring src/lib/canon.ts.
const BOOKS = [
  ["genesis", "Genesis"], ["exodus", "Exodus"], ["leviticus", "Leviticus"], ["numbers", "Numbers"],
  ["deuteronomy", "Deuteronomy"], ["joshua", "Joshua"], ["judges", "Judges"], ["ruth", "Ruth"],
  ["1-samuel", "1 Samuel"], ["2-samuel", "2 Samuel"], ["1-kings", "1 Kings"], ["2-kings", "2 Kings"],
  ["1-chronicles", "1 Chronicles"], ["2-chronicles", "2 Chronicles"], ["ezra", "Ezra"],
  ["nehemiah", "Nehemiah"], ["esther", "Esther"], ["job", "Job"], ["psalms", "Psalms"],
  ["proverbs", "Proverbs"], ["ecclesiastes", "Ecclesiastes"], ["song-of-solomon", "Song of Solomon"],
  ["isaiah", "Isaiah"], ["jeremiah", "Jeremiah"], ["lamentations", "Lamentations"],
  ["ezekiel", "Ezekiel"], ["daniel", "Daniel"], ["hosea", "Hosea"], ["joel", "Joel"], ["amos", "Amos"],
  ["obadiah", "Obadiah"], ["jonah", "Jonah"], ["micah", "Micah"], ["nahum", "Nahum"],
  ["habakkuk", "Habakkuk"], ["zephaniah", "Zephaniah"], ["haggai", "Haggai"],
  ["zechariah", "Zechariah"], ["malachi", "Malachi"], ["matthew", "Matthew"], ["mark", "Mark"],
  ["luke", "Luke"], ["john", "John"], ["acts", "Acts"], ["romans", "Romans"],
  ["1-corinthians", "1 Corinthians"], ["2-corinthians", "2 Corinthians"], ["galatians", "Galatians"],
  ["ephesians", "Ephesians"], ["philippians", "Philippians"], ["colossians", "Colossians"],
  ["1-thessalonians", "1 Thessalonians"], ["2-thessalonians", "2 Thessalonians"],
  ["1-timothy", "1 Timothy"], ["2-timothy", "2 Timothy"], ["titus", "Titus"], ["philemon", "Philemon"],
  ["hebrews", "Hebrews"], ["james", "James"], ["1-peter", "1 Peter"], ["2-peter", "2 Peter"],
  ["1-john", "1 John"], ["2-john", "2 John"], ["3-john", "3 John"], ["jude", "Jude"],
  ["revelation", "Revelation"],
].map(([slug, name]) => ({ slug, name, file: name.replace(/ /g, "") }));

const SUPERSCRIPT = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

/** Superscript runs in a blockquote line -> verse numbers. */
function quoteVerses(line) {
  const nums = [];
  for (const m of line.matchAll(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g)) {
    nums.push(Number([...m[0]].map((c) => SUPERSCRIPT[c]).join("")));
  }
  return nums;
}

/** Collapse a verse list to a compact label: [1,2,3] -> "1-3", [1,3] -> "1, 3". */
function verseLabel(nums) {
  const uniq = [...new Set(nums)].sort((a, b) => a - b);
  if (uniq.length === 0) return "";
  if (uniq.length === 1) return String(uniq[0]);
  const contiguous = uniq.every((v, i) => i === 0 || v === uniq[i - 1] + 1);
  if (contiguous) return `${uniq[0]}-${uniq[uniq.length - 1]}`;
  return uniq.join(", ");
}

/** Strip markdown decoration, keep the words. */
function clean(line) {
  return line
    .replace(/\\(.)/g, "$1") // backslash escapes (I\. -> I.)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

function parseChapter(md) {
  const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const lines = body.split(/\r?\n/);
  const sections = [];
  const leadParas = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    const text = current.paras.map(clean).filter(Boolean).join("\n\n").trim();
    if (text) sections.push({ verses: verseLabel(current.nums), text });
    current = null;
  };
  let inQuote = false;
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      flush();
      current = { nums: [], paras: [] };
      inQuote = false;
      continue;
    }
    if (line.startsWith("#")) continue; // page title
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      inQuote = true;
      if (current) current.nums.push(...quoteVerses(q[1]));
      continue; // the Scripture text itself is not commentary
    }
    const t = line.trim();
    if (!t) {
      if (inQuote && current && current.paras.length === 0) inQuote = false;
      continue;
    }
    if (current) current.paras.push(t);
    else leadParas.push(t);
  }
  flush();
  if (sections.length === 0 && leadParas.length) {
    sections.push({ verses: "", text: leadParas.map(clean).filter(Boolean).join("\n\n") });
    return { sections };
  }
  // Lead paragraphs are the chapter introduction; keep them ahead of the blocks.
  if (leadParas.length) {
    sections.unshift({ verses: "", text: leadParas.map(clean).filter(Boolean).join("\n\n") });
  }
  return { sections };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let books = 0;
let chaptersTotal = 0;
let sectionsTotal = 0;
const warnings = [];
for (const b of BOOKS) {
  const chapters = [];
  for (const vol of fs.readdirSync(SRC_DIR).filter((d) => /^volume-/.test(d))) {
    const dir = path.join(SRC_DIR, vol, b.slug);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter((f) => /^(chapter|psalm)-\d+\.md$/.test(f))
      .sort((a, z) => Number(a.match(/\d+/)[0]) - Number(z.match(/\d+/)[0]));
    for (const f of files) {
      const { sections } = parseChapter(fs.readFileSync(path.join(dir, f), "utf8"));
      if (sections.length === 0) {
        warnings.push(`${b.slug}/${f}: no sections found`);
        continue;
      }
      if (sections.every((s) => !s.verses)) {
        warnings.push(`${b.slug}/${f}: no verse anchors found`);
      }
      chapters.push({ chapter: f.match(/\d+/)[0], sections });
      sectionsTotal += sections.length;
    }
  }
  if (chapters.length === 0) {
    warnings.push(`${b.slug}: not found in any volume`);
    continue;
  }
  chapters.sort((a, z) => Number(a.chapter) - Number(z.chapter));
  chaptersTotal += chapters.length;
  books++;
  fs.writeFileSync(
    path.join(OUT_DIR, `${b.file}.json`),
    JSON.stringify({ book: b.name, chapters })
  );
}
console.log(`Wrote ${books} books, ${chaptersTotal} chapters, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings.slice(0, 30)) console.log(`  ${w}`);
}
