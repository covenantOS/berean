/**
 * Build data/audio/manifest.json: canonical slug + chapter -> archive.org
 * streaming URL for public-domain LibriVox KJV recordings.
 *
 * Only items with an explicit public-domain license in their archive.org
 * metadata are used, and only files that map to exactly one chapter
 * (multi-chapter files are rejected, so coverage gaps are honest).
 * Audio is streamed from archive.org; nothing is downloaded.
 */
import { writeFileSync, mkdirSync } from "node:fs";

// Canonical books, mirroring src/lib/canon.ts (name, slug, chapter count).
const CANON = [
  ["Genesis", "genesis", 50], ["Exodus", "exodus", 40], ["Leviticus", "leviticus", 27],
  ["Numbers", "numbers", 36], ["Deuteronomy", "deuteronomy", 34], ["Joshua", "joshua", 24],
  ["Judges", "judges", 21], ["Ruth", "ruth", 4], ["1 Samuel", "1-samuel", 31],
  ["2 Samuel", "2-samuel", 24], ["1 Kings", "1-kings", 22], ["2 Kings", "2-kings", 25],
  ["1 Chronicles", "1-chronicles", 29], ["2 Chronicles", "2-chronicles", 36],
  ["Ezra", "ezra", 10], ["Nehemiah", "nehemiah", 13], ["Esther", "esther", 10],
  ["Job", "job", 42], ["Psalms", "psalms", 150], ["Proverbs", "proverbs", 31],
  ["Ecclesiastes", "ecclesiastes", 12], ["Song of Solomon", "song-of-solomon", 8],
  ["Isaiah", "isaiah", 66], ["Jeremiah", "jeremiah", 52], ["Lamentations", "lamentations", 5],
  ["Ezekiel", "ezekiel", 48], ["Daniel", "daniel", 12], ["Hosea", "hosea", 14],
  ["Joel", "joel", 3], ["Amos", "amos", 9], ["Obadiah", "obadiah", 1],
  ["Jonah", "jonah", 4], ["Micah", "micah", 7], ["Nahum", "nahum", 3],
  ["Habakkuk", "habakkuk", 3], ["Zephaniah", "zephaniah", 3], ["Haggai", "haggai", 2],
  ["Zechariah", "zechariah", 14], ["Malachi", "malachi", 4], ["Matthew", "matthew", 28],
  ["Mark", "mark", 16], ["Luke", "luke", 24], ["John", "john", 21],
  ["Acts", "acts", 28], ["Romans", "romans", 16], ["1 Corinthians", "1-corinthians", 16],
  ["2 Corinthians", "2-corinthians", 13], ["Galatians", "galatians", 6],
  ["Ephesians", "ephesians", 6], ["Philippians", "philippians", 4],
  ["Colossians", "colossians", 4], ["1 Thessalonians", "1-thessalonians", 5],
  ["2 Thessalonians", "2-thessalonians", 3], ["1 Timothy", "1-timothy", 6],
  ["2 Timothy", "2-timothy", 4], ["Titus", "titus", 3], ["Philemon", "philemon", 1],
  ["Hebrews", "hebrews", 13], ["James", "james", 5], ["1 Peter", "1-peter", 5],
  ["2 Peter", "2-peter", 3], ["1 John", "1-john", 5], ["2 John", "2-john", 1],
  ["3 John", "3-john", 1], ["Jude", "jude", 1], ["Revelation", "revelation", 22],
].map(([name, slug, chapters]) => ({ name, slug, chapters }));

const RETRIEVED = new Date().toISOString().slice(0, 10);

/** Canonical slug -> archive.org identifiers, in preference order.
 *  All are LibriVox recordings of the KJV (public domain). */
