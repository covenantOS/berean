#!/usr/bin/env node
/**
 * Harvest The Spurgeon Library's sermon archive (spurgeon.org, a ministry of
 * Midwestern Baptist Theological Seminary) into Berean's sermon index and
 * reader texts.
 *
 * Source: the site's WordPress backend, queried through its public WPGraphQL
 * endpoint (see data/_sources/spurgeon-sermons/PROVENANCE.md). Raw responses
 * are cached in data/_sources/spurgeon-sermons/graphql/ (kept out of git,
 * reproducible from the endpoint) and normalized on reruns.
 * Output: data/sermons/index.json (one summary row per sermon) and
 * data/sermons/texts/<slug>.json (one reader file per sermon).
 *
 * The sermons themselves (New Park Street Pulpit and Metropolitan
 * Tabernacle Pulpit, published 1855-1917; Spurgeon died 1892) are public
 * domain; the Library's transcription adds no editorial apparatus of its
 * own. Registered in src/lib/rights.ts as "spurgeon-sermons".
 *
 * Each GraphQL record carries the sermon's title, full HTML content, its
 * "scripture reference" display string ("Romans 10:1-3"), the year, the
 * canonical sermon number where the Library records one (about two in
 * five; posthumously numbered sermons carry suffixes like "3141A"), the
 * collection volume, a facsimile PDF URL, and the site's scripture-chapter
 * taxonomy slugs ("romans-10"), which match Berean's canon slugs exactly.
 * The content leads with an <h2> title (dropped: it duplicates the
 * metadata) and an <h5> holding the appointed text's quotation, which
 * ships as the reader's quote block; <p> blocks become paragraphs.
 *
 * Sermons tagged to several chapters index under each; sermons whose
 * chapter tags fail to parse land in the anomaly log and ship with an
 * empty chapter list (still readable, simply absent from the guide).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENDPOINT = "https://spurgeoncenter.wpenginepowered.com/graphql";
const CACHE = path.join(ROOT, "data", "_sources", "spurgeon-sermons", "graphql");
const OUT_DIR = path.join(ROOT, "data", "sermons");
const TEXTS = path.join(OUT_DIR, "texts");

const anomalies = [];
const stats = { fetched: 0, headers: 0, headerNumbers: 0 };

/* Berean canon from the shipped KJV text: slug -> chapter count, the
 * convention of the other builds. */
const canon = new Map();
for (const f of fs.readdirSync(path.join(ROOT, "data", "kjv"))) {
  if (!f.endsWith(".json")) continue;
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kjv", f), "utf8"));
  const slug = d.book.toLowerCase().replace(/^(\d) /, "$1-").replace(/ /g, "-");
  canon.set(slug, d.chapters.length);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERY = `query Sermons($cursor: String) {
  sermons(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      slug
      title
      content
      uri
      sermonFields { sermonNumber year scriptureReference pdfUrl }
      sermonCollections { nodes { name } }
      scriptureChapters { nodes { slug } }
    }
  }
}`;

/** One GraphQL page, cached on disk (250ms courtesy delay on fetch). */
async function page(n, cursor) {
  const file = path.join(CACHE, `page-${String(n).padStart(3, "0")}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(250);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { cursor } }),
    }).catch((e) => ({ ok: false, status: String(e) }));
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.sermons?.nodes) {
        fs.mkdirSync(CACHE, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(json));
        stats.fetched++;
        return json;
      }
      last = JSON.stringify(json).slice(0, 200);
    } else {
      last = String(res.status ?? res);
    }
  }
  throw new Error(`graphql page ${n} failed: ${last}`);
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** HTML fragment -> plain paragraphs, the burkitt/darby convention. */
function clean(fragment) {
  let s = fragment;
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<\/(h3|h4|h5|li|blockquote)>/gi, "\n\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ");
  return s
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** A sermon's content: every <h2> goes (the title duplicates metadata);
 * the first <h5>, when it is the printed publication block ("No. 3006 A
 * Sermon Published On..."), ships as the reader's header line and
 * backfills the canonical number where the metadata lacks one; the
 * remaining <h5> blocks hold the appointed text's quotation and ship as
 * the quote; <p> blocks become paragraphs. */
function parseContent(html, slug) {
  let s = html ?? "";
  s = s.replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, "");
  const h5s = [];
  s = s.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (whole, inner) => {
    const text = clean(inner).join(" ");
    if (text) h5s.push(text);
    return "\n\n";
  });
  let header = null;
  let headerNumber = null;
  const headerRe = /\b(a sermon (published|delivered|preached)|delivered by c\.?\s?h\.?\s?spurgeon|at the metropolitan tabernacle|new park street (chapel|pulpit))\b/i;
  if (h5s.length && headerRe.test(h5s[0])) {
    header = h5s.shift();
    const n = /^no\.\s*([0-9]+[A-Za-z]?(?:[-,]\s?[0-9]+)*)/i.exec(header);
    if (n) headerNumber = n[1];
    stats.headers++;
  }
  const quote = h5s.join("\n") || null;
  const paragraphs = clean(s);
  if (!paragraphs.length) anomalies.push(`${slug}: no body paragraphs`);
  return { header, headerNumber, quote, paragraphs };
}

/** Chapter tags ("romans-10") -> [{ book, chapter }], validated against
 * the canon. Book slugs in the site's taxonomy match Berean's exactly.
 * One-chapter books carry verse numbers in the tag ("obadiah-17" for
 * Obadiah 17); those normalize to the book's single chapter. */
function mapChapters(nodes, slug) {
  const out = [];
  const seen = new Set();
  for (const t of nodes ?? []) {
    const m = /^(.*)-(\d+)$/.exec(t.slug ?? "");
    if (!m) {
      anomalies.push(`${slug}: chapter tag "${t.slug}" does not parse`);
      continue;
    }
    const [, book, chs] = m;
    let chapter = Number(chs);
    const max = canon.get(book);
    if (!max || chapter < 1) {
      anomalies.push(`${slug}: chapter tag "${t.slug}" outside the canon`);
      continue;
    }
    if (chapter > max) {
      if (max === 1) {
        chapter = 1;
        stats.verseTags++;
      } else {
        anomalies.push(`${slug}: chapter tag "${t.slug}" outside the canon`);
        continue;
      }
    }
    const key = `${book}:${chapter}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ book, chapter });
    }
  }
  return out;
}

