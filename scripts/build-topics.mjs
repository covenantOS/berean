/**
 * Build the topical index from two public-domain SWORD modules.
 *
 * Inputs:  data/_sources/naves/   (CrossWire "Nave" zLD module, see PROVENANCE.md)
 *          data/_sources/torreys/ (CrossWire "Torrey" RawLD module, see PROVENANCE.md)
 * Outputs: data/topics/naves.json    — topic tree with structured references
 *          data/topics/torreys.json
 *          data/topics/verses/<Book>.json — "chapter:verse" -> ["work:topicId"],
 *                                           the reverse index for the reader
 *
 * Every reference is normalized to the canonical slugs in src/lib/canon.ts and
 * validated against the shipped KJV text. References that cannot be mapped
 * (unknown book, chapter or verse beyond the canon, malformed source) are
 * skipped and counted, never silently dropped.
 */
import { promises as fs } from "fs";
import path from "path";
import zlib from "zlib";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "data", "topics");

/** OSIS book name -> [canonical slug, KJV file basename]. */
const OSIS = {
  Gen: "genesis", Exod: "exodus", Lev: "leviticus", Num: "numbers",
  Deut: "deuteronomy", Josh: "joshua", Judg: "judges", Ruth: "ruth",
  "1Sam": "1-samuel", "2Sam": "2-samuel", "1Kgs": "1-kings", "2Kgs": "2-kings",
  "1Chr": "1-chronicles", "2Chr": "2-chronicles", Ezra: "ezra", Neh: "nehemiah",
  Esth: "esther", Job: "job", Ps: "psalms", Prov: "proverbs", Eccl: "ecclesiastes",
  Song: "song-of-solomon", Isa: "isaiah", Jer: "jeremiah", Lam: "lamentations",
  Ezek: "ezekiel", Dan: "daniel", Hos: "hosea", Joel: "joel", Amos: "amos",
  Obad: "obadiah", Jonah: "jonah", Mic: "micah", Nah: "nahum", Hab: "habakkuk",
  Zeph: "zephaniah", Hag: "haggai", Zech: "zechariah", Mal: "malachi",
  Matt: "matthew", Mark: "mark", Luke: "luke", John: "john", Acts: "acts",
  Rom: "romans", "1Cor": "1-corinthians", "2Cor": "2-corinthians", Gal: "galatians",
  Eph: "ephesians", Phil: "philippians", Col: "colossians",
  "1Thess": "1-thessalonians", "2Thess": "2-thessalonians", "1Tim": "1-timothy",
  "2Tim": "2-timothy", Titus: "titus", Phlm: "philemon", Heb: "hebrews",
  Jas: "james", "1Pet": "1-peter", "2Pet": "2-peter", "1John": "1-john",
  "2John": "2-john", "3John": "3-john", Jude: "jude", Rev: "revelation",
};

/** Torrey's two/three-letter abbreviations -> canonical slug. */
const TORREY_BOOKS = {
  Ge: "genesis", Ex: "exodus", Le: "leviticus", Nu: "numbers", De: "deuteronomy",
  Jos: "joshua", Jg: "judges", Jud: "judges", Ru: "ruth",
  "1Sa": "1-samuel", "2Sa": "2-samuel", "1Ki": "1-kings", "2Ki": "2-kings",
  "1Ch": "1-chronicles", "2Ch": "2-chronicles", Ezr: "ezra", Ne: "nehemiah",
  Es: "esther", Job: "job", Ps: "psalms", Pr: "proverbs", Ec: "ecclesiastes",
  So: "song-of-solomon", Ca: "song-of-solomon", Isa: "isaiah", Jer: "jeremiah",
  La: "lamentations", Eze: "ezekiel", Da: "daniel", Ho: "hosea", Joe: "joel",
  Am: "amos", Ob: "obadiah", Jon: "jonah", Mic: "micah", Na: "nahum",
  Hab: "habakkuk", Zep: "zephaniah", Hag: "haggai", Zec: "zechariah", Mal: "malachi",
  Mt: "matthew", Mr: "mark", Lu: "luke", Joh: "john", Jn: "john", Ac: "acts",
  Ro: "romans", "1Co": "1-corinthians", "2Co": "2-corinthians", Ga: "galatians",
  Eph: "ephesians", Php: "philippians", Col: "colossians",
  "1Th": "1-thessalonians", "2Th": "2-thessalonians", "1Ti": "1-timothy",
  "2Ti": "2-timothy", Tit: "titus", Phm: "philemon", Heb: "hebrews",
  Jas: "james", Jam: "james", "1Pe": "1-peter", "2Pe": "2-peter",
  "1Jo": "1-john", "2Jo": "2-john", "3Jo": "3-john", Jude: "jude", Re: "revelation",
};