const CANDIDATES = {
  numbers: ["numbers_kjv_1108_librivox"],
  deuteronomy: ["deuteronomy_kjv_1110_librivox"],
  joshua: ["bible_kjv_joshua_jc_librivox"],
  judges: ["bible_judges_kjv_jc_librivox"],
  ruth: ["bible_ruth_tg_librivox", "biblekjv_8ruth_dr_1502_librivox"],
  "1-samuel": ["bible_1samuel_kjv_0903_librivox"],
  "2-samuel": ["bible_2samuel_kjv_jc_librivox"],
  "1-kings": ["bible_kjv_11_1king_0909_librivox"],
  "2-kings": ["bible_kjv_2kings_jc_librivox"],
  "1-chronicles": ["1chronicles_jc_librivox"],
  "2-chronicles": ["2chronicleskjv_1403_librivox", "bible_kjv_14_2chronicles_1110_librivox"],
  ezra: ["ezra_kjv_sw_librivox"],
  nehemiah: ["nehemiah_kjv_1110_librivox"],
  esther: ["bible_kjv_17_esther_dr_1502_librivox"],
  job: ["bible_kjv_18_job_version_2_1507_librivox", "job_1612_librivox"],
  psalms: ["bible_kjv_19_psalms_1207_librivox", "psalms_kjv_1202_librivox"],
  proverbs: ["proverbs_kjv_mp_librivox"],
  ecclesiastes: ["ecclesiastes_kjv_1105_librivox"],
  "song-of-solomon": ["songofsolomon_kjv_1009_librivox"],
  isaiah: ["isaiah_kjv_1107_librivox"],
  jeremiah: ["jeremiah_kjv_1201_librivox"],
  lamentations: ["bible_kjv_25_lamentations_mp_0909_librivox"],
  ezekiel: ["ezekiel_kjv_jr_librivox"],
  daniel: ["daniel_kjv_1112_librivox"],
  joel: ["joel_kjv_ss_librivox"],
  matthew: ["matthew_kjv_mp_librivox"],
  mark: ["mark_kjv_sw_librivox"],
  luke: ["bible_kjv_nt_03_luke_0812_librivox"],
  john: ["biblent04_john_kjv_librivox"],
  acts: ["acts_kjv_v2_1401_librivox", "acts_kjv_1112_librivox"],
  romans: ["romans_kjv_1408_librivox", "romans_kjv_1103_librivox"],
  "1-corinthians": ["1corinthians_kjv_1103_librivox"],
  "2-corinthians": ["2corinthians_kjv_1105_librivox"],
  galatians: ["galatians_kjv_1412_librivox", "bible_4epistles_kjv_1104_librivox"],
  ephesians: ["ephesians_kjv_nt_librivox", "bible_4epistles_kjv_1104_librivox"],
  philippians: ["philippians_kjv_vm_librivox", "bible_4epistles_kjv_1104_librivox"],
  colossians: ["bible_4epistles_kjv_1104_librivox"],
  "1-thessalonians": ["bible_1thessalonians_kjv_1010_librivox"],
  "2-thessalonians": ["bible_2thessalonians_kjv_1011_librivox"],
  "1-timothy": ["bible_1timothy_kjv_1007_librivox"],
  "2-timothy": ["bible_2timothy_kjv_1009_librivox"],
  titus: ["bible_titus_kjv_1007_librivox"],
  philemon: ["bible_philemon_kjv_1007_librivox"],
  hebrews: ["hebrews_kjv_1111_librivox"],
  james: ["james_kjv"],
  "1-peter": ["epistlesofpeter_kjv_1109_librivox"],
  "2-peter": ["epistlesofpeter_kjv_1109_librivox"],
  "1-john": ["bible_epistlesjohn_rt_librivox", "1John_kjv_librivox"],
  "2-john": ["bible_epistlesjohn_rt_librivox"],
  "3-john": ["bible_epistlesjohn_rt_librivox"],
  jude: ["jude_kjv"],
  revelation: ["revelation_mp_librivox", "bible_kjvnt_27_revelation_1401_librivox"],
};

/** Every book name that may appear in a file title, longest first. */
const BOOK_NAMES = [...new Set(CANON.map((b) => b.name))].sort(
  (a, b) => b.length - a.length
);

function isPublicDomain(licenseurl) {
  return (
    typeof licenseurl === "string" &&
    /creativecommons\.org\/(publicdomain|licenses\/publicdomain)/.test(licenseurl)
  );
}

/** Parse a duration ("12:34" or "1:02:03" or seconds) to seconds. */
function parseLength(len) {
  if (len == null) return null;
  if (typeof len === "number") return Math.round(len);
  const parts = String(len).split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return Math.round(parts.reduce((acc, n) => acc * 60 + n, 0));
}

