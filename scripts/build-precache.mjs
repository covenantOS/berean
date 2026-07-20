#!/usr/bin/env node
/**
 * Build the service worker's precache list: every KJV chapter as served by
 * /api/pane/chapter, so the installed app reads the core canon offline. The
 * URLs match the reader's default request exactly (book then chapter, no
 * translation parameter), or the cache would never hit.
 *
 * Output: public/precache.json — { version, shell, core }. The rest of the
 * library (apparatus, lexica, commentaries, translations) is not listed;
 * the worker caches those routes at runtime as they are used.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const KJV_DIR = path.join(ROOT, "data", "kjv");
const OUT = path.join(ROOT, "public", "precache.json");

// Data file basename -> canonical URL slug, mirroring src/lib/canon.ts.
const BOOKS = [
  ["Genesis", "genesis"], ["Exodus", "exodus"], ["Leviticus", "leviticus"],
  ["Numbers", "numbers"], ["Deuteronomy", "deuteronomy"], ["Joshua", "joshua"],
  ["Judges", "judges"], ["Ruth", "ruth"], ["1Samuel", "1-samuel"],
  ["2Samuel", "2-samuel"], ["1Kings", "1-kings"], ["2Kings", "2-kings"],
  ["1Chronicles", "1-chronicles"], ["2Chronicles", "2-chronicles"],
  ["Ezra", "ezra"], ["Nehemiah", "nehemiah"], ["Esther", "esther"],
  ["Job", "job"], ["Psalms", "psalms"], ["Proverbs", "proverbs"],
  ["Ecclesiastes", "ecclesiastes"], ["SongofSolomon", "song-of-solomon"],
  ["Isaiah", "isaiah"], ["Jeremiah", "jeremiah"], ["Lamentations", "lamentations"],
  ["Ezekiel", "ezekiel"], ["Daniel", "daniel"], ["Hosea", "hosea"],
  ["Joel", "joel"], ["Amos", "amos"], ["Obadiah", "obadiah"], ["Jonah", "jonah"],
  ["Micah", "micah"], ["Nahum", "nahum"], ["Habakkuk", "habakkuk"],
  ["Zephaniah", "zephaniah"], ["Haggai", "haggai"], ["Zechariah", "zechariah"],
  ["Malachi", "malachi"], ["Matthew", "matthew"], ["Mark", "mark"],
  ["Luke", "luke"], ["John", "john"], ["Acts", "acts"], ["Romans", "romans"],
  ["1Corinthians", "1-corinthians"], ["2Corinthians", "2-corinthians"],
  ["Galatians", "galatians"], ["Ephesians", "ephesians"],
  ["Philippians", "philippians"], ["Colossians", "colossians"],
  ["1Thessalonians", "1-thessalonians"], ["2Thessalonians", "2-thessalonians"],
  ["1Timothy", "1-timothy"], ["2Timothy", "2-timothy"], ["Titus", "titus"],
  ["Philemon", "philemon"], ["Hebrews", "hebrews"], ["James", "james"],
  ["1Peter", "1-peter"], ["2Peter", "2-peter"], ["1John", "1-john"],
  ["2John", "2-john"], ["3John", "3-john"], ["Jude", "jude"],
  ["Revelation", "revelation"],
];

const core = [];
let bytes = 0;
for (const [file, slug] of BOOKS) {
  const text = fs.readFileSync(path.join(KJV_DIR, `${file}.json`), "utf8");
  const book = JSON.parse(text);
  for (const chapter of book.chapters) {
    core.push(`/api/pane/chapter?book=${slug}&chapter=${chapter.chapter}`);
  }
  bytes += Buffer.byteLength(text);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const manifest = {
  // Bump when the core list or its payloads change; the worker versions its
  // caches from this value and purges the old ones on activate.
  version: "kjv-core-1",
  // The app shell pages the offline fallback depends on.
  shell: ["/workspace", "/offline.html"],
  core,
};
fs.writeFileSync(OUT, `${JSON.stringify(manifest)}\n`);
console.log(`precache.json: ${core.length} chapter URLs from ${(bytes / 1e6).toFixed(1)}MB of KJV JSON`);
