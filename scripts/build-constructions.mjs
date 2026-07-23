#!/usr/bin/env node
/**
 * Extract clause-level grammatical constructions from the MACULA lowfat
 * syntax trees into per-book, per-verse tables behind the Exegetical Guide's
 * Constructions section.
 *
 * Sources (both CC BY 4.0, Clear Bible / Biblica; see
 * data/_sources/macula-greek/PROVENANCE.md and
 * data/_sources/macula-hebrew/PROVENANCE.md):
 * - macula-greek Nestle1904/lowfat/*.xml: Clear Bible syntax trees over the
 *   Nestle 1904 text (public domain). Clause-level functions per the MACULA
 *   Greek Treebank documentation: ADV, IO, O, O2, P, S, V, VC.
 * - macula-hebrew WLC/lowfat/*.xml: Clear Bible syntax trees combining the
 *   Groves Center Westminster trees (CC BY 4.0) with OpenScriptures
 *   morphology (CC BY 4.0). Clause-level functions per the MACULA Hebrew
 *   Treebank documentation: ADV, O, O2, OC, P, S, V, PP.
 *
 * The MARBLE word-sense attributes the same files carry (@domain, @ln,
 * @sdbh, @lexdomain) are third-party data "used with permission" and are NOT
 * read here; only the tree structure (clause rules and constituent roles)
 * and the surface text are extracted. Berean's semantic domains ship from
 * the UBS open-license dictionaries instead (scripts/build-domains.mjs).
 *
 * Output: data/constructions/<Book>.json per furnished book, matching the
 * canon file names and the TAHOT/TAGNT per-book convention:
 *
 *   { book, chapters: [{ chapter, verses: [{ verse, clauses: [
 *       { rule, parts: [{ role, label, class, text }] }] }] }] }
 *
 * A clause record is one <wg class="cl"> that carries at least one direct
 * constituent with a role; each part is one such constituent, its text the
 * constituent's surface words. Subordinate clauses emit their own records
 * where they begin, so a verse lists every construction starting in it.
 *
 * Versification: the Hebrew trees follow Hebrew verse numbering while the
 * shipped TAHOT follows English numbering with `alt` recording the Hebrew
 * reference, so Hebrew refs map through the TAHOT alt table (WLC GEN 32:1 is
 * English Genesis 31:55). Greek refs map against TAGNT the same way. Refs
 * with no counterpart are counted and sampled in _meta.json.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GREEK_DIR = path.join(ROOT, "data", "_sources", "macula-greek", "lowfat");
const HEBREW_DIR = path.join(ROOT, "data", "_sources", "macula-hebrew", "lowfat");
const OUT_DIR = path.join(ROOT, "data", "constructions");

/** Clause-level function labels, from the two MACULA treebank manuals. */
const GREEK_ROLES = {
  s: "Subject",
  v: "Verb",
  vc: "Copula",
  o: "Object",
  o2: "Second object",
  io: "Indirect object",
  p: "Predicate",
  adv: "Adverbial",
  // aux is used in the trees for appositions, vocative and interjective
  // phrases, and other attachments outside the clause core; the treebank
  // manual does not document it. Labeled plainly and noted here.
  aux: "Auxiliary",
};
const HEBREW_ROLES = {
  s: "Subject",
  v: "Verb",
  o: "Object",
  o2: "Second object",
  oc: "Object complement",
  p: "Predicate",
  adv: "Adverbial",
  pp: "Prepositional phrase",
};

const GREEK_BOOKS = {
  "01-matthew": "Matthew", "02-mark": "Mark", "03-luke": "Luke", "04-john": "John",
  "05-acts": "Acts", "06-romans": "Romans", "07-1corinthians": "1Corinthians",
  "08-2corinthians": "2Corinthians", "09-galatians": "Galatians", "10-ephesians": "Ephesians",
  "11-philippians": "Philippians", "12-colossians": "Colossians",
  "13-1thessalonians": "1Thessalonians", "14-2thessalonians": "2Thessalonians",
  "15-1timothy": "1Timothy", "16-2timothy": "2Timothy", "17-titus": "Titus",
  "18-philemon": "Philemon", "19-hebrews": "Hebrews", "20-james": "James",
  "21-1peter": "1Peter", "22-2peter": "2Peter", "23-1john": "1John", "24-2john": "2John",
  "25-3john": "3John", "26-jude": "Jude", "27-revelation": "Revelation",
};

