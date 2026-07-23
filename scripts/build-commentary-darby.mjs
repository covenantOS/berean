#!/usr/bin/env node
/**
 * Normalize STEM Publishing's digitization of J. N. Darby's Synopsis of the
 * Books of the Bible into the format read by src/lib/commentary.ts.
 *
 * Source: https://stempublishing.com/authors/darby/synopsis/ (see
 * data/_sources/darby/PROVENANCE.md). Pages are fetched once into
 * data/_sources/darby/html/ (kept out of git, reproducible from the site)
 * and parsed from the cache on reruns.
 * Output: data/commentary/darby/<BookFile>.json.
 *
 * The CrossWire "Darby" SWORD module is Darby's Bible translation, not the
 * Synopsis, so no zCom source exists for this work; STEM's per-chapter HTML
 * is the cleanest openly hosted digitization (no copyright notice on any
 * page; the work itself, first English edition 1857-1862, is public
 * domain).
 *
 * STEM organizes the Synopsis as one landing page per book plus one page
 * per section, linked from the landing page's sidebar in order. Section
 * titles run "Introduction", "Chapter N", "Chapters A to B", or
 * "Chapters A and B". Each page carries its heading in an <h2> and its
 * body between the <!-- body --> and <!-- link to top --> markers, with
 * <h4> subtitles between <p> paragraphs.
 *
 * Darby wrote prose chapter by chapter, never verse by verse, so every
 * section ships with an empty verses label (the intro-section convention
 * of the other builds). A section covering several chapters is duplicated
 * into each covered chapter, prefixed with its printed scope title
 * ("Chapters 6 to 8") so the duplicated text carries its range honestly.
 * Book introductions ship as intro sections in chapter 1, prefixed "Book
 * Introduction - <Book>"; the work-level preface and the Old and New
 * Testament introductions ship as intro sections in Genesis 1 and
 * Matthew 1.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = "https://stempublishing.com/authors/darby/synopsis/";
const CACHE = path.join(ROOT, "data", "_sources", "darby", "html");
const OUT_DIR = path.join(ROOT, "data", "commentary", "darby");

/* Berean canon in KJV order (from the shipped KJV text, the convention of
 * the other commentary builds) plus each book's STEM landing page, taken
 * from the synopsis index sidebar on 2026-07-23. */
const STEM = {
  Genesis: "genesis/genesis0.html", Exodus: "exodus/exodus.html",
  Leviticus: "leviticus/leviticus0.html", Numbers: "numbers/numbers.html",
  Deuteronomy: "deuteronomy/deuteronomy.html", Joshua: "joshua/joshua.html",
  Judges: "judges/judges.html", Ruth: "ruth/ruth.html",
  "1Samuel": "1samuel/1samuel.html", "2Samuel": "2samuel/2samuel.html",
  "1Kings": "1kings/1kings0.html", "2Kings": "2kings/2kings1.html",
  "1Chronicles": "1chronicles/1chronicles.html", "2Chronicles": "2chronicles/2chronicles.html",
  Ezra: "ezra/ezra0.html", Nehemiah: "nehemiah/nehemiah0.html",
  Esther: "esther/esther.html", Job: "job/job0.html",
  Psalms: "psalms/psalms.html", Proverbs: "proverbs/proverbs0.html",
  Ecclesiastes: "ecclesiastes/ecclesiastes.html", SongofSolomon: "canticles/canticles0.html",
  Isaiah: "isaiah/isaiah.html", Jeremiah: "jeremiah/jeremiah0.html",
  Lamentations: "lamentations/lamentations.html", Ezekiel: "ezekiel/ezekiel.html",
  Daniel: "daniel/daniel.html", Hosea: "hosea/hosea0.html",
  Joel: "joel/joel.html", Amos: "amos/amos0.html",
  Obadiah: "obadiah/obadiah.html", Jonah: "jonah/jonah1.html",
  Micah: "micah/micah0.html", Nahum: "nahum/nahum.html",
  Habakkuk: "habakkuk/habakkuk0.html", Zephaniah: "zephaniah/zephaniah.html",
  Haggai: "haggai/haggai.html", Zechariah: "zechariah/zechariah.html",
  Malachi: "malachi/malachi.html", Matthew: "matthew/matthew0.html",
  Mark: "mark/mark0.html", Luke: "luke/luke0.html",
  John: "john/john0.html", Acts: "acts/acts.html",
  Romans: "romans/romans0.html", "1Corinthians": "1corinthians/1corinthians0.html",
  "2Corinthians": "2corinthians/2corinthians1.html", Galatians: "galatians/galatians0.html",
  Ephesians: "ephesians/ephesians.html", Philippians: "philippians/philippians0.html",
  Colossians: "colossians/colossians0.html", "1Thessalonians": "1thessalonians/1thessalonians0.html",
  "2Thessalonians": "2thessalonians/2thessalonians0.html", "1Timothy": "1timothy/1timothy0.html",
  "2Timothy": "2timothy/2timothy.html", Titus: "titus/titus0.html",
  Philemon: "philemon/philemon.html", Hebrews: "hebrews/hebrews0.html",
  James: "james/james0.html", "1Peter": "1peter/1peter0.html",
  "2Peter": "2peter/2peter0.html", "1John": "1john/1john0.html",
  "2John": "2john/2john0.html", "3John": "3john/3john0.html",
  Jude: "jude/jude0.html", Revelation: "revelation/revelation.html",
};