const CHAPTERS = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  joshua: 24, judges: 21, ruth: 4, "1-samuel": 31, "2-samuel": 24,
  "1-kings": 22, "2-kings": 25, "1-chronicles": 29, "2-chronicles": 36,
  ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150, proverbs: 31,
  ecclesiastes: 12, "song-of-solomon": 8, isaiah: 66, jeremiah: 52,
  lamentations: 5, ezekiel: 48, daniel: 12, hosea: 14, joel: 3, amos: 9,
  obadiah: 1, jonah: 4, micah: 7, nahum: 3, habakkuk: 3, zephaniah: 3,
  haggai: 2, zechariah: 14, malachi: 4, matthew: 28, mark: 16, luke: 24,
  john: 21, acts: 28, romans: 16, "1-corinthians": 16, "2-corinthians": 13,
  galatians: 6, ephesians: 6, philippians: 4, colossians: 4,
  "1-thessalonians": 5, "2-thessalonians": 3, "1-timothy": 6, "2-timothy": 4,
  titus: 3, philemon: 1, hebrews: 13, james: 5, "1-peter": 5, "2-peter": 3,
  "1-john": 5, "2-john": 1, "3-john": 1, jude: 1, revelation: 22,
};

const FILE_BY_SLUG = {};
for (const slug of Object.keys(CHAPTERS)) {
  FILE_BY_SLUG[slug] = slug.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}
FILE_BY_SLUG["song-of-solomon"] = "SongofSolomon";

/** Verses actually present in the shipped KJV, loaded lazily per book. */
const kjvCache = new Map();
async function kjvVerseSet(slug) {
  if (!kjvCache.has(slug)) {
    const raw = JSON.parse(
      await fs.readFile(path.join(ROOT, "data", "kjv", `${FILE_BY_SLUG[slug]}.json`), "utf8")
    );
    const set = new Set();
    for (const ch of raw.chapters) {
      for (const v of ch.verses) set.add(`${ch.chapter}:${v.verse}`);
    }
    kjvCache.set(slug, set);
  }
  return kjvCache.get(slug);
}

const stats = {};
function workStats(work) {
  stats[work] = {
    topics: 0, refsMapped: 0, refsUnmapped: 0, crossChapterRanges: 0,
    unmappedSamples: new Map(),
  };
  return stats[work];
}
function unmapped(st, raw, reason) {
  st.refsUnmapped++;
  if (st.unmappedSamples.size < 15) st.unmappedSamples.set(`${raw} [${reason}]`, (st.unmappedSamples.get(`${raw} [${reason}]`) ?? 0) + 1);
}

/** Parse an OSIS ref like "Exod.6.16-Exod.6.20", "1Chr.24", "Ps.34.1-Ps.34.8". */
async function mapOsisRef(st, osis) {
  const [from, to] = osis.split("-");
  const m = from.match(/^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) return unmapped(st, osis, "malformed"), [];
  const slug = OSIS[m[1]];
  if (!slug) return unmapped(st, osis, "unknown book"), [];
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > CHAPTERS[slug]) return unmapped(st, osis, "chapter beyond canon"), [];
  let verse = m[3] ? Number(m[3]) : null;
  let verseEnd = null;
  if (to) {
    const mt = to.match(/^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/);
    if (!mt || OSIS[mt[1]] !== slug || Number(mt[2]) !== chapter) {
      st.crossChapterRanges++;
      return [];
    }
    verseEnd = mt[3] ? Number(mt[3]) : null;
    if (verse === null) verse = 1; // chapter range "Ps.1-Ps.2" collapsed earlier by the chapter check
  }
  if (verse !== null) {
    const set = await kjvVerseSet(slug);
    if (!set.has(`${chapter}:${verse}`)) return unmapped(st, osis, "verse not in text"), [];
    if (verseEnd !== null && !set.has(`${chapter}:${verseEnd}`)) verseEnd = null;
  }
  const ref = { slug, chapter, verse };
  if (verseEnd !== null && verseEnd !== verse) ref.verseEnd = verseEnd;
  return [ref];
}

