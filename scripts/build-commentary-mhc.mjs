#!/usr/bin/env node
/**
 * Normalize the lyteword/mhenry-concise markdown edition of Matthew Henry's
 * Concise Commentary into the format read by src/lib/commentary.ts.
 *
 * Source: data/_sources/mhc/<slug>/chapter-<n>.md  (from data/_sources/mhenry-concise.tar.gz)
 * Output: data/commentary/mhc/<BookFile>.json for every book the source provides.
 *
 * Each markdown chapter has YAML frontmatter, a "# <Book> <n>" title, an
 * optional "## Chapter Outline" section (skipped), and "## Verse(s) X"
 * sections. Section bodies are kept as plain paragraphs joined by blank lines.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "_sources", "mhc");
const OUT_DIR = path.join(ROOT, "data", "commentary", "mhc");

// slug -> [display name, file basename], mirroring src/lib/canon.ts.
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

function parseChapter(md) {
  // Strip YAML frontmatter.
  const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const lines = body.split(/\r?\n/);
  const sections = [];
  const leadParas = []; // body text before any "## Verses" heading
  let current = null;
  let skippedHeadings = [];
  const flush = () => {
    if (!current) return;
    const text = current.paras.join("\n\n").trim();
    if (text) sections.push({ verses: current.verses, text });
    current = null;
  };
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      flush();
      const m = /^(?:Chapter|Psalm) Outline$/i.test(h[1])
        ? null
        : h[1].match(/^(?:Verses?|Chapter)\s+(.+)$/i);
      if (m) {
        current = { verses: m[1].trim().replace(/[–—]/g, "-"), paras: [] };
      } else {
        skippedHeadings.push(h[1].trim());
      }
      continue;
    }
    if (line.startsWith("#")) continue; // page title
    const t = line.trim();
    if (!t) continue;
    if (current) current.paras.push(t);
    else leadParas.push(t);
  }
  flush();
  // Whole-chapter comments with no "## Verses" headings (e.g. Amos 1):
  // emit the body as one section spanning the chapter.
  if (sections.length === 0 && leadParas.length) {
    sections.push({ verses: "", text: leadParas.join("\n\n") });
  }
  return { sections, skippedHeadings };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let books = 0;
let chaptersTotal = 0;
let sectionsTotal = 0;
const warnings = [];
for (const b of BOOKS) {
  const dir = path.join(SRC_DIR, b.slug);
  if (!fs.existsSync(dir)) continue;
  const chapters = [];
  const files = fs.readdirSync(dir)
    .filter((f) => /^(chapter|psalm)-\d+\.md$/.test(f))
    .sort((a, z) => Number(a.match(/\d+/)[0]) - Number(z.match(/\d+/)[0]));
  for (const f of files) {
    const { sections, skippedHeadings } = parseChapter(fs.readFileSync(path.join(dir, f), "utf8"));
    if (sections.length === 0) {
      warnings.push(`${b.slug}/${f}: no verse sections found`);
      continue;
    }
    for (const h of skippedHeadings) {
      if (!/^(Chapter|Psalm) Outline$/i.test(h)) warnings.push(`${b.slug}/${f}: skipped heading "${h}"`);
    }
    chapters.push({ chapter: f.match(/\d+/)[0], sections });
    sectionsTotal += sections.length;
  }
  if (chapters.length === 0) continue;
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
  for (const w of warnings.slice(0, 20)) console.log(`  ${w}`);
}