/**
 * Map a file title to a single chapter of `book`, or null.
 * Rejects anything covering a range of chapters or another book.
 */
function titleToChapter(title, book) {
  if (!title) return null;
  // "03 - Joel" style: strip a leading track number.
  let t = String(title).replace(/^\s*\d{1,3}\s*-\s*/, "");
  // If the title names a book, it must be this one.
  const named = BOOK_NAMES.find((n) =>
    new RegExp(`\\b${n.replace(/ /g, "\\s+")}\\b`, "i").test(t)
  );
  if (named && named !== book.name) return null;
  t = t.replace(new RegExp(`\\b${book.name.replace(/ /g, "\\s+")}\\b`, "i"), " ");
  t = t.replace(/chapters?/gi, " ");
  const nums = t.match(/\d{1,3}/g);
  if (!nums || nums.length !== 1) return null;
  const ch = Number(nums[0]);
  return ch >= 1 && ch <= book.chapters ? ch : null;
}

async function fetchMeta(id) {
  const res = await fetch(`https://archive.org/metadata/${id}`);
  if (!res.ok) throw new Error(`metadata ${id}: HTTP ${res.status}`);
  return res.json();
}

function readerFrom(meta) {
  const desc = String(meta.description ?? "");
  const m =
    desc.match(/Read in English by\s*([^<.\n]+)/i) ||
    desc.match(/Read by\s*([^<.\n]+)/i);
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

const manifest = { generated: RETRIEVED, sources: {}, chapters: {} };
const covered = {};
const skipped = [];

for (const book of CANON) {
  const ids = CANDIDATES[book.slug] ?? [];
  let done = false;
  for (const id of ids) {
    if (done) break;
    let data;
    try {
      data = await fetchMeta(id);
    } catch (e) {
      console.error(`  ! ${book.slug}: ${e.message}`);
      continue;
    }
    const meta = data.metadata ?? {};
    if (!isPublicDomain(meta.licenseurl)) {
      skipped.push(`${book.slug}: ${id} (no PD license in metadata)`);
      continue;
    }
    const files = (data.files ?? []).filter(
      (f) =>
        f.name.toLowerCase().endsWith(".mp3") &&
        !/(_64kb|_128kb|_vbr)/i.test(f.name)
    );
    const map = new Map(); // chapter -> file
    for (const f of files) {
      const ch = titleToChapter(f.title, book);
      if (ch !== null && !map.has(ch)) map.set(ch, f);
    }
    // Accept the item only if it covers the whole book; otherwise fall to
    // the next candidate. (An item that covers some chapters is still used
    // if no better one exists — handled by the second pass below.)
    const full = map.size === book.chapters;
    if (map.size === 0) {
      skipped.push(`${book.slug}: ${id} (no per-chapter files)`);
      continue;
    }
    if (!manifest.sources[id]) {
      manifest.sources[id] = {
        title: meta.title ?? id,
        license: meta.licenseurl,
        reader: readerFrom(meta),
      };
    }
    for (const [ch, f] of map) {
      manifest.chapters[`${book.slug}:${ch}`] = {
        src: id,
        file: f.name,
        seconds: parseLength(f.length),
      };
    }
    covered[book.slug] = { id, chapters: map.size, of: book.chapters, full };
    done = full;
  }
  if (!covered[book.slug] && ids.length === 0) {
    skipped.push(`${book.slug}: no per-chapter LibriVox KJV source known`);
  }
}

mkdirSync("data/audio", { recursive: true });
writeFileSync("data/audio/manifest.json", JSON.stringify(manifest, null, 1));

const books = Object.keys(covered).length;
const chapters = Object.keys(manifest.chapters).length;
console.log(`\nCovered ${chapters} of 1189 chapters across ${books} of 66 books.`);
for (const [slug, c] of Object.entries(covered)) {
  console.log(
    `  ${slug}: ${c.chapters}/${c.of}${c.full ? "" : " (PARTIAL)"} [${c.id}]`
  );
}
console.log("\nGaps / notes:");
for (const s of skipped) console.log(`  - ${s}`);