/* Work-level pages that ride as intro sections: the preface, the Old and
 * New Testament introductions, and the two prophetic-corpus introductions
 * (placed with Isaiah and Hosea, where those corpora begin). */
const SPECIALS = [
  { path: "preface0.html", bookFile: "Genesis", label: "Preface - Synopsis of the Books of the Bible" },
  { path: "OT_Intro.html", bookFile: "Genesis", label: "Introduction to the Old Testament" },
  { path: "prophets.html", bookFile: "Isaiah", label: "Introduction to the Prophets" },
  { path: "minor.html", bookFile: "Hosea", label: "Introduction to the Minor Prophets" },
  { path: "NT_Intro.html", bookFile: "Matthew", label: "Introduction to the New Testament" },
  { path: "Ep_Intro.html", bookFile: "Romans", label: "Introduction to the Epistles" },
];

const canon = Object.keys(STEM).map((file) => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kjv", `${file}.json`), "utf8"));
  return { book: d.book, file, chapters: d.chapters.length, verses: d.chapters.map((c) => c.verses.length) };
});

const anomalies = [];
const stats = { pages: 0, fetched: 0, intros: 0, ranges: 0, duplicatedChapters: 0 };

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch one page into the disk cache (250ms courtesy delay); read from
 * the cache when present. Returns null when the page cannot be had; the
 * caller records the anomaly, and the book-count guard at the end refuses
 * partial output on systemic failure. */
async function page(rel) {
  const file = path.join(CACHE, rel);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const url = BASE + rel;
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(250);
    const res = await fetch(url).catch((e) => ({ ok: false, status: String(e) }));
    if (res.ok) {
      const text = await res.text();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
      stats.fetched++;
      return text;
    }
    last = String(res.status ?? res);
    if (res.status === 404) break;
  }
  anomalies.push(`${rel}: fetch failed (${last})`);
  return null;
}

/** Parse a section page: its <h2> title and its paragraphs. Section pages
 * bound the body with <!-- body --> ... <!-- link to top -->; work-level
 * pages (preface, testament introductions) lack the body marker, so the
 * body starts at the end of the breadcrumb table instead. <h4> subtitles
 * keep their own paragraphs. */
