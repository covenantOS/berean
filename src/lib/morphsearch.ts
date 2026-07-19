import { Book, CANON } from "./canon";
import { extractScopes, scopeMatch } from "./query";
import {
  OriginalWord,
  decodeMorph,
  loadOriginalBook,
  parseHebrewMorph,
  parseRobinson,
} from "./tagged";

/**
 * Morphology-aware original-language search over TAHOT (OT) and TAGNT (NT).
 * Accepts a lemma (Greek or Hebrew unicode), a transliteration, a Strong's
 * number (base or extended), or a surface substring, and narrows by parsing.
 * An in: range in the query (src/lib/query.ts) scopes the search to those
 * books and chapters. Books load through the module-scope cache in
 * tagged.ts, so a warm server answers a full-canon query in one pass over
 * memory.
 */

export interface MorphFilters {
  // Greek (Robinson)
  gpos?: string;
  gtense?: string;
  gvoice?: string;
  gmood?: string;
  gcase?: string;
  gperson?: string;
  gnumber?: string;
  ggender?: string;
  // Hebrew (ETCBC)
  hpos?: string;
  hstem?: string;
  haspect?: string;
  hstate?: string;
  hperson?: string;
  hnumber?: string;
  hgender?: string;
}

export interface FilterDef {
  key: keyof MorphFilters;
  label: string;
  options: string[];
}

export const GREEK_FILTER_DEFS: FilterDef[] = [
  { key: "gpos", label: "Part of speech", options: ["verb", "noun", "adjective", "definite article", "personal pronoun", "relative pronoun", "demonstrative pronoun", "reflexive pronoun", "possessive pronoun", "interrogative/indefinite pronoun", "indefinite pronoun", "correlative pronoun", "adverb", "conjunction", "preposition", "particle", "interjection", "numeral"] },
  { key: "gtense", label: "Tense", options: ["present", "imperfect", "future", "aorist", "perfect", "pluperfect", "2nd aorist", "2nd future", "2nd perfect"] },
  { key: "gvoice", label: "Voice", options: ["active", "middle", "passive", "middle/passive"] },
  { key: "gmood", label: "Mood", options: ["indicative", "subjunctive", "optative", "imperative", "infinitive", "participle"] },
  { key: "gcase", label: "Case", options: ["nominative", "genitive", "dative", "accusative", "vocative"] },
  { key: "gperson", label: "Person", options: ["1st person", "2nd person", "3rd person"] },
  { key: "gnumber", label: "Number", options: ["singular", "plural"] },
  { key: "ggender", label: "Gender", options: ["masculine", "feminine", "neuter"] },
];

export const HEBREW_FILTER_DEFS: FilterDef[] = [
  { key: "hpos", label: "Part of speech", options: ["verb", "noun", "proper noun", "adjective", "pronoun", "conjunction", "preposition", "adverb", "particle", "definite article", "object marker", "relative", "interjection", "interrogative", "negative"] },
  { key: "hstem", label: "Stem", options: ["qal", "niphal", "piel", "pual", "hiphil", "hophal", "hithpael", "peil", "ithpeel", "ithpaal", "aphel", "shaphel", "polel"] },
  { key: "haspect", label: "Aspect", options: ["perfect", "imperfect", "consecutive imperfect", "consecutive perfect", "imperative", "jussive", "cohortative", "infinitive construct", "infinitive absolute", "participle", "passive participle"] },
  { key: "hstate", label: "State", options: ["absolute", "construct", "determined"] },
  { key: "hperson", label: "Person", options: ["1st person", "2nd person", "3rd person"] },
  { key: "hnumber", label: "Number", options: ["singular", "plural", "dual"] },
  { key: "hgender", label: "Gender", options: ["masculine", "feminine", "common"] },
];

export interface MatchedWord {
  t: string;
  parsing: string;
  gloss?: string;
  strongs?: string;
}

export interface OriginalHit {
  book: Book;
  chapter: number;
  verse: number;
  /** Original-language surface text of the verse. */
  text: string;
  matches: MatchedWord[];
}

