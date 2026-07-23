import { Book, CANON } from "./canon";
import { greekToTranslit } from "./alphabets";
import { extractScopes, scopeMatch } from "./query";
import { QueryError } from "./query";
import { getClauseRoleIndex } from "./constructions";
import { resolveDomain } from "./domains";
import { getRoleIndex } from "./frames";
import {
  OriginalWord,
  decodeMorph,
  loadOriginalBook,
  parseHebrewMorph,
  parseRobinson,
} from "./tagged";

// The filter vocabulary lives in morphfilters.ts so client surfaces can
// import it without pulling in the data-file loader above.
export { GREEK_FILTER_DEFS, HEBREW_FILTER_DEFS } from "./morphfilters";
export type { FilterDef, MorphFilters } from "./morphfilters";
import type { MorphFilters } from "./morphfilters";

/**
 * Morphology-aware original-language search over TAHOT (OT) and TAGNT (NT).
 * Accepts a lemma (Greek or Hebrew unicode), a transliteration, a Strong's
 * number (base or extended), or a surface substring, and narrows by parsing.
 * An in: range in the query (src/lib/query.ts) scopes the search to those
 * books and chapters. Books load through the module-scope cache in
 * tagged.ts, so a warm server answers a full-canon query in one pass over
 * memory.
 */

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

export interface DomainHit {
  /** The term as typed. */
  term: string;
  /** The resolved label: code or name plus the dictionary's domain names. */
  label: string;
  /** Lemmas carrying a matched sense. */
  lemmas: number;
}