function parsePage(html, rel) {
  const h2 = html.match(/<h2>([^<]*)<\/h2>/);
  const start = html.indexOf("<!-- body -->");
  let end = html.indexOf("<!-- link to top -->");
  if (end < 0) end = html.indexOf("</body");
  let from = start;
  if (from < 0) {
    const loc = html.indexOf("<!-- location -->");
    const tableEnd = loc >= 0 ? html.indexOf("</table>", loc) : -1;
    from = tableEnd >= 0 ? tableEnd + "</table>".length : -1;
  }
  if (from < 0 || end < 0 || end <= from) {
    anomalies.push(`${rel}: body markers missing`);
    return null;
  }
  let s = html.slice(from, end);
  /* The title h1/h2 sit inside the fallback region of work-level pages;
   * strip them (metadata carries the title). Section pages have none in
   * the body region, so this is a no-op there. */
  s = s.replace(/<h[12][^>]*>[\s\S]*?<\/h[12]>/gi, "");
  s = s.replace(/<center>\s*<h4>/gi, "\n\n").replace(/<\/h4>\s*<\/center>/gi, "\n\n");
  s = s.replace(/<\/p>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ");
  const paragraphs = s
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  const text = paragraphs.join("\n\n").trim();
  if (!text) {
    anomalies.push(`${rel}: empty body`);
    return null;
  }
  return { title: h2 ? decodeEntities(h2[1]).trim() : "", text };
}

/** What a section title covers: "Chapter N", "Chapters A to B", "Chapters
 * A and B", or a verse-qualified range. The verse-qualified form "Chapters
 * A:V to B" is told apart by the book's own verse counts: B equal to
 * chapter A's verse count is a span to the chapter's end ("Chapters
 * 11:19 to 30" in Acts), anything else runs from chapter A through
 * chapter B ("Chapters 9:35 to 12" in 1 Chronicles). Whole-book
 * "Summary" / "Conclusion" essays serve the shortest books. Verse spans
 * return scoped so the section carries its printed range. */
function covered(title, book) {
  if (/^introduction/i.test(title)) return null;
  if (/^summary$/i.test(title)) return "summary";
  if (/^conclusion$/i.test(title)) return "conclusion";
  const max = book.chapters;
  let list;
  let scoped = false;
  const verseSpan = /(\d+):(\d+)\s+to\s+(\d+)/i.exec(title);
  const range = /(\d+)\s+to\s+(\d+)/i.exec(title);
  const pair = /(\d+)\s+and\s+(\d+)/i.exec(title);
  const single = /(\d+)/.exec(title);
  if (verseSpan) {
    const [a, , b] = [Number(verseSpan[1]), Number(verseSpan[2]), Number(verseSpan[3])];
    scoped = true;
    if (a >= 1 && a <= max && b === book.verses[a - 1]) list = [a];
    else list = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  } else if (range) {
    const [a, z] = [Number(range[1]), Number(range[2])];
    list = Array.from({ length: z - a + 1 }, (_, i) => a + i);
  } else if (pair) {
    list = [Number(pair[1]), Number(pair[2])];
  } else if (single) {
    list = [Number(single[1])];
  } else {
    return undefined;
  }
  if (list.some((n) => n < 1 || n > max)) return undefined;
  return { list, scoped };
}

/** The sidebar's ordered section links: anchors plus the <strong> marker
 * for the landing page itself. */
function sidebar(html, landingFile) {
  const start = html.indexOf("nowrap>");
  const end = html.indexOf("<!-- body -->");
  if (start < 0 || end < 0 || end <= start) return null;
  const region = html.slice(start, end);
  const out = [];
  const re = /(?:<a href="([a-z0-9]+\.html)">([^<]+)<\/a>|<strong>([^<]+)<\/strong>)\s*<br\s*\/?>/gi;
  let m;
  while ((m = re.exec(region))) {
    out.push({ file: m[1] ?? landingFile, title: decodeEntities(m[2] ?? m[3]).trim() });
  }
  return out;
}

function* canonicalOrder(sections, chapterCount) {
  const byChapter = new Map();
  for (const s of sections) {
    if (!byChapter.has(s.chapter)) byChapter.set(s.chapter, []);
    byChapter.get(s.chapter).push(s.section);
  }
  for (let ch = 1; ch <= chapterCount; ch++) {
    if (byChapter.has(ch)) yield { chapter: String(ch), sections: byChapter.get(ch) };
  }
}

async function main() {
  const books = new Map();

  /* Work-level introductions ride with Genesis 1 and Matthew 1. */
  const specials = new Map();
  for (const sp of SPECIALS) {
    const html = await page(sp.path);
    if (!html) continue;
    const parsed = parsePage(html, sp.path);
    if (parsed) {
      if (!specials.has(sp.bookFile)) specials.set(sp.bookFile, []);
      specials.get(sp.bookFile).push({ verses: "", text: `${sp.label}\n\n${parsed.text}` });
      stats.intros++;
    }
  }

  for (const b of canon) {
    const landing = STEM[b.file];
    const folder = landing.split("/")[0];
    const landingFile = landing.split("/")[1];
    const landingHtml = await page(landing);
    if (!landingHtml) {
      anomalies.push(`${b.file}: landing page ${landing} unavailable`);
      continue;
    }
    const links = sidebar(landingHtml, landingFile);
    if (!links || !links.length) {
      anomalies.push(`${b.file}: sidebar not found on ${landing}`);
      continue;
    }
    const sections = [];
    if (specials.has(b.file)) {
      for (const s of specials.get(b.file)) sections.push({ chapter: 1, section: s });
    }
    const seen = new Set();
    for (const link of links) {
      if (seen.has(link.file)) continue;
      seen.add(link.file);
      const rel = `${folder}/${link.file}`;
      const html = await page(rel);
      if (!html) continue;
      const parsed = parsePage(html, rel);
      stats.pages++;
      if (!parsed) continue;
      const cov = covered(parsed.title, b);
      if (cov === null) {
        sections.push({ chapter: 1, section: { verses: "", text: `Book Introduction - ${b.book}\n\n${parsed.text}` } });
        stats.intros++;
      } else if (cov === "summary" || cov === "conclusion") {
        /* Short books carry one whole-book essay; it rides with chapter 1. */
        const label = cov === "summary" ? "Book Summary" : "Book Conclusion";
        sections.push({ chapter: 1, section: { verses: "", text: `${label} - ${b.book}\n\n${parsed.text}` } });
        stats.intros++;
      } else if (cov === undefined) {
        anomalies.push(`${rel}: cannot parse section title "${parsed.title}"`);
      } else {
        const { list, scoped } = cov;
        const prefix = list.length > 1 || scoped ? `${parsed.title}\n\n` : "";
        for (const ch of list) {
          sections.push({ chapter: ch, section: { verses: "", text: prefix + parsed.text } });
          if (list.length > 1) stats.duplicatedChapters++;
        }
        if (list.length > 1) stats.ranges++;
      }
    }
    if (sections.length) books.set(b.book, { file: b.file, count: b.chapters, sections });
  }

  if (books.size < 60) {
    console.error(`only ${books.size} books parsed; refusing to write partial output`);
    for (const a of anomalies) console.error(`  ${a}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  /* Drop stale outputs for books this build no longer emits. */
  for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, f));
  let chaptersTotal = 0;
  let sectionsTotal = 0;
  for (const [name, b] of books) {
    const chapters = [...canonicalOrder(b.sections, b.count)];
    chaptersTotal += chapters.length;
    sectionsTotal += chapters.reduce((t, c) => t + c.sections.length, 0);
    fs.writeFileSync(
      path.join(OUT_DIR, `${name.replace(/ /g, "")}.json`),
      JSON.stringify({ book: name, chapters })
    );
  }
  const fffd = books.size
    ? JSON.stringify([...books.values()].map((b) => b.sections)).split("�").length - 1
    : 0;
  console.log(
    `Wrote ${books.size} books, ${chaptersTotal} chapters, ${sectionsTotal} sections to ${path.relative(ROOT, OUT_DIR)}/ ` +
    `(${stats.pages} pages parsed, ${stats.fetched} fetched, ${stats.intros} intro sections, ` +
    `${stats.ranges} chapter ranges duplicated into ${stats.duplicatedChapters} chapters, U+FFFD ${fffd})`
  );
  if (anomalies.length) {
    console.log("anomalies:");
    for (const a of anomalies) console.log(`  ${a}`);
  }
}

await main();