/** Parse one semicolon-separated Torrey reference string, inheriting the book. */
async function mapTorreyRefs(st, raw) {
  const refs = [];
  let book = null;
  for (let part of raw.split(";")) {
    part = part.trim();
    if (!part || /^\(/.test(part)) continue;
    const m = part.match(/^([1-3]?[A-Za-z]+)?\.?\s*(\d+)(?::([\d,\-\s]+))?$/) ??
      part.match(/^([1-3]?[A-Za-z]+)?\.?\s*(\d+):([\d,\-]+)/);
    if (!m) { unmapped(st, part, "malformed"); continue; }
    if (m[1]) {
      const slug = TORREY_BOOKS[m[1]];
      if (!slug) { unmapped(st, part, "unknown book"); book = null; continue; }
      book = slug;
    }
    if (!book) { unmapped(st, part, "no book context"); continue; }
    const chapter = Number(m[2]);
    if (chapter < 1 || chapter > CHAPTERS[book]) { unmapped(st, part, "chapter beyond canon"); continue; }
    if (!m[3]) {
      refs.push({ slug: book, chapter, verse: null });
      continue;
    }
    const set = await kjvVerseSet(book);
    for (const piece of m[3].split(",")) {
      const p = piece.trim();
      if (!p) continue;
      const rm = p.match(/^(\d+)(?:-(\d+))?$/);
      if (!rm) { unmapped(st, part, "malformed verse"); continue; }
      const verse = Number(rm[1]);
      if (!set.has(`${chapter}:${verse}`)) { unmapped(st, part, "verse not in text"); continue; }
      const ref = { slug: book, chapter, verse };
      if (rm[2]) {
        const end = Number(rm[2]);
        if (end > verse && set.has(`${chapter}:${end}`)) ref.verseEnd = end;
      }
      refs.push(ref);
    }
  }
  return refs;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function newNode() {
  return { label: "", refs: [], children: [] };
}
function cleanLabel(s) {
  return s
    .replace(/[\u2192\uf0b7]/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/(?:\s*[;,])+\s*$/, "")
    .trim();
}

/* ------------------------------- Nave (zLD) ------------------------------- */

async function readNaveEntries() {
  const dir = path.join(ROOT, "data", "_sources", "naves");
  const zdx = await fs.readFile(path.join(dir, "dict.zdx"));
  const zdt = await fs.readFile(path.join(dir, "dict.zdt"));
  const blocks = zdx.length / 8;
  const entries = [];
  for (let i = 0; i < blocks; i++) {
    const start = zdx.readUInt32LE(i * 8);
    const end = i + 1 < blocks ? zdx.readUInt32LE((i + 1) * 8) : zdt.length;
    const block = zlib.inflateSync(zdt.subarray(start, end));
    const count = block.readUInt32LE(0);
    for (let k = 0; k < count; k++) {
      const off = block.readUInt32LE(4 + k * 8);
      const size = block.readUInt32LE(8 + k * 8);
      entries.push(block.subarray(off, off + size).toString("utf8"));
    }
  }
  return entries;
}

/** Parse one Nave TEI <entryFree> body into a node tree. */
async function parseNaveBody(st, body) {
  const root = newNode();
  const listStack = [root.children];
  let current = null;
  const ensure = () => {
    if (!current) {
      current = newNode();
      listStack[listStack.length - 1].push(current);
    }
    return current;
  };
  const tokenRe = /<lb\s*\/>|<list>|<\/list>|<item>|<\/item>|<ref\b([^>]*)>([\s\S]*?)<\/ref>|<[^>]+>|([^<]+)/g;
  let m;
  while ((m = tokenRe.exec(body))) {
    const [tok, attrs, refText, text] = m;
    if (tok.startsWith("<lb")) {
      current = newNode();
      listStack[listStack.length - 1].push(current);
    } else if (tok === "<list>") {
      const parent = ensure();
      listStack.push(parent.children);
      current = null;
    } else if (tok === "</list>") {
      if (listStack.length > 1) listStack.pop();
      current = listStack[listStack.length - 1][listStack[listStack.length - 1].length - 1] ?? null;
    } else if (tok === "<item>") {
      current = newNode();
      listStack[listStack.length - 1].push(current);
    } else if (tok === "</item>") {
      current = null;
    } else if (attrs !== undefined) {
      const node = ensure();
      const osis = attrs.match(/osisRef="([^"]+)"/);
      const target = attrs.match(/target="Nave:([^"]+)"/);
      if (osis) {
        for (const ref of await mapOsisRef(st, osis[1])) {
          const key = `${ref.slug}:${ref.chapter}:${ref.verse}:${ref.verseEnd ?? ""}`;
          if (!node.refs.some((r) => `${r.slug}:${r.chapter}:${r.verse}:${r.verseEnd ?? ""}` === key)) {
            node.refs.push(ref);
            st.refsMapped++;
          }
        }
      } else if (target) {
        node.see = target[1];
        node.label += refText.trim();
      }
    } else if (text !== undefined) {
      // ref display text is consumed by the <ref> branch; what remains between
      // refs is separator punctuation, which is not label content
      if (!/^[\s.,;:()[\]]+$/.test(text)) ensure().label += text;
    }
  }
  const prune = (nodes) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      n.label = cleanLabel(n.label);
      prune(n.children);
      if (!n.label && !n.refs.length && !n.children.length && !n.see) {
        nodes.splice(i, 1);
      }
    }
  };
  prune(root.children);
  return root.children;
}