async function main() {
  const nodes = [];
  let cursor = null;
  for (let n = 0; ; n++) {
    const json = await page(n, cursor);
    nodes.push(...json.data.sermons.nodes);
    if (!json.data.sermons.pageInfo.hasNextPage) break;
    cursor = json.data.sermons.pageInfo.endCursor;
  }
  console.log(`harvested ${nodes.length} sermons (${stats.fetched} pages fetched, rest from cache)`);

  fs.mkdirSync(TEXTS, { recursive: true });
  /* Drop stale outputs this build no longer emits. */
  for (const f of fs.readdirSync(TEXTS)) if (f.endsWith(".json")) fs.unlinkSync(path.join(TEXTS, f));

  const index = [];
  let bytes = 0;
  let noChapter = 0;
  let multiChapter = 0;
  let withNumber = 0;
  let fffd = 0;
  const seenSlugs = new Set();
  for (const node of nodes) {
    const slug = node.slug;
    if (seenSlugs.has(slug)) {
      anomalies.push(`${slug}: duplicate slug, later record dropped`);
      continue;
    }
    seenSlugs.add(slug);
    const title = decodeEntities(node.title ?? "").trim();
    const { header, headerNumber, quote, paragraphs } = parseContent(node.content, slug);
    const fields = node.sermonFields ?? {};
    /* Canonical numbers arrive as "3060", with a suffix ("3141A"), or as
     * the printer's combined issues ("39-40", "7, 8"); polluted values
     * ("874Delivered", "1850-51A") drop out and log. The printed
     * publication block backfills the number where the field lacks one. */
    let number = fields.sermonNumber ? String(fields.sermonNumber).trim() : null;
    if (number && !/^(\d+[A-Za-z]?|\d+([-,]\s?\d+)+)$/.test(number)) {
      anomalies.push(`${slug}: sermon number "${number}" not canonical, dropped`);
      number = null;
    }
    if (!number && headerNumber) {
      number = headerNumber;
      stats.headerNumbers++;
    }
    if (number) withNumber++;
    const year = fields.year ? Number(fields.year) : null;
    const ref = decodeEntities(fields.scriptureReference ?? "").trim() || null;
    const volume = node.sermonCollections?.nodes?.[0]?.name ?? null;
    const pdf = fields.pdfUrl || null;
    const url = `https://www.spurgeon.org${node.uri}`;
    const chapters = mapChapters(node.scriptureChapters?.nodes, slug);
    if (!chapters.length) noChapter++;
    if (chapters.length > 1) multiChapter++;
    const record = { slug, title, number, year, volume, ref, header, quote, paragraphs, url, pdf };
    const json = JSON.stringify(record);
    fffd += json.split("�").length - 1;
    bytes += json.length;
    fs.writeFileSync(path.join(TEXTS, `${slug}.json`), json);
    index.push({ slug, title, number, year, volume, ref, url, pdf, chapters });
  }
  index.sort((a, z) => (a.year ?? 9999) - (z.year ?? 9999) || a.title.localeCompare(z.title));
  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify({ sermons: index }));
  console.log(
    `Wrote ${index.length} sermons to ${path.relative(ROOT, OUT_DIR)}/ ` +
    `(${(bytes / 1048576).toFixed(1)}MB of reader texts; ${withNumber} with canonical numbers ` +
    `(${stats.headerNumbers} backfilled from the printed block), ${noChapter} without chapter tags, ` +
    `${multiChapter} multi-chapter, ${stats.headers} with printed publication blocks, U+FFFD ${fffd})`
  );
  if (anomalies.length) {
    console.log("anomalies:");
    for (const a of anomalies) console.log(`  ${a}`);
  }
}

await main();