export interface OriginalSearchResult {
  hits: OriginalHit[];
  /** Matching words across the canon. */
  total: number;
  /** Verses containing at least one match. */
  verses: number;
  lang: "hebrew" | "greek" | "both";
}

/* ------------------------- query normalization ------------------------- */

/** Strip Greek accents, breathings, and iota subscripts; fold final sigma. */
function normalizeGreek(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ς/g, "σ")
    .replace(/[^α-ωΑ-Ω]/g, "")
    .toLowerCase();
}

/** Strip Hebrew vowel points, accents, dagesh, maqaf, and sof pasuq. */
function normalizeHebrew(s: string): string {
  return s.replace(/[֑-ׇ׃]/g, "").replace(/[^א-ת]/g, "");
}

/** Transliteration comparison: lowercase, letters only. */
function normalizeXlit(s: string): string {
  return s.toLowerCase().replace(/[^a-z']/g, "");
}

/** Normalize a Strong's query to the padded form used in the data (G0025). */
function normalizeStrongsQuery(q: string): string | null {
  const m = /^([GH])\s?0*(\d{1,5})([A-Z])?$/i.exec(q.trim());
  if (!m) return null;
  return `${m[1].toUpperCase()}${m[2].padStart(4, "0")}${m[3] ?? ""}`;
}

interface QueryMatcher {
  lang: "hebrew" | "greek" | "both";
  test(word: OriginalWord, lang: "hebrew" | "greek"): boolean;
}

function buildMatcher(query: string): QueryMatcher | null {
  const q = query.trim();
  if (q.length < 2 && !normalizeStrongsQuery(q)) return null;

  const strongs = normalizeStrongsQuery(q);
  if (strongs) {
    return {
      lang: strongs[0] === "H" ? "hebrew" : "greek",
      test: (w) => w.s?.some((s) => s === strongs || s.startsWith(strongs)) ?? false,
    };
  }

  if (/[֐-׿]/.test(q)) {
    const needle = normalizeHebrew(q);
    return {
      lang: "hebrew",
      test: (w) =>
        (w.l !== undefined && normalizeHebrew(w.l) === needle) ||
        normalizeHebrew(w.t).includes(needle),
    };
  }

  if (/[Ͱ-Ͽἀ-῿]/.test(q)) {
    const needle = normalizeGreek(q);
    return {
      lang: "greek",
      test: (w) =>
        (w.l !== undefined && normalizeGreek(w.l) === needle) ||
        normalizeGreek(w.t).includes(needle),
    };
  }

  // Plain ASCII: treat as transliteration, searching both testaments.
  const needle = normalizeXlit(q);
  if (needle.length < 2) return null;
  return {
    lang: "both",
    test: (w) => (w.x !== undefined && normalizeXlit(w.x).includes(needle)) || false,
  };
}

/* ------------------------- morphology filtering ------------------------- */

function cleanFilters(filters: MorphFilters): MorphFilters {
  const out: MorphFilters = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v) (out as Record<string, string>)[k] = v;
  }
  return out;
}

function greekFilterPass(word: OriginalWord, f: MorphFilters): boolean {
  const active =
    f.gpos || f.gtense || f.gvoice || f.gmood || f.gcase || f.gperson || f.gnumber || f.ggender;
  if (!active) return true;
  const m = parseRobinson(word.m);
  if (!m) return false;
  if (f.gpos && m.pos !== f.gpos) return false;
  if (f.gtense && m.tense !== f.gtense) return false;
  if (f.gvoice && m.voice !== f.gvoice) return false;
  if (f.gmood && m.mood !== f.gmood) return false;
  if (f.gcase && m.case !== f.gcase) return false;
  if (f.gperson && m.person !== f.gperson) return false;
  if (f.gnumber && m.number !== f.gnumber) return false;
  if (f.ggender && m.gender !== f.ggender) return false;
  return true;
}