async function buildNaves() {
  const st = workStats("naves");
  const entries = await readNaveEntries();
  const topics = new Map();
  for (const entry of entries) {
    const tm = entry.match(/<entryFree n="([^"]*)">/);
    if (!tm) { unmapped(st, entry.slice(0, 60), "entry without title"); continue; }
    const title = tm[1].trim();
    const dm = entry.match(/<def>([\s\S]*)<\/def>/);
    const children = dm ? await parseNaveBody(st, dm[1]) : [];
    const id = slugify(title);
    if (topics.has(id)) {
      // duplicate title in the source module: merge the children
      topics.get(id).children.push(...children);
      continue;
    }
    topics.set(id, { id, title: title.toLowerCase(), children });
    st.topics++;
  }
  return [...topics.values()];
}

/* ------------------------------ Torrey (RawLD) ---------------------------- */

async function readTorreyEntries() {
  const dir = path.join(ROOT, "data", "_sources", "torreys");
  const idx = await fs.readFile(path.join(dir, "torrey.idx"));
  const dat = await fs.readFile(path.join(dir, "torrey.dat"));
  const entries = [];
  for (let i = 0; i + 6 <= idx.length; i += 6) {
    const off = idx.readUInt32LE(i);
    const size = idx.readUInt16LE(i + 4);
    entries.push(dat.subarray(off, off + size).toString("utf8"));
  }
  return entries;
}

/** Parse one Torrey ThML entry into a node tree (two levels: "- " and ". "). */
async function parseTorreyEntry(st, entry) {
  const text = entry.replace(/\r/g, "");
  // the title is separated from the body by a bare newline; physical lines in
  // the body are soft-wrapped, so newlines elsewhere fold to spaces
  const nl = text.indexOf("\n");
  const br = text.search(/<br\s*\/?>/);
  const cut = nl !== -1 && (br === -1 || nl < br) ? nl : br;
  const title = (cut === -1 ? text : text.slice(0, cut)).trim();
  const rest = (cut === -1 ? "" : text.slice(cut)).replace(/\n/g, " ");
  const children = [];
  let current = null;
  let level0 = null;
  const lines = rest.split(/<br\s*\/?>/);
  for (let line of lines) {
    const refTags = [...line.matchAll(/<scripRef[^>]*>([\s\S]*?)<\/scripRef>/g)];
    line = line.replace(/<scripRef[^>]*>[\s\S]*?<\/scripRef>/g, "");
    const plain = line.replace(/<[^>]+>/g, "").trim();
    if (/^-\s/.test(plain)) {
      current = newNode();
      current.label = cleanLabel(plain.replace(/^-\s*/, ""));
      children.push(current);
      level0 = current;
    } else if (/^\.\s/.test(plain)) {
      current = newNode();
      current.label = cleanLabel(plain.replace(/^\.\s*/, ""));
      (level0 ? level0.children : children).push(current);
    } else {
      const label = cleanLabel(plain);
      if (label) {
        const see = label.match(/^See\s+(.+)$/);
        if (see && !refTags.length) {
          (current ?? level0 ?? (current = newNode(), children.push(current), level0 = current)).see = see[1];
          current.label = current.label ? `${current.label} ${label}` : label;
        } else if (current) {
          current.label = current.label ? `${current.label} ${label}` : label;
        } else {
          current = newNode();
          current.label = label;
          children.push(current);
          level0 = current;
        }
      }
    }
    if (refTags.length && !current) {
      current = newNode();
      children.push(current);
      level0 = current;
    }
    for (const rt of refTags) {
      for (const ref of await mapTorreyRefs(st, rt[1])) {
        const key = `${ref.slug}:${ref.chapter}:${ref.verse}:${ref.verseEnd ?? ""}`;
        if (!current.refs.some((r) => `${r.slug}:${r.chapter}:${r.verse}:${r.verseEnd ?? ""}` === key)) {
          current.refs.push(ref);
          st.refsMapped++;
        }
      }
    }
  }
  return { title, children };
}

