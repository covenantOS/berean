#!/usr/bin/env node
/**
 * Extract the Clear semantic frames and participant referents from the
 * MACULA lowfat files into per-book, per-verse tables behind the Exegetical
 * Guide's Who Does What section and the original-language search's role
 * filter.
 *
 * Sources (both CC BY 4.0, Clear Bible / Biblica; see
 * data/_sources/macula-greek/PROVENANCE.md and
 * data/_sources/macula-hebrew/PROVENANCE.md):
 * - macula-greek Nestle1904/lowfat/*.xml: @frame on verbs, @referent on
 *   pronouns and other mentions. The repository's LICENSE.md names
 *   "Semantic Frames" and "Participant Referents" among the licensed
 *   datasets.
 * - macula-hebrew WLC/lowfat/*.xml: @frame on verbs, @participantref on
 *   pronominal morphemes. Its LICENSE.md names the same two datasets
 *   (as @frame, @subjref, @participantref).
 *
 * What the attributes carry, read from the data itself:
 * - frame is verb-centered: frame="A0:<id> A1:<id>;<id> A2:<id>" lists the
 *   verb's arguments, each role naming one or more participant word ids
 *   (semicolon-separated). Roles seen: A0 agent (the doer), A1 patient (the
 *   one affected), A2 recipient ("to him"), AA causer (Hebrew causative
 *   stems: GEN 2:9 "he made sprout" marks Yahweh causer and the trees
 *   agent), AA2 experiencer (Greek impersonal verbs: "it seems to you").
 *   AA and AA2 are empirical labels in the spirit of the constructions
 *   build's aux note; the treebank manuals do not document the frame roles.
 *   An all-zeros target, an empty target list ("A0:;"), or a target naming
 *   a null node the lowfat word stream drops marks an implied (unexpressed)
 *   argument; the null-node residue is counted apart in _meta.json.
 * - referent / participantref points a mention (usually a pronoun, a Greek
 *   article or adjective, a Hebrew pronominal suffix) at its antecedent
 *   word ids, answering "who is he here". All targets resolve inside the
 *   same book.
 * - subjref (verb to its expressed subject) is NOT taken: it overlaps the
 *   frames' A0 layer, which already names the agent with its role.
 *
 * Output: data/frames/<Book>.json per furnished book, matching the canon
 * file names and the constructions convention:
 *
 *   { book, chapters: [{ chapter, verses: [{
 *       verse,
 *       frames: [{ verb, gloss, strongs, args: [{ role, text, gloss,
 *         strongs, c, v, implied }] }],
 *       referents: [{ word, gloss, strongs, of: [{ text, gloss, strongs,
 *         c, v }] }] }] }] }
 *
 * `strongs` is the padded base id ("G0846", "H0430"); Hebrew prefix and
 * suffix morphemes carry the source's private letter-suffixed numbers
 * (which collide with real Strong's entries, the caveat the LXX
 * equivalents build records), so those ids are dropped and the field is
 * omitted. `c`/`v` appear only when the participant sits in a different
 * verse or chapter than the frame or mention. Verse keys, frames, and
 * referents follow the shipped TAHOT/TAGNT English numbering: Hebrew WLC
 * refs map through the TAHOT alt table, Greek refs against TAGNT, the same
 * rule the constructions build uses.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GREEK_DIR = path.join(ROOT, "data", "_sources", "macula-greek", "lowfat");
const HEBREW_DIR = path.join(ROOT, "data", "_sources", "macula-hebrew", "lowfat");
const OUT_DIR = path.join(ROOT, "data", "frames");

/** Role code -> display role. The build fails on any code outside this set. */
const ROLE_LABELS = {
  a0: "agent",
  a1: "patient",
  a2: "recipient",
  aa: "causer",
  aa2: "experiencer",
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
const WORD_RE = /<w\b[^>]*>[^<]*<\/w>|<w\b[^>]*\/>/g;

function parseAttrs(tag) {
  const attrs = {};
  ATTR_RE.lastIndex = 0;
  for (const m of tag.matchAll(ATTR_RE)) attrs[m[1]] = m[2];
  return attrs;
}

/** "JHN 1:1!3" / "GEN 1:1!2" -> { chapter: 1, verse: 1 }; null when absent. */
function parseRef(ref) {
  const m = String(ref ?? "").match(/^\S+\s+(\d+):(\d+)(?:!|$)/);
  return m ? { chapter: Number(m[1]), verse: Number(m[2]) } : null;
}

/** Trailing punctuation comes off the display text; maqaf stays. */
function cleanText(s) {
  return String(s ?? "").replace(/[,.;:!?·׃]+$/u, "").trim();
}

/** Padded base Strong's id for the search join; null for private numbers. */
function strongsId(raw, letter) {
  const m = String(raw ?? "").match(/^0*(\d+)$/);
  if (!m) return null;
  return `${letter}${m[1].padStart(4, "0")}`;
}

/**
 * Build the reference map from a shipped TAHOT/TAGNT book, the same rule
 * the constructions build uses: TAHOT keys on the Hebrew-numbered `alt`
 * when present (the WLC refs are Hebrew-numbered), TAGNT on the verse's
 * own NA-style number with `alt` as fallback.
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
 * Collect a document's words into the shared book-level index (xml:id ->
 * { ref, text, gloss, strongs }) and return its annotation-carrying
 * tokens. The Hebrew frame targets point across chapter files (GEN 18:2
 * names its agent with a word of chapter 17), so the index is built over
 * the whole book before any frame resolves, the same merge the
 * constructions build does for clauses.
 */
function collectWords(xml, lang, words) {
  WORD_RE.lastIndex = 0;
  const tokens = [];
  for (const m of xml.matchAll(WORD_RE)) {
    const tok = m[0];
    const selfClosing = tok.endsWith("/>");
    const openTag = selfClosing ? tok : tok.slice(0, tok.indexOf(">") + 1);
    const a = parseAttrs(openTag);
    const text = selfClosing
      ? ""
      : cleanText(tok.slice(tok.indexOf(">") + 1, tok.lastIndexOf("</")));
    const entry = {
      ref: parseRef(a.ref),
      text: text || cleanText(a.unicode),
      gloss: (lang === "hebrew" ? a.english ?? a.gloss : a.gloss) ?? "",
      strongs: lang === "hebrew" ? strongsId(a.strongnumberx, "H") : strongsId(a.strong, "G"),
    };
    if (a["xml:id"]) words.set(a["xml:id"], entry);
    tokens.push({ a, entry });
  }
  return tokens;
}

/**
 * Resolve the collected tokens' frames and referents against the book
 * index. Returns Map("c.v" -> { frames, referents }) in the source's own
 * numbering; ref mapping happens at emit. frames[i] = { verb, gloss,
 * strongs, args } with args resolved to { role, text, gloss, strongs, ref }
 * or { role, implied: true }; referents[i] = { word, gloss, strongs,
 * of: [{ text, gloss, strongs, ref }] }. An empty target list ("A0:;") is
 * the source's marker for an unexpressed argument and emits implied, the
 * same reading as the all-zeros target id.
 */
function parseTokens(tokens, words, stats) {
  const annotations = new Map();
  const bucketFor = (ref) => {
    const key = `${ref.chapter}.${ref.verse}`;
    if (!annotations.has(key)) annotations.set(key, { frames: [], referents: [] });
    return annotations.get(key);
  };
  const resolve = (tid) => words.get(tid) ?? words.get(`o${tid}`) ?? null;
  const isNullTarget = (tid) => /^0+$/.test(tid.replace(/^n/, ""));

  for (const { a, entry } of tokens) {
    if (!entry.ref) {
      if (a.frame || a.referent || a.participantref) stats.unparseableRefs++;
      continue;
    }
    // Semantic frames: one record per verb carrying the attribute.
    if (a.frame) {
      const args = [];
      for (const piece of a.frame.trim().split(/\s+/)) {
        const sep = piece.indexOf(":");
        if (sep < 0) continue;
        const code = piece.slice(0, sep).toLowerCase();
        const role = ROLE_LABELS[code];
        if (!role) {
          stats.unknownRoles.add(code);
          continue;
        }
        stats.roles[code] = (stats.roles[code] ?? 0) + 1;
        const targets = piece.slice(sep + 1).split(";").filter(Boolean);
        if (targets.length === 0) {
          args.push({ role, implied: true });
          stats.implied++;
          continue;
        }
        for (const tid of targets) {
          if (isNullTarget(tid)) {
            args.push({ role, implied: true });
            stats.implied++;
            continue;
          }
          const target = resolve(tid);
          if (!target || !target.ref) {
            // A small residue of targets (about 1,300 across the corpus)
            // names node ids the full trees carry but the lowfat word
            // stream drops: unexpressed subjects and objects the annotator
            // linked to a null node. They read as implied arguments and
            // are counted apart in _meta.json.
            args.push({ role, implied: true });
            stats.implied++;
            stats.phantom++;
            if (stats.phantomSamples.size < 25) {
              stats.phantomSamples.add(`${a.ref} ${piece}`);
            }
            continue;
          }
          stats.roleLinks++;
          const arg = { role, text: target.text, gloss: target.gloss, strongs: target.strongs, ref: target.ref };
          if (target.ref.chapter !== entry.ref.chapter || target.ref.verse !== entry.ref.verse) {
            stats.crossVerse++;
          }
          args.push(arg);
        }
      }
      if (args.length > 0) {
        bucketFor(entry.ref).frames.push({
          verb: entry.text,
          gloss: entry.gloss,
          strongs: entry.strongs,
          args,
        });
        stats.frameVerbs++;
      }
    }
    // Participant referents: one record per mention carrying the attribute.
    const refAttr = a.referent ?? a.participantref;
    if (refAttr) {
      const of = [];
      const seen = new Set();
      for (const tid of refAttr.trim().split(/\s+/)) {
        if (!tid || seen.has(tid)) continue;
        seen.add(tid);
        const target = resolve(tid);
        if (!target || !target.ref) {
          // The same null-node residue as the frame targets: an antecedent
          // link to a node the lowfat stream drops answers nothing, so the
          // target is skipped and counted in _meta.json.
          stats.unresolvedRefs++;
          if (stats.unresolvedRefSamples.size < 25) {
            stats.unresolvedRefSamples.add(`${a.ref} ${tid}`);
          }
          continue;
        }
        stats.referentLinks++;
        of.push({ text: target.text, gloss: target.gloss, strongs: target.strongs, ref: target.ref });
      }
      if (of.length > 0) {
        bucketFor(entry.ref).referents.push({
          word: entry.text,
          gloss: entry.gloss,
          strongs: entry.strongs,
          of,
        });
        stats.referentWords++;
      }
    }
  }
  return annotations;
}

/**
 * Map one book's source-numbered annotations onto the shipped English
 * numbering and write the book file. Args and antecedents carry c/v only
 * when their mapped location differs from the record's own.
 */
function emitBook(bookFile, refMap, annotations, side) {
  const chapters = new Map(); // chapter -> Map(verse -> { frames, referents })
  for (const [key, rec] of annotations) {
    const mapped = refMap.get(key);
    if (!mapped) {
      side.unmapped += rec.frames.length + rec.referents.length;
      if (side.unmappedSamples.size < 25) side.unmappedSamples.add(`${bookFile} ${key}`);
      continue;
    }
    if (!chapters.has(mapped.chapter)) chapters.set(mapped.chapter, new Map());
    const verseMap = chapters.get(mapped.chapter);
    if (!verseMap.has(mapped.verse)) verseMap.set(mapped.verse, { frames: [], referents: [] });
    const out = verseMap.get(mapped.verse);
    const locate = (ref) => {
      const at = refMap.get(`${ref.chapter}.${ref.verse}`);
      return at ?? null;
    };
    for (const f of rec.frames) {
      const args = f.args.map((a) => {
        if (a.implied) return { role: a.role, implied: true };
        const at = locate(a.ref);
        const arg = { role: a.role, text: a.text, gloss: a.gloss, strongs: a.strongs };
        if (at && (at.chapter !== mapped.chapter || at.verse !== mapped.verse)) {
          if (at.chapter !== mapped.chapter) arg.c = at.chapter;
          arg.v = at.verse;
        }
        return arg;
      });
      out.frames.push({ verb: f.verb, gloss: f.gloss, strongs: f.strongs, args });
      side.frames++;
    }
    for (const r of rec.referents) {
      const of = r.of.map((t) => {
        const at = locate(t.ref);
        const row = { text: t.text, gloss: t.gloss, strongs: t.strongs };
        if (at && (at.chapter !== mapped.chapter || at.verse !== mapped.verse)) {
          if (at.chapter !== mapped.chapter) row.c = at.chapter;
          row.v = at.verse;
        }
        return row;
      });
      out.referents.push({ word: r.word, gloss: r.gloss, strongs: r.strongs, of });
      side.referents++;
    }
  }
  const chapterRows = [...chapters.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([chapter, verseMap]) => ({
      chapter: String(chapter),
      verses: [...verseMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([verse, rec]) => ({
          verse: String(verse),
          ...(rec.frames.length > 0 ? { frames: rec.frames } : {}),
          ...(rec.referents.length > 0 ? { referents: rec.referents } : {}),
        })),
    }))
    .filter((c) => c.verses.length > 0);
  if (chapterRows.length === 0) return false;
  fs.writeFileSync(
    path.join(OUT_DIR, `${bookFile}.json`),
    JSON.stringify({ book: bookFile, chapters: chapterRows })
  );
  return true;
}

function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const newSide = () => ({
    frames: 0, referents: 0, frameVerbs: 0, referentWords: 0, roleLinks: 0,
    referentLinks: 0, implied: 0, phantom: 0, crossVerse: 0, unmapped: 0,
    unresolvedRefs: 0, unparseableRefs: 0, roles: {}, unknownRoles: new Set(),
    unmappedSamples: new Set(), phantomSamples: new Set(), unresolvedRefSamples: new Set(),
  });
  const greek = newSide();
  const hebrew = newSide();
  let books = 0;

  for (const [prefix, bookFile] of Object.entries(GREEK_BOOKS)) {
    const xml = fs.readFileSync(path.join(GREEK_DIR, `${prefix}.xml`), "utf8");
    const words = new Map();
    const tokens = collectWords(xml, "greek", words);
    const annotations = parseTokens(tokens, words, greek);
    const refMap = buildRefMap("tagnt", bookFile, "own");
    if (emitBook(bookFile, refMap, annotations, greek)) books++;
  }

  // Hebrew: the word index spans the whole book before anything resolves,
  // because frame targets point across chapter files.
  const hebrewBooks = new Map(); // bookFile -> { words, tokens[] }
  const files = fs.readdirSync(HEBREW_DIR).filter((f) => f.endsWith("-lowfat.xml"));
  for (const file of files) {
    const m = file.match(/^\d+-(\w+)-(\d+)-lowfat\.xml$/);
    if (!m) continue;
    const bookFile = HEBREW_BOOKS[m[1]];
    if (!bookFile) throw new Error(`Unknown Hebrew book code: ${m[1]} (${file})`);
    const xml = fs.readFileSync(path.join(HEBREW_DIR, file), "utf8");
    if (!hebrewBooks.has(bookFile)) hebrewBooks.set(bookFile, { words: new Map(), tokens: [] });
    const book = hebrewBooks.get(bookFile);
    book.tokens.push(...collectWords(xml, "hebrew", book.words));
  }
  for (const [bookFile, book] of hebrewBooks) {
    const annotations = parseTokens(book.tokens, book.words, hebrew);
    const refMap = buildRefMap("tahot", bookFile, "alt-first");
    if (emitBook(bookFile, refMap, annotations, hebrew)) books++;
  }

  // The role inventory must stay inside the documented-as-observed set; a
  // new code fails the build rather than shipping an unlabeled role.
  for (const [lang, side] of [["Greek", greek], ["Hebrew", hebrew]]) {
    if (side.unknownRoles.size > 0) {
      throw new Error(`Unmapped ${lang} frame roles: ${[...side.unknownRoles].join(", ")}`);
    }
  }

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
      ?.verses.find((v) => Number(v.verse) === verse) ?? {};

  const john15 = at("John", 1, 5);
  check(
    "John 1:5 katelaben names the darkness agent and the light patient",
    (john15.frames ?? []).some(
      (f) =>
        f.verb.includes("κατέλαβεν") &&
        f.args.some((a) => a.role === "agent" && a.strongs === "G4653") &&
        f.args.some((a) => a.role === "patient" && a.strongs === "G0846")
    ),
    JSON.stringify(john15.frames ?? []).slice(0, 300)
  );
  const gen11 = at("Genesis", 1, 1);
  check(
    "Genesis 1:1 bara names elohim agent and heavens plus earth patients",
    (gen11.frames ?? []).some((f) => {
      const agents = f.args.filter((a) => a.role === "agent").map((a) => a.strongs);
      const patients = f.args.filter((a) => a.role === "patient").map((a) => a.strongs);
      return agents.includes("H0430") && patients.includes("H8064") && patients.includes("H0776");
    }),
    JSON.stringify(gen11.frames ?? []).slice(0, 300)
  );
  const john12 = at("John", 1, 2);
  check(
    "John 1:2 houtos refers to the Logos of verse 1",
    (john12.referents ?? []).some((r) =>
      r.of.some((t) => t.strongs === "G3056" && t.v === 1)
    ),
    JSON.stringify(john12.referents ?? []).slice(0, 300)
  );
  const gen117 = at("Genesis", 1, 17);
  check(
    "Genesis 1:17 them refers to the luminaries and the stars",
    (gen117.referents ?? []).some((r) => r.of.length >= 2),
    JSON.stringify(gen117.referents ?? []).slice(0, 300)
  );
  check(
    "Greek frame verbs cover the New Testament",
    greek.frameVerbs >= 25000,
    String(greek.frameVerbs)
  );
  check(
    "Hebrew frame verbs cover the Old Testament",
    hebrew.frameVerbs >= 69000,
    String(hebrew.frameVerbs)
  );
  check(
    "Greek referent mentions cover the New Testament",
    greek.referentWords >= 14000,
    String(greek.referentWords)
  );
  check(
    "Hebrew referent mentions cover the Old Testament",
    hebrew.referentWords >= 50000,
    String(hebrew.referentWords)
  );
  check(
    "Unresolved referent targets stay below 3% of referent links",
    (greek.unresolvedRefs + hebrew.unresolvedRefs) /
      Math.max(1, greek.referentLinks + hebrew.referentLinks + greek.unresolvedRefs + hebrew.unresolvedRefs) <
      0.03,
    `greek=${greek.unresolvedRefs} hebrew=${hebrew.unresolvedRefs}`
  );
  check(
    "Phantom (null-node) frame targets stay below 2% of role links",
    (greek.phantom + hebrew.phantom) /
      Math.max(1, greek.roleLinks + hebrew.roleLinks + greek.phantom + hebrew.phantom) <
      0.02,
    `greek=${greek.phantom} hebrew=${hebrew.phantom}`
  );
  check("All 66 books ship", books === 66, `books=${books}`);

  fs.writeFileSync(
    path.join(OUT_DIR, "_meta.json"),
    JSON.stringify(
      {
        id: "frames",
        title: "Semantic frames and participant referents (MACULA Clear annotations)",
        attribution:
          "MACULA Greek Linguistic Datasets (https://github.com/Clear-Bible/macula-greek/) and MACULA Hebrew Linguistic Datasets (https://github.com/Clear-Bible/macula-hebrew/), both CC BY 4.0; the repositories' LICENSE.md files name Semantic Frames and Participant Referents among the licensed datasets.",
        retrieved: "2026-07-23",
        builtBy: "scripts/build-frames.mjs",
        books,
        greek: {
          frameVerbs: greek.frameVerbs,
          roleLinks: greek.roleLinks,
          roles: greek.roles,
          implied: greek.implied,
          phantomNullTargets: greek.phantom,
          crossVerse: greek.crossVerse,
          referentWords: greek.referentWords,
          referentLinks: greek.referentLinks,
          unmapped: greek.unmapped,
          unresolvedRefs: greek.unresolvedRefs,
          unmappedSamples: [...greek.unmappedSamples],
          phantomSamples: [...greek.phantomSamples],
          unresolvedRefSamples: [...greek.unresolvedRefSamples],
        },
        hebrew: {
          frameVerbs: hebrew.frameVerbs,
          roleLinks: hebrew.roleLinks,
          roles: hebrew.roles,
          implied: hebrew.implied,
          phantomNullTargets: hebrew.phantom,
          crossVerse: hebrew.crossVerse,
          referentWords: hebrew.referentWords,
          referentLinks: hebrew.referentLinks,
          unmapped: hebrew.unmapped,
          unresolvedRefs: hebrew.unresolvedRefs,
          unmappedSamples: [...hebrew.unmappedSamples],
          phantomSamples: [...hebrew.phantomSamples],
          unresolvedRefSamples: [...hebrew.unresolvedRefSamples],
        },
        checks,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`Greek: ${greek.frameVerbs} frame verbs, ${greek.roleLinks} role links (${greek.implied} implied, ${greek.phantom} phantom, ${greek.crossVerse} cross-verse), ${greek.referentWords} referent mentions`);
  console.log(`  roles: ${JSON.stringify(greek.roles)}; unmapped ${greek.unmapped}, unresolved referents ${greek.unresolvedRefs}`);
  console.log(`Hebrew: ${hebrew.frameVerbs} frame verbs, ${hebrew.roleLinks} role links (${hebrew.implied} implied, ${hebrew.phantom} phantom, ${hebrew.crossVerse} cross-verse), ${hebrew.referentWords} referent mentions`);
  console.log(`  roles: ${JSON.stringify(hebrew.roles)}; unmapped ${hebrew.unmapped}, unresolved referents ${hebrew.unresolvedRefs}`);
  console.log(`Wrote ${books} book files and _meta.json under ${path.relative(ROOT, OUT_DIR)}`);
}

run();