export interface OriginalSearchResult {
  hits: OriginalHit[];
  /** Matching words across the canon (constructions, for a clause-only query). */
  total: number;
  /** Verses containing at least one match. */
  verses: number;
  lang: "hebrew" | "greek" | "both";
  /** Set when the query ran as a domain: search. */
  domain?: DomainHit | null;
  /** Set when `total` counts something other than occurrences (a
   *  clause-only query counts constructions). */
  totalLabel?: { one: string; many: string } | null;
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

/** Transliteration comparison: diacritics fold to their base letters
 *  (agapē answers to agape, ēgapēsen to egapesen), lowercase, letters only. */
function normalizeXlit(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z']/g, "");
}

/** Normalize a Strong's query to the padded form used in the data (G0025). */
function normalizeStrongsQuery(q: string): string | null {
  const m = /^([GH])\s?0*(\d{1,5})([A-Z])?$/i.exec(q.trim());
  if (!m) return null;
  return `${m[1].toUpperCase()}${m[2].padStart(4, "0")}${m[3] ?? ""}`;
}

/** "G0846A" -> "G0846", "H7225G" -> "H7225": the padded base id. */
function baseStrongs(s: string): string {
  const m = /^([GH])0*(\d+?)[A-Z]?$/i.exec(s.trim());
  return m ? `${m[1].toUpperCase()}${m[2].padStart(4, "0")}` : s.toUpperCase();
}

/* ------------------ semantic tokens: domain:, role:, clause: ------------------ */

/**
 * The three dataset tokens a morph query can carry, beside the in: scopes
 * of the precise grammar. domain:33 resolves a Louw-Nida or SDBH domain
 * to its lemmas and runs as an occurrence search; role:agent narrows word
 * hits to the verses where the matched lemma carries that semantic role in
 * the MACULA frames; clause:o2 narrows hit verses to the ones whose
 * constructions carry that clause function. The tokens compose with each
 * other, with the parsing filters, and with in: scoping.
 */
const SEMANTIC_ROLES = ["agent", "patient", "recipient", "causer", "experiencer"] as const;
type SemanticRole = (typeof SEMANTIC_ROLES)[number];

/** Clause function names and treebank codes to the stored role codes. */
const CLAUSE_FUNCTIONS: Record<string, string> = {
  s: "s", subject: "s",
  v: "v", verb: "v",
  vc: "vc", copula: "vc",
  o: "o", object: "o",
  o2: "o2", "second-object": "o2",
  io: "io", "indirect-object": "io",
  p: "p", predicate: "p",
  adv: "adv", adverbial: "adv",
  aux: "aux", auxiliary: "aux",
  oc: "oc", "object-complement": "oc",
  pp: "pp", "prepositional-phrase": "pp",
};

/** Display names for the clause-only count line. */
const CLAUSE_FUNCTION_NAMES: Record<string, string> = {
  s: "subject", v: "verb", vc: "copula", o: "object", o2: "second object",
  io: "indirect object", p: "predicate", adv: "adverbial", aux: "auxiliary",
  oc: "object complement", pp: "prepositional phrase",
};

interface SemanticTokens {
  domainTerm: string | null;
  role: SemanticRole | null;
  clause: string | null;
  /** The lemma-or-letters text left after the tokens come out. */
  text: string;
}

function extractSemanticTokens(rest: string): SemanticTokens {
  let role: SemanticRole | null = null;
  let clause: string | null = null;
  let text = rest.replace(/\brole:(\S+)/gi, (_m, v: string) => {
    const name = v.toLowerCase();
    if (!(SEMANTIC_ROLES as readonly string[]).includes(name)) {
      throw new QueryError(
        `Unknown semantic role “${v}”. Roles: ${SEMANTIC_ROLES.join(", ")}.`
      );
    }
    role = name as SemanticRole;
    return " ";
  });
  text = text.replace(/\bclause:(\S+)/gi, (_m, v: string) => {
    const code = CLAUSE_FUNCTIONS[v.toLowerCase()];
    if (!code) {
      throw new QueryError(
        `Unknown clause function “${v}”. Functions: ${Object.values(CLAUSE_FUNCTION_NAMES)
          .filter((n, i, a) => a.indexOf(n) === i)
          .join(", ")}.`
      );
    }
    clause = code;
    return " ";
  });
  const dm = /\bdomain:(.*)$/i.exec(text);
  let domainTerm: string | null = null;
  if (dm) {
    if (dm[1].trim() === "") {
      throw new QueryError(
        "Name a domain after domain: (a number like 33, an entry like 33.98, or a name like Communication)."
      );
    }
    if (text.slice(0, dm.index).trim() !== "") {
      throw new QueryError(
        "domain: names the whole search; it combines with in:, role:, and clause:, not with a word."
      );
    }
    domainTerm = dm[1].trim();
    text = "";
  }
  return { domainTerm, role, clause, text: text.trim() };
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

  // Plain ASCII: treat as transliteration, searching both testaments. A
  // transliterated lemma answers the way a typed-script lemma does: exact
  // against the lemma's own transliteration, while surface forms answer by
  // substring against the word's xlit. The lemma map is Greek only; the
  // Hebrew transliterator is consonantal, and TAHOT's vocalized xlits
  // already carry the Hebrew side.
  const needle = normalizeXlit(q);
  if (needle.length < 2) return null;
  const lemmaCache = new Map<string, string[]>();
  const lemmaMatch = (w: OriginalWord, lang: "hebrew" | "greek"): boolean => {
    if (lang !== "greek" || w.l === undefined) return false;
    let variants = lemmaCache.get(w.l);
    if (variants === undefined) {
      variants = w.l
        .split(/[,;/]/)
        .map((v) => normalizeXlit(greekToTranslit(v)))
        .filter((v) => v.length > 0);
      lemmaCache.set(w.l, variants);
    }
    return variants.some((v) => v === needle);
  };
  return {
    lang: "both",
    test: (w, lang) =>
      lemmaMatch(w, lang) ||
      (w.x !== undefined && normalizeXlit(w.x).includes(needle)),
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
 *
 * The dataset tokens widen the grammar: domain: resolves its term against
 * the UBS dictionaries and matches every lemma the domain assigns;
 * role: keeps a hit word only where the verse's MACULA frames give its
 * base Strong's id that semantic role; clause: keeps a hit verse only
 * where the constructions carry that clause function, and stands alone as
 * a construction concordance (hits list verses, total counts the matching
 * clauses). role: never stands alone: a bare "who is an agent" answers
 * every verse and means nothing.
 */
export async function searchOriginal(
  query: string,
  filters: MorphFilters,
  limit = 200
): Promise<OriginalSearchResult | null> {
  const f = cleanFilters(filters);
  const { rest, scopes } = extractScopes(query);
  const tokens = extractSemanticTokens(rest);
  let matcher = tokens.text ? buildMatcher(tokens.text) : null;
  let domain: DomainHit | null = null;

  if (tokens.domainTerm !== null) {
    const resolved = await resolveDomain(tokens.domainTerm);
    if (!resolved) {
      throw new QueryError(
        `No semantic domain answers to “${tokens.domainTerm}”. Try a Louw-Nida number (33), an entry (33.98), an SDBH code, or a domain name (Communication, Deities).`
      );
    }
    const ids = resolved.ids;
    matcher = {
      lang: resolved.lang,
      test: (w) => (w.s ?? []).some((s) => ids.has(baseStrongs(s))),
    };
    domain = { term: tokens.domainTerm, label: resolved.label, lemmas: resolved.lemmas };
  }
  if (tokens.role && !matcher) {
    throw new QueryError(
      "role: narrows a word search; name a lemma, a Strong's number, or a domain: with it."
    );
  }
  if (!matcher && !hasAnyFilter(f) && !tokens.clause) return null;

  const lang: "hebrew" | "greek" | "both" = matcher?.lang ?? "both";
  // A filter-only search applies within the family the user actually set;
  // the other testament must not pass on empty filters. A clause-only
  // query sets neither family and runs across both.
  const greekActive = Boolean(
    f.gpos || f.gtense || f.gvoice || f.gmood || f.gcase || f.gperson || f.gnumber || f.ggender
  );
  const hebrewActive = Boolean(
    f.hpos || f.hstem || f.haspect || f.hstate || f.hperson || f.hnumber || f.hgender
  );
  // A clause-only query (no word matcher, no parsing filters) lists the
  // verses carrying the function and counts constructions, not words.
  const clauseOnly = tokens.clause !== null && !matcher && !hasAnyFilter(f);
  const hits: OriginalHit[] = [];
  let total = 0;
  let verses = 0;

  for (let bi = 0; bi < CANON.length; bi++) {
    const book = CANON[bi];
    if (scopes.length > 0 && !scopes.some((s) => bi >= s.fromBook && bi <= s.toBook)) continue;
    const bookLang: "hebrew" | "greek" = book.testament === "OT" ? "hebrew" : "greek";
    if (lang !== "both" && bookLang !== lang) continue;
    if (!matcher && bookLang === "greek" && !greekActive && hebrewActive) continue;
    if (!matcher && bookLang === "hebrew" && !hebrewActive && greekActive) continue;
    const raw = await loadOriginalBook(book, book.testament === "OT" ? "tahot" : "tagnt");
    if (!raw) continue;
    // The dataset indexes load once per book, beside the tagged text.
    const roleIndex = tokens.role ? await getRoleIndex(book.file) : null;
    const clauseIndex = tokens.clause ? await getClauseRoleIndex(book.file) : null;
    for (const ch of raw.chapters) {
      const chNum = Number(ch.chapter);
      for (const v of ch.verses) {
        const vNum = Number(v.verse);
        if (scopes.length > 0 && !scopes.some((s) => scopeMatch(s, bi, chNum, vNum))) {
          continue;
        }
        const verseKey = `${chNum}.${vNum}`;
        let clauseCount = 0;
        if (tokens.clause) {
          clauseCount = clauseIndex?.get(verseKey)?.get(tokens.clause) ?? 0;
          if (clauseCount === 0) continue;
        }
        const roleAtVerse = tokens.role ? roleIndex?.get(verseKey) : undefined;
        const matches: MatchedWord[] = [];
        for (const w of v.words) {
          if (matcher && !matcher.test(w, bookLang)) continue;
          const pass =
            bookLang === "greek" ? greekFilterPass(w, f) : hebrewFilterPass(w, f);
          if (!pass) continue;
          if (tokens.role) {
            const carried = (w.s ?? []).some((s) =>
              roleAtVerse?.get(baseStrongs(s))?.has(tokens.role!)
            );
            if (!carried) continue;
          }
          matches.push({
            t: w.t,
            parsing: decodeMorph(w.m, bookLang),
            gloss: w.g,
            strongs: w.s?.[w.s.length - 1],
          });
        }
        if (matches.length === 0 && !clauseOnly) continue;
        total += clauseOnly ? clauseCount : matches.length;
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
  const functionName = tokens.clause ? CLAUSE_FUNCTION_NAMES[tokens.clause] : null;
  return {
    hits,
    total,
    verses,
    lang,
    domain,
    totalLabel: clauseOnly && functionName
      ? { one: `${functionName} construction`, many: `${functionName} constructions` }
      : null,
  };
}