async function buildTorreys() {
  const st = workStats("torreys");
  const entries = await readTorreyEntries();
  const topics = new Map();
  for (const entry of entries) {
    const { title, children } = await parseTorreyEntry(st, entry);
    if (!title) { unmapped(st, entry.slice(0, 60), "entry without title"); continue; }
    const id = slugify(title);
    if (topics.has(id)) {
      topics.get(id).children.push(...children);
      continue;
    }
    topics.set(id, { id, title: title.toLowerCase(), children });
    st.topics++;
  }
  return [...topics.values()];
}

/* --------------------------------- output --------------------------------- */

function countRefs(nodes) {
  let n = 0;
  for (const node of nodes) n += node.refs.length + countRefs(node.children);
  return n;
}

const naves = await buildNaves();
const torreys = await buildTorreys();

await fs.mkdir(path.join(OUT, "verses"), { recursive: true });

const works = [
  ["naves", "Nave's Topical Bible", naves],
  ["torreys", "Torrey's New Topical Textbook", torreys],
];

/** Reverse index: "chapter:verse" -> ["work:topicId"], per KJV book file.
 *  Ranges expand to every covered verse, capped so one huge range cannot
 *  flood a whole chapter's map. */
const verseMaps = new Map();
const RANGE_CAP = 60;
for (const [work, , topics] of works) {
  const walk = (topicId, nodes) => {
    for (const node of nodes) {
      for (const ref of node.refs) {
        if (ref.verse === null) continue;
        const file = FILE_BY_SLUG[ref.slug];
        if (!verseMaps.has(file)) verseMaps.set(file, {});
        const map = verseMaps.get(file);
        const end = ref.verseEnd && ref.verseEnd - ref.verse < RANGE_CAP ? ref.verseEnd : ref.verse;
        for (let v = ref.verse; v <= end; v++) {
          const key = `${ref.chapter}:${v}`;
          if (!map[key]) map[key] = [];
          const tag = `${work}:${topicId}`;
          if (!map[key].includes(tag)) map[key].push(tag);
        }
      }
      walk(topicId, node.children);
    }
  };
  for (const t of topics) walk(t.id, t.children);
}

for (const [work, title, topics] of works) {
  const refs = topics.reduce((n, t) => n + countRefs(t.children), 0);
  await fs.writeFile(
    path.join(OUT, `${work}.json`),
    JSON.stringify({ generated: new Date().toISOString().slice(0, 10), work, title, topics })
  );
  console.log(`${work}: ${topics.length} topics, ${refs} references kept`);
}
for (const [file, map] of verseMaps) {
  await fs.writeFile(path.join(OUT, "verses", `${file}.json`), JSON.stringify(map));
}

for (const [work, st] of Object.entries(stats)) {
  console.log(
    `${work}: mapped ${st.refsMapped}, unmapped ${st.refsUnmapped}` +
      (st.crossChapterRanges ? `, ${st.crossChapterRanges} cross-chapter ranges dropped` : "")
  );
  if (st.unmappedSamples.size) {
    console.log(`  samples: ${[...st.unmappedSamples.keys()].join(" | ")}`);
  }
}
console.log(`Reverse index books: ${verseMaps.size}`);
