/**
 * Build the people/places knowledge layer from STEPBible's TIPNR dataset.
 *
 * Input:  data/_sources/stepbible/TIPNR.txt (CC BY 4.0, see PROVENANCE.md)
 * Output: data/entities/index.json          — every entity, for the Library
 *                                             index and search
 *         data/entities/detail/<L>.json     — full records sharded by the
 *                                             entity name's first letter
 *         data/entities/verses/<Book>.json  — "chapter:verse" -> entity ids,
 *                                             per KJV book file, for the
 *                                             reader apparatus
 *
 * References are mapped to the canonical slugs in src/lib/canon.ts. Verses
 * that cannot be mapped (LXX-only refs, unknown book abbreviations, chapters
 * beyond the canon) are skipped and counted, never silently dropped.
 */
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "data", "_sources", "stepbible", "TIPNR.txt");
const OUT = path.join(ROOT, "data", "entities");

/** STEPBible book abbreviation -> [canonical slug, chapter count]. */
const BOOKS = {
  Gen: ["genesis", 50], Exo: ["exodus", 40], Lev: ["leviticus", 27],
  Num: ["numbers", 36], Deu: ["deuteronomy", 34], Jos: ["joshua", 24],
  Jdg: ["judges", 21], Rut: ["ruth", 4], Rth: ["ruth", 4],
  "1Sa": ["1-samuel", 31], "2Sa": ["2-samuel", 24],
  "1Ki": ["1-kings", 22], "2Ki": ["2-kings", 25],
  "1Ch": ["1-chronicles", 29], "2Ch": ["2-chronicles", 36],
  Ezr: ["ezra", 10], Neh: ["nehemiah", 13], Est: ["esther", 10],
  Job: ["job", 42], Psa: ["psalms", 150], Pro: ["proverbs", 31],
  Ecc: ["ecclesiastes", 12], Sng: ["song-of-solomon", 8],
  Isa: ["isaiah", 66], Jer: ["jeremiah", 52], Lam: ["lamentations", 5],
  Ezk: ["ezekiel", 48], Dan: ["daniel", 12], Hos: ["hosea", 14],
  Jol: ["joel", 3], Joe: ["joel", 3], Amo: ["amos", 9], Oba: ["obadiah", 1],
  Jon: ["jonah", 4], Mic: ["micah", 7], Nah: ["nahum", 3], Nam: ["nahum", 3],
  Hab: ["habakkuk", 3], Zep: ["zephaniah", 3], Hag: ["haggai", 2],
  Zec: ["zechariah", 14], Mal: ["malachi", 4],
  Mat: ["matthew", 28], Mrk: ["mark", 16], Mar: ["mark", 16],
  Luk: ["luke", 24], Jhn: ["john", 21], Joh: ["john", 21],
  Act: ["acts", 28], Rom: ["romans", 16],
  "1Co": ["1-corinthians", 16], "2Co": ["2-corinthians", 13],
  Gal: ["galatians", 6], Eph: ["ephesians", 6], Php: ["philippians", 4],
  Col: ["colossians", 4], "1Th": ["1-thessalonians", 5],
  "2Th": ["2-thessalonians", 3], "1Ti": ["1-timothy", 6],
  "2Ti": ["2-timothy", 4], Tit: ["titus", 3], Phm: ["philemon", 1],
  Heb: ["hebrews", 13], Jas: ["james", 5], Jam: ["james", 5],
  "1Pe": ["1-peter", 5], "2Pe": ["2-peter", 3],
  "1Jn": ["1-john", 5], "2Jn": ["2-john", 1], "3Jn": ["3-john", 1],
  Jud: ["jude", 1], Rev: ["revelation", 22],
};

/** KJV data file basename per slug, matching data/kjv. */
const FILE_BY_SLUG = {};
for (const [slug] of Object.values(BOOKS)) {
  FILE_BY_SLUG[slug] = slug
    .split("-")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");
}
FILE_BY_SLUG["song-of-solomon"] = "SongofSolomon";

const stats = {
  persons: 0,
  places: 0,
  others: 0,
  refsMapped: 0,
  refsSkippedLXX: 0,
  refsSkippedUnknown: 0,
  refsSkippedChapter: 0,
  unknownBooks: new Map(),
  relationsResolved: 0,
  relationsUnresolved: 0,
};