const HEBREW_BOOKS = {
  Gen: "Genesis", Exo: "Exodus", Lev: "Leviticus", Num: "Numbers", Deu: "Deuteronomy",
  Jos: "Joshua", Jdg: "Judges", Rut: "Ruth", "1Sa": "1Samuel", "2Sa": "2Samuel",
  "1Ki": "1Kings", "2Ki": "2Kings", "1Ch": "1Chronicles", "2Ch": "2Chronicles",
  Ezr: "Ezra", Neh: "Nehemiah", Est: "Esther", Job: "Job", Psa: "Psalms", Pro: "Proverbs",
  Ecc: "Ecclesiastes", Sng: "SongofSolomon", Isa: "Isaiah", Jer: "Jeremiah",
  Lam: "Lamentations", Ezk: "Ezekiel", Dan: "Daniel", HOS: "Hosea", Jol: "Joel",
  Amo: "Amos", Oba: "Obadiah", Jon: "Jonah", Mic: "Micah", Nam: "Nahum", Hab: "Habakkuk",
  Zep: "Zephaniah", Hag: "Haggai", Zec: "Zechariah", Mal: "Malachi",
};

const ATTR_RE = /([\w:]+)="([^"]*)"/g;
const TOKEN_RE = /<wg\b[^>]*>|<\/wg>|<w\b[^>]*>[^<]*<\/w>|<w\b[^>]*\/>/g;

function parseAttrs(tag) {
  const attrs = {};
  ATTR_RE.lastIndex = 0;
  for (const m of tag.matchAll(ATTR_RE)) attrs[m[1]] = m[2];
  return attrs;
}

/** "JHN 1:1!3" -> { chapter: 1, verse: 1 }; null when unparseable. */
function parseRef(ref) {
  const m = String(ref ?? "").match(/^\S+\s+(\d+):(\d+)(?:!|$)/);
  return m ? { chapter: Number(m[1]), verse: Number(m[2]) } : null;
}

/** Word separator from the source's `after` attribute. */
function separator(after) {
  // Absent means the next token is another morpheme of the same orthographic
  // word (the Hebrew trees split prefixes and suffixes into their own <w>).
  if (after == null) return "";
  return after.trim() === "" ? " " : `${after} `;
}

/**
 * Build the reference map from a shipped TAHOT/TAGNT book: source reference
 * "chapter.verse" to the shipped English-numbered { chapter, verse }.
 *
 * The two apparatuses number their sources differently, so the mode picks
 * the key space. TAHOT verses are English-numbered with `alt` recording the
 * Hebrew reference where the traditions diverge, and the MACULA Hebrew refs
 * are Hebrew-numbered, so each verse contributes exactly one key: its `alt`
 * when present, else its own number (Gen 31:55 answers the WLC's 32.1, and
 * the plain key 32.1 stays free to mean Hebrew 32:1). TAGNT verses are
 * NA-numbered like the N1904 refs, with `alt` recording KJV numbering, so
 * the Greek map keys on the verse's own number with `alt` as a fallback.
 */
function buildRefMap(dir, bookFile, mode) {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", dir, `${bookFile}.json`), "utf8")
  );
  const map = new Map();
  for (const ch of raw.chapters) {
    const chapter = Number(ch.chapter);
    for (const v of ch.verses) {
      const verse = Number(v.verse);
      const own = `${chapter}.${verse}`;
      const alt = v.alt ? String(v.alt).replace(":", ".") : null;
      if (mode === "alt-first") {
        map.set(alt ?? own, { chapter, verse });
      } else {
        map.set(own, { chapter, verse });
        if (alt && !map.has(alt)) map.set(alt, { chapter, verse });
      }
    }
  }
  return map;
}

/**
 * Parse one lowfat document. Returns { clauses: Map("c.v" -> records[]),
 * roles: Set, words: number, unparseableRefs: number }.
 *
 * The stack holds one entry per open <wg>: { clause?, part? }. An entry
 * carries a clause record when the group is class="cl", and a part when the
 * group bears a role inside an enclosing clause (the part is registered in
 * the parent's parts before the entry opens). Every word's text accumulates
 * into every open part on the stack, so a constituent that is itself a
 * clause reports its full span, and a clause's verse is the verse of its
 * first word.
 */