function hebrewFilterPass(word: OriginalWord, f: MorphFilters): boolean {
  const active =
    f.hpos || f.hstem || f.haspect || f.hstate || f.hperson || f.hnumber || f.hgender;
  if (!active) return true;
  // A multi-segment word passes when any one segment satisfies every filter.
  return parseHebrewMorph(word.m).some((m) => {
    if (f.hpos && m.pos !== f.hpos) return false;
    if (f.hstem && m.stem !== f.hstem) return false;
    if (f.haspect && m.aspect !== f.haspect) return false;
    if (f.hstate && m.state !== f.hstate) return false;
    if (f.hperson && m.person !== f.hperson) return false;
    if (f.hnumber && m.number !== f.hnumber) return false;
    if (f.hgender && m.gender !== f.hgender) return false;
    return true;
  });
}

/** Has the user set any filter at all (used to allow filter-only searches)? */
export function hasAnyFilter(filters: MorphFilters): boolean {
  return Object.values(cleanFilters(filters)).length > 0;
}

/* ------------------------------ the search ------------------------------ */

/**
 * Search the tagged original texts. With a query, words must match it; with
 * only filters set, every word passing the filters is a hit (a parsing
 * concordance). Hits group by verse; `total` counts matching words.
 */
export async function searchOriginal(
  query: string,
  filters: MorphFilters,
  limit = 200
): Promise<OriginalSearchResult | null> {
  const f = cleanFilters(filters);
  const { rest, scopes } = extractScopes(query);
  const matcher = rest.trim() ? buildMatcher(rest) : null;
  if (!matcher && !hasAnyFilter(f)) return null;

  const lang: "hebrew" | "greek" | "both" = matcher?.lang ?? "both";
  // A filter-only search applies within the family the user actually set;
  // the other testament must not pass on empty filters.
  const greekActive = Boolean(
    f.gpos || f.gtense || f.gvoice || f.gmood || f.gcase || f.gperson || f.gnumber || f.ggender
  );
  const hebrewActive = Boolean(
    f.hpos || f.hstem || f.haspect || f.hstate || f.hperson || f.hnumber || f.hgender
  );
  const hits: OriginalHit[] = [];
  let total = 0;
  let verses = 0;

  for (let bi = 0; bi < CANON.length; bi++) {
    const book = CANON[bi];
    if (scopes.length > 0 && !scopes.some((s) => bi >= s.fromBook && bi <= s.toBook)) continue;
    const bookLang: "hebrew" | "greek" = book.testament === "OT" ? "hebrew" : "greek";
    if (lang !== "both" && bookLang !== lang) continue;
    if (!matcher && bookLang === "greek" && !greekActive) continue;
    if (!matcher && bookLang === "hebrew" && !hebrewActive) continue;
    const raw = await loadOriginalBook(book, book.testament === "OT" ? "tahot" : "tagnt");
    if (!raw) continue;
    for (const ch of raw.chapters) {
      const chNum = Number(ch.chapter);
      for (const v of ch.verses) {
        if (scopes.length > 0 && !scopes.some((s) => scopeMatch(s, bi, chNum, Number(v.verse)))) {
          continue;
        }
        const matches: MatchedWord[] = [];
        for (const w of v.words) {
          if (matcher && !matcher.test(w, bookLang)) continue;
          const pass =
            bookLang === "greek" ? greekFilterPass(w, f) : hebrewFilterPass(w, f);
          if (!pass) continue;
          matches.push({
            t: w.t,
            parsing: decodeMorph(w.m, bookLang),
            gloss: w.g,
            strongs: w.s?.[w.s.length - 1],
          });
        }
        if (matches.length === 0) continue;
        total += matches.length;
        verses++;
        if (hits.length < limit) {
          hits.push({
            book,
            chapter: Number(ch.chapter),
            verse: Number(v.verse),
            text: v.words.map((w) => w.t).join(" "),
            matches,
          });
        }
      }
    }
  }
  return { hits, total, verses, lang };
}