/** Strip TIPNR summary markup, keeping the inner text. */
function cleanMarkup(s) {
  return s
    .replace(/<ref="[^"]*">([^<]*)<\/ref>\)?/g, "$1")
    .replace(/<strong="[^"]*">([^<]*)<\/strong>/g, "$1")
    .replace(/<BR>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Normalize a TIPNR unique-name token to its lookup key. */
function relKey(token) {
  return token
    .replace(/\((?:d|a|f|\?)\)/g, "")
    .replace(/=.*$/, "")
    .trim();
}

/** Display name from a unique-name token: "Abram|Abraham@Gen.11.26-1Pe" -> "Abraham". */
function relName(token) {
  const noRef = relKey(token).replace(/@.*$/, "");
  const parts = noRef.split("|");
  return parts[parts.length - 1] || noRef;
}

/** Parse one semicolon-separated reference, e.g. "Exo.7.10a" or "1Ch.6.74(?)". */
function parseRef(raw) {
  let t = raw.trim();
  if (!t) return null;
  if (/^LXX\b/i.test(t)) {
    stats.refsSkippedLXX++;
    return null;
  }
  const m = t.match(/^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)[a-z]?(?:-[0-9]+)?(?:\(\?\))?$/);
  if (!m) {
    stats.refsSkippedUnknown++;
    return null;
  }
  const book = BOOKS[m[1]];
  if (!book) {
    stats.refsSkippedUnknown++;
    stats.unknownBooks.set(m[1], (stats.unknownBooks.get(m[1]) ?? 0) + 1);
    return null;
  }
  const [slug, chapters] = book;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > chapters) {
    stats.refsSkippedChapter++;
    return null;
  }
  return { slug, chapter, verse: Number(m[3]) };
}

const raw = await fs.readFile(SOURCE, "utf8");
const lines = raw.split(/\r?\n/);

/** Split into records: a "$==========" line opens a record, the header line
 * follows. Template/documentation records (whose next line starts with
 * "UniqueName" or lacks "@") are ignored. */
const records = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^\$=+\s*(PERSON|PLACE|OTHER)/);
  if (!m) continue;
  const header = lines[i + 1] ?? "";
  if (!header.includes("@") || !header.includes("=")) continue;
  const body = [];
  for (let j = i + 2; j < lines.length && !lines[j].startsWith("$="); j++) {
    body.push(lines[j]);
  }
  records.push({ section: m[1], header, body });
}

/** First pass: parse every record, collecting refs and relations as raw
 * tokens; build the unique-name -> entity id lookup. */
const entities = [];
const lookup = new Map();