function parseLowfat(xml, roleLabels) {
  const clauses = new Map();
  const roles = new Set();
  let words = 0;
  let unparseableRefs = 0;
  const stack = [];
  let errorRoles = 0;

  const innermostClause = () => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].clause) return stack[i].clause;
    }
    return null;
  };

  TOKEN_RE.lastIndex = 0;
  for (const m of xml.matchAll(TOKEN_RE)) {
    const tok = m[0];
    if (tok.startsWith("</")) {
      const top = stack.pop();
      const rec = top?.clause;
      if (rec && rec.verseKey && rec.parts.length > 0) {
        if (!clauses.has(rec.verseKey)) clauses.set(rec.verseKey, []);
        clauses.get(rec.verseKey).push({ rule: rec.rule, parts: rec.parts });
      }
      continue;
    }
    if (tok.startsWith("<w") && !tok.startsWith("<wg")) {
      const selfClosing = tok.endsWith("/>");
      const openTag = selfClosing ? tok : tok.slice(0, tok.indexOf(">") + 1);
      const attrs = parseAttrs(openTag);
      const text = selfClosing ? "" : tok.slice(tok.indexOf(">") + 1, tok.lastIndexOf("</")).trim();
      words++;
      const ref = parseRef(attrs.ref);
      if (!ref) unparseableRefs++;
      const surface = text || (attrs.unicode ?? "").replace(/[,.;:!?·]+$/, "");
      const piece = surface + separator(attrs.after);
      for (const entry of stack) {
        if (entry.part) entry.part.text += piece;
        if (entry.clause && !entry.clause.verseKey && ref) {
          entry.clause.verseKey = `${ref.chapter}.${ref.verse}`;
        }
      }
      const clause = innermostClause();
      if (clause && attrs.role) {
        // err_* values are the source's own annotation-error markers, not
        // grammatical functions; the constituent is skipped and counted.
        if (attrs.role.startsWith("err")) {
          errorRoles++;
        } else {
          const role = String(attrs.role).toLowerCase();
          roles.add(role);
          clause.parts.push({
            role,
            label: roleLabels[role] ?? role,
            class: attrs.class ?? "",
            text: surface,
          });
        }
      }
      continue;
    }
    // <wg ...>: one stack entry; the part, when the group bears a role,
    // registers in the enclosing clause before the entry opens.
    const attrs = parseAttrs(tok);
    const cls = attrs.class ?? "";
    const entry = {};
    if (cls === "cl") entry.clause = { rule: attrs.rule ?? "", verseKey: null, parts: [] };
    if (attrs.role) {
      if (attrs.role.startsWith("err")) {
        errorRoles++;
      } else {
        const parent = innermostClause();
        if (parent) {
          const role = String(attrs.role).toLowerCase();
          roles.add(role);
          entry.part = { role, label: roleLabels[role] ?? role, class: cls || "group", text: "" };
          parent.parts.push(entry.part);
        }
      }
    }
    stack.push(entry);
  }
  return { clauses, roles, words, unparseableRefs, errorRoles };
}

function emitBook(bookFile, chapterClauses, stats) {
  // chapterClauses: Map(chapter -> Map(verse -> records[]))
  const chapters = [...chapterClauses.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([chapter, verseMap]) => ({
      chapter: String(chapter),
      verses: [...verseMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([verse, clauses]) => ({ verse: String(verse), clauses })),
    }))
    .filter((c) => c.verses.length > 0);
  if (chapters.length === 0) return;
  fs.writeFileSync(
    path.join(OUT_DIR, `${bookFile}.json`),
    JSON.stringify({ book: bookFile, chapters })
  );
  stats.books++;
  stats.chapters += chapters.length;
}

function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stats = {
    books: 0, chapters: 0,
    greek: { words: 0, clauses: 0, unmappedRefs: 0, unparseableRefs: 0, errorRoles: 0, unmappedSamples: new Set() },
    hebrew: { words: 0, clauses: 0, unmappedRefs: 0, unparseableRefs: 0, errorRoles: 0, unmappedSamples: new Set() },
    roles: { greek: new Set(), hebrew: new Set() },
  };

  const emitClauses = (lang, bookFile, refMap, parsed) => {
    const side = stats[lang];
    const chapterClauses = new Map();
    for (const [key, records] of parsed.clauses) {
      const mapped = refMap.get(key);
      if (!mapped) {
        side.unmappedRefs += records.length;
        if (side.unmappedSamples.size < 25) side.unmappedSamples.add(`${bookFile} ${key}`);
        continue;
      }
      side.clauses += records.length;
      if (!chapterClauses.has(mapped.chapter)) chapterClauses.set(mapped.chapter, new Map());
      const verseMap = chapterClauses.get(mapped.chapter);
      if (!verseMap.has(mapped.verse)) verseMap.set(mapped.verse, []);
      verseMap.get(mapped.verse).push(...records);
    }
    // Collapse whitespace artifacts once, at the boundary.
    for (const verseMap of chapterClauses.values()) {
      for (const records of verseMap.values()) {
        for (const rec of records) {
          for (const part of rec.parts) part.text = part.text.replace(/\s+/g, " ").trim();
        }
      }
    }
    emitBook(bookFile, chapterClauses, stats);
  };

  // Greek: one file per book.
  for (const [prefix, bookFile] of Object.entries(GREEK_BOOKS)) {
    const file = path.join(GREEK_DIR, `${prefix}.xml`);
    const xml = fs.readFileSync(file, "utf8");
    const parsed = parseLowfat(xml, GREEK_ROLES);
    for (const r of parsed.roles) stats.roles.greek.add(r);
    stats.greek.words += parsed.words;
    stats.greek.unparseableRefs += parsed.unparseableRefs;
    stats.greek.errorRoles += parsed.errorRoles;
    const refMap = buildRefMap("tagnt", bookFile, "own");
    emitClauses("greek", bookFile, refMap, parsed);
  }

  // Hebrew: one file per chapter.
  const hebrewBooks = new Map(); // bookFile -> { chapter -> parsed clauses map }
  const files = fs.readdirSync(HEBREW_DIR).filter((f) => f.endsWith("-lowfat.xml"));
  for (const file of files) {
    const m = file.match(/^\d+-(\w+)-(\d+)-lowfat\.xml$/);
    if (!m) continue;
    const bookFile = HEBREW_BOOKS[m[1]];
    if (!bookFile) throw new Error(`Unknown Hebrew book code: ${m[1]} (${file})`);
    const chapter = Number(m[2]);
    const xml = fs.readFileSync(path.join(HEBREW_DIR, file), "utf8");
    const parsed = parseLowfat(xml, HEBREW_ROLES);
    for (const r of parsed.roles) stats.roles.hebrew.add(r);
    stats.hebrew.words += parsed.words;
    stats.hebrew.unparseableRefs += parsed.unparseableRefs;
    stats.hebrew.errorRoles += parsed.errorRoles;
    if (!hebrewBooks.has(bookFile)) hebrewBooks.set(bookFile, []);
    hebrewBooks.get(bookFile).push({ chapter, parsed });
  }
  for (const [bookFile, chapters] of hebrewBooks) {
    const refMap = buildRefMap("tahot", bookFile, "alt-first");
    // Merge the book's chapter parses into one clause map, then map refs.
    const merged = { clauses: new Map() };
    for (const { parsed } of chapters) {
      for (const [key, records] of parsed.clauses) {
        if (!merged.clauses.has(key)) merged.clauses.set(key, []);
        merged.clauses.get(key).push(...records);
      }
    }
    emitClauses("hebrew", bookFile, refMap, merged);
  }

  // Role inventories must match the documented sets exactly; a new role
  // fails the build rather than shipping an unlabeled function.
  const roleCheck = (found, expected, lang) => {
    const extra = [...found].filter((r) => !(r in expected));
    if (extra.length > 0) {
      throw new Error(`Unmapped ${lang} clause roles: ${extra.join(", ")}`);
    }
  };
  roleCheck(stats.roles.greek, GREEK_ROLES, "Greek");
  roleCheck(stats.roles.hebrew, HEBREW_ROLES, "Hebrew");

  // Integrity assertions on known passages.
  const checks = [];
  const check = (label, ok, detail) => {
    checks.push({ label, ok, detail });
    if (!ok) throw new Error(`Integrity check failed: ${label} (${detail})`);
  };
  const load = (bookFile) =>
    JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${bookFile}.json`), "utf8"));
  const at = (book, chapter, verse) =>
    load(book).chapters
      .find((c) => Number(c.chapter) === chapter)
      ?.verses.find((v) => Number(v.verse) === verse)?.clauses ?? [];

  const john11 = at("John", 1, 1);
  check(
    "John 1:1 carries the P-VC-S copula clause",
    john11.some(
      (c) =>
        c.rule === "P-VC-S" &&
        c.parts.some((p) => p.role === "p") &&
        c.parts.some((p) => p.role === "vc") &&
        c.parts.some((p) => p.role === "s" && p.text.includes("Λόγος"))
    ),
    JSON.stringify(john11).slice(0, 300)
  );
  const gen11 = at("Genesis", 1, 1);
  const bare = (s) => s.normalize("NFD").replace(/\p{M}/gu, "");
  check(
    "Genesis 1:1 carries the PP-V-S-O clause with elohim as subject",
    gen11.some(
      (c) =>
        c.rule === "PP-V-S-O" &&
        ["pp", "v", "s", "o"].every((r) => c.parts.some((p) => p.role === r)) &&
        c.parts.some((p) => p.role === "s" && bare(p.text).includes("אלהים"))
    ),
    JSON.stringify(gen11).slice(0, 300)
  );
  const psa31 = at("Psalms", 3, 1);
  check(
    "Psalm 3:1 (Hebrew 3:2) lands through the versification map",
    psa31.length > 0,
    JSON.stringify(psa31).slice(0, 200)
  );
  const gen3155 = at("Genesis", 31, 55);
  check(
    "Genesis 31:55 (Hebrew 32:1) lands through the versification map",
    gen3155.length > 0,
    JSON.stringify(gen3155).slice(0, 200)
  );
  check(
    "Greek unmapped refs stay below 0.1% of clauses",
    stats.greek.unmappedRefs / Math.max(1, stats.greek.clauses) < 0.001,
    `unmapped=${stats.greek.unmappedRefs} clauses=${stats.greek.clauses}`
  );
  check(
    "Hebrew unmapped refs stay below 0.1% of clauses",
    stats.hebrew.unmappedRefs / Math.max(1, stats.hebrew.clauses) < 0.001,
    `unmapped=${stats.hebrew.unmappedRefs} clauses=${stats.hebrew.clauses}`
  );
  check("All 27 Greek books ship", fs.existsSync(path.join(OUT_DIR, "Revelation.json")), "Revelation.json");
  check("All 39 Hebrew books ship", stats.books === 66, `books=${stats.books}`);

  fs.writeFileSync(
    path.join(OUT_DIR, "_meta.json"),
    JSON.stringify(
      {
        id: "constructions",
        title: "Clause-level grammatical constructions (MACULA lowfat syntax trees)",
        attribution:
          "MACULA Greek Linguistic Datasets (https://github.com/Clear-Bible/macula-greek/) and MACULA Hebrew Linguistic Datasets (https://github.com/Clear-Bible/macula-hebrew/), both CC BY 4.0.",
        retrieved: "2026-07-23",
        builtBy: "scripts/build-constructions.mjs",
        books: stats.books,
        chapters: stats.chapters,
        greek: {
          words: stats.greek.words,
          clauses: stats.greek.clauses,
          unmappedRefs: stats.greek.unmappedRefs,
          unparseableRefs: stats.greek.unparseableRefs,
          errorRolesSkipped: stats.greek.errorRoles,
          roles: [...stats.roles.greek].sort(),
          unmappedSamples: [...stats.greek.unmappedSamples],
        },
        hebrew: {
          words: stats.hebrew.words,
          clauses: stats.hebrew.clauses,
          unmappedRefs: stats.hebrew.unmappedRefs,
          unparseableRefs: stats.hebrew.unparseableRefs,
          errorRolesSkipped: stats.hebrew.errorRoles,
          roles: [...stats.roles.hebrew].sort(),
          unmappedSamples: [...stats.hebrew.unmappedSamples],
        },
        checks,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`Greek: ${stats.greek.words} words, ${stats.greek.clauses} clauses; unmapped refs ${stats.greek.unmappedRefs}, unparseable ${stats.greek.unparseableRefs}`);
  console.log(`  roles seen: ${[...stats.roles.greek].sort().join(", ")}`);
  console.log(`Hebrew: ${stats.hebrew.words} words, ${stats.hebrew.clauses} clauses; unmapped refs ${stats.hebrew.unmappedRefs}, unparseable ${stats.hebrew.unparseableRefs}`);
  console.log(`  roles seen: ${[...stats.roles.hebrew].sort().join(", ")}`);
  console.log(`Wrote ${stats.books} book files and _meta.json under ${path.relative(ROOT, OUT_DIR)}`);
}

run();