for (const rec of records) {
  const f = rec.header.split("\t");
  const [uniqueName, uStrong] = f[0].split("=");
  if (!uniqueName || !uStrong) continue;
  const kind =
    rec.section === "PERSON" ? "person" : rec.section === "PLACE" ? "place" : "other";
  const atIdx = uniqueName.indexOf("@");
  const name = (atIdx === -1 ? uniqueName : uniqueName.slice(0, atIdx)).replace(/_/g, " ");
  const tag = atIdx === -1 ? "" : uniqueName.slice(atIdx + 1);

  const entity = {
    id: uStrong.trim(),
    name,
    kind,
    type: (f[8] ?? "").trim(),
    tag,
    description: "",
    brief: "",
    short: "",
    article: "",
    aliases: new Set(),
    relations: { parents: [], siblings: [], partners: [], offspring: [] },
    tribe: "",
    area: "",
    geo: null,
    refs: [],
    _relTokens: null,
  };

  if (kind === "person") {
    entity.description = (f[1] ?? "").trim();
    entity.tribe = (f[6] ?? "").trim();
    entity._relTokens = {
      parents: (f[2] ?? "").split("+").map((s) => s.trim()).filter(Boolean),
      siblings: (f[3] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      partners: (f[4] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      offspring: (f[5] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    };
  } else if (kind === "place") {
    const gm = (f[4] ?? "").match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (gm && (Number(gm[1]) !== 0 || Number(gm[2]) !== 0)) {
      entity.geo = { lat: Number(gm[1]), lng: Number(gm[2]) };
    }
    const area = (f[6] ?? "").trim();
    if (area && area !== ">") entity.area = area;
  } else {
    entity.description = (f[1] ?? "").trim();
  }

  const seenRefs = new Set();
  for (const line of rec.body) {
    if (line.startsWith("– ") && !line.startsWith("– Total")) {
      const sf = line.split("\t");
      const subUnique = (sf[1] ?? "").trim();
      if (subUnique) {
        for (const part of relKey(subUnique).replace(/@.*$/, "").split("|")) {
          const alias = part.trim().replace(/_/g, " ");
          if (alias && alias !== name) entity.aliases.add(alias);
        }
        if (!lookup.has(relKey(subUnique))) lookup.set(relKey(subUnique), entity.id);
      }
      for (const piece of (sf[5] ?? "").split(";")) {
        const ref = parseRef(piece);
        if (!ref) continue;
        const key = `${ref.slug}:${ref.chapter}:${ref.verse}`;
        if (seenRefs.has(key)) continue;
        seenRefs.add(key);
        entity.refs.push(ref);
      }
    } else if (line.startsWith("@Briefest=")) {
      // Briefest is folded into brief when brief is empty.
      if (!entity.brief) entity.brief = line.slice("@Briefest=".length).trim();
    } else if (line.startsWith("@Brief=")) {
      const v = line.slice("@Brief=".length).trim();
      if (v) entity.brief = v;
    } else if (line.startsWith("@Short=")) {
      entity.short = cleanMarkup(line.slice("@Short=".length).split("& @Article=")[0]);
    } else if (line.startsWith("@Article=")) {
      entity.article = cleanMarkup(line.slice("@Article=".length));
    }
  }

  if (!lookup.has(relKey(uniqueName))) lookup.set(relKey(uniqueName), entity.id);
  entities.push(entity);
  if (kind === "person") stats.persons++;
  else if (kind === "place") stats.places++;
  else stats.others++;
  stats.refsMapped += entity.refs.length;
}

/** Second pass: resolve relationship tokens to entity ids. */
for (const e of entities) {
  if (!e._relTokens) continue;
  for (const [key, tokens] of Object.entries(e._relTokens)) {
    e.relations[key] = tokens.map((token) => {
      const id = lookup.get(relKey(token));
      if (id) stats.relationsResolved++;
      else stats.relationsUnresolved++;
      return { name: relName(token), id: id ?? null };
    });
  }
  delete e._relTokens;
}

/** Sort each entity's references into canon order. */
const slugOrder = new Map(
  Object.values(BOOKS).map(([slug], i) => [slug, i])
);
const canonOrder = [
  "genesis","exodus","leviticus","numbers","deuteronomy","joshua","judges",
  "ruth","1-samuel","2-samuel","1-kings","2-kings","1-chronicles",
  "2-chronicles","ezra","nehemiah","esther","job","psalms","proverbs",
  "ecclesiastes","song-of-solomon","isaiah","jeremiah","lamentations",
  "ezekiel","daniel","hosea","joel","amos","obadiah","jonah","micah",
  "nahum","habakkuk","zephaniah","haggai","zechariah","malachi","matthew",
  "mark","luke","john","acts","romans","1-corinthians","2-corinthians",
  "galatians","ephesians","philippians","colossians","1-thessalonians",
  "2-thessalonians","1-timothy","2-timothy","titus","philemon","hebrews",
  "james","1-peter","2-peter","1-john","2-john","3-john","jude","revelation",
];
const order = new Map(canonOrder.map((s, i) => [s, i]));
for (const e of entities) {
  e.refs.sort(
    (a, b) =>
      order.get(a.slug) - order.get(b.slug) ||
      a.chapter - b.chapter ||
      a.verse - b.verse
  );
  e.aliases = [...e.aliases].sort();
}

/** Write outputs. */
await fs.mkdir(path.join(OUT, "detail"), { recursive: true });
await fs.mkdir(path.join(OUT, "verses"), { recursive: true });

const index = entities.map((e) => ({
  id: e.id,
  name: e.name,
  kind: e.kind,
  type: e.type,
  tag: e.tag,
  brief: e.brief,
  aliases: e.aliases,
  refs: e.refs.length,
}));
await fs.writeFile(
  path.join(OUT, "index.json"),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), entities: index })
);

const shards = new Map();
for (const e of entities) {
  const first = (e.name[0] ?? "_").toUpperCase();
  const letter = /[A-Z]/.test(first) ? first : "_";
  if (!shards.has(letter)) shards.set(letter, {});
  shards.get(letter)[e.id] = e;
}
for (const [letter, shard] of shards) {
  await fs.writeFile(path.join(OUT, "detail", `${letter}.json`), JSON.stringify(shard));
}

const verseMaps = new Map();
for (const e of entities) {
  for (const ref of e.refs) {
    const file = FILE_BY_SLUG[ref.slug];
    if (!verseMaps.has(file)) verseMaps.set(file, {});
    const book = verseMaps.get(file);
    const key = `${ref.chapter}:${ref.verse}`;
    if (!book[key]) book[key] = [];
    if (!book[key].includes(e.id)) book[key].push(e.id);
  }
}
for (const [file, map] of verseMaps) {
  await fs.writeFile(path.join(OUT, "verses", `${file}.json`), JSON.stringify(map));
}

console.log(`Entities: ${entities.length} (${stats.persons} persons, ${stats.places} places, ${stats.others} other)`);
console.log(`References mapped: ${stats.refsMapped}`);
console.log(`References skipped: ${stats.refsSkippedLXX} LXX-only, ${stats.refsSkippedUnknown} unparsable/unknown book, ${stats.refsSkippedChapter} beyond canon`);
if (stats.unknownBooks.size) {
  console.log("Unknown book abbreviations:", Object.fromEntries(stats.unknownBooks));
}
console.log(`Relations: ${stats.relationsResolved} resolved, ${stats.relationsUnresolved} unresolved`);
console.log(`Detail shards: ${shards.size}; verse books: ${verseMaps.size}`);
