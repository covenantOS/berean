import { Book, getBook } from "./canon";
import { getPericopes } from "./pericopes";
import {
  getOriginalChapter,
  getTaggedChapter,
  parseHebrewMorph,
  parseRobinson,
  STOP_STRONGS,
} from "./tagged";
import { getLexiconEntry, normalizeStrongs } from "./lexicon";

/**
 * The Concordance tool: one book's word and lemma inventories, composed
 * over the shipped apparatus. English words come from the tagged KJV text
 * (surface forms, normalized the way countRenderings normalizes them, a
 * function-word stoplist folding away the crowd); original-language lemmas
 * come from TAHOT (Old Testament) and TAGNT (New Testament), keyed by root
 * Strong's id with the lemma, transliteration, gloss, and part of speech
 * the apparatus carries. Every entry lists its verses, and the book's
 * pericope boundaries ride along so the pane can facet by heading. Payloads
 * cache at module scope the way the data libs cache their raw files.
 */

export type ConcordanceMode = "words" | "lemmas";

export interface ConcordanceEntry {
  /** The inventory key: the word itself, or the Strong's id in lemma mode. */
  key: string;
  /** What the row wears: the word, or the lemma's most frequent form. */
  display: string;
  count: number;
  /** [chapter, verse] pairs in canon order. */
  refs: [number, number][];
  strongs?: string;
  xlit?: string;
  gloss?: string;
  /** Parts of speech the entry's tokens carry, lemma mode only. */
  pos?: string[];
}

export interface ConcordancePericope {
  heading: string;
  /** Display form of the starting reference, e.g. "8:28". */
  ref: string;
  from: [number, number];
  to: [number, number];
}

export interface ConcordancePayload {
  book: string;
  bookName: string;
  mode: ConcordanceMode;
  /** The apparatus behind lemma mode; absent for English words. */
  lang?: "hebrew" | "greek";
  /** Tokens walked, before the stoplist folded any away. */
  tokens: number;
  /** What the stoplist folded away; zero when it was included. */
  stopped: { entries: number; tokens: number };
  entries: ConcordanceEntry[];
  pericopes: ConcordancePericope[];
  /** KJV verse text for every referenced verse, keyed "chapter:verse". */
  texts: Record<string, string>;
}

/**
 * The English stoplist, the same discipline as STOP_STRONGS: function words
 * (articles, pronouns, the copula, common conjunctions and prepositions) and
 * the highest-frequency speech forms crowd any book's top ranks without
 * telling the reader anything about it. Everything listed folds away unless
 * the pane asks for it.
 */
export const STOP_WORDS = new Set([
  "a", "an", "the",
  "and", "also", "but", "or", "nor", "for", "yet", "so", "if", "though",
  "although", "lest", "whether", "neither", "either", "both",
  "of", "in", "on", "at", "by", "to", "unto", "into", "from", "with",
  "within", "without", "upon", "over", "under", "before", "after", "through",
  "toward", "towards", "against", "among", "between", "about", "above",
  "below", "down", "up", "out", "off",
  "as", "than", "then", "when", "while", "where", "how", "what", "which",
  "who", "whom", "whose", "that", "this", "these", "those", "there", "here",
  "therefore", "wherefore", "therein", "thereof", "herein", "thus",
  "not", "no", "nay", "yea", "none", "all", "any", "some", "every", "each",
  "other", "another", "such", "same", "own", "much", "many", "more", "most",
  "less", "few", "very", "even", "only", "again", "ever", "never", "now",
  "i", "me", "my", "mine", "thou", "thee", "thy", "thine", "ye", "you",
  "your", "yours", "he", "him", "his", "she", "her", "hers", "it", "its",
  "we", "us", "our", "ours", "they", "them", "their", "theirs", "himself",
  "themselves", "myself", "thyself",
  "is", "are", "was", "were", "be", "been", "being", "am", "art",
  "have", "has", "had", "hath", "hast", "do", "does", "did", "doth", "dost",
  "shall", "should", "will", "would", "wilt", "may", "might", "must", "can",
  "could", "let",
  "said", "say", "saith", "saying", "spake",
]);

/* ------------------------- shared book walking ------------------------- */

interface BookText {
  /** KJV text per verse, keyed "chapter:verse". */
  texts: Record<string, string>;
  /** Last verse number of each chapter, 1-indexed by chapter. */
  chapterEnds: number[];
}

const textCache = new Map<string, Promise<BookText | null>>();

/** The book's KJV text and chapter bounds, from the tagged KJV (all 66 books). */
function loadBookText(book: Book): Promise<BookText | null> {
  const hit = textCache.get(book.slug);
  if (hit) return hit;
  const job = (async (): Promise<BookText | null> => {
    const texts: Record<string, string> = {};
    const chapterEnds: number[] = [];
    let furnished = false;
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      const verses = await getTaggedChapter(book.slug, chapter);
      if (!verses) return null;
      furnished = true;
      let last = 0;
      for (const v of verses) {
        texts[`${chapter}:${v.verse}`] = v.words
          .map((w) => w.t)
          .join(" ")
          .replace(/\s+([.,;:!?])/g, "$1");
        last = Math.max(last, v.verse);
      }
      chapterEnds.push(last);
    }
    return furnished ? { texts, chapterEnds } : null;
  })();
  textCache.set(book.slug, job);
  return job;
}

/** The book's pericope boundaries resolved to [chapter, verse] ranges. */
async function pericopeRanges(book: Book, chapterEnds: number[]): Promise<ConcordancePericope[]> {
  const out: ConcordancePericope[] = [];
  for (let chapter = 1; chapter <= book.chapters; chapter++) {
    const sections = await getPericopes(book.slug, chapter);
    const last = chapterEnds[chapter - 1] ?? 0;
    for (let i = 0; i < sections.length; i++) {
      const start = sections[i].verse;
      const endVerse = i + 1 < sections.length ? sections[i + 1].verse - 1 : last;
      out.push({
        heading: sections[i].heading,
        ref: book.chapters > 1 ? `${chapter}:${start}` : `:${start}`,
        from: [chapter, start],
        to: [chapter, Math.max(start, endVerse)],
      });
    }
  }
  return out;
}

/** The verse texts the listed entries reference, and nothing else. */
function citedTexts(
  all: Record<string, string>,
  entries: ConcordanceEntry[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    for (const [c, v] of e.refs) {
      const key = `${c}:${v}`;
      if (all[key] !== undefined) out[key] = all[key];
    }
  }
  return out;
}

/* ------------------------------ words mode ------------------------------ */

/** One surface word out of a tagged token, normalized like countRenderings. */
function surfaceWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length > 0);
}

async function buildWords(book: Book, includeStoplisted: boolean): Promise<ConcordancePayload | null> {
  const text = await loadBookText(book);
  if (!text) return null;
  const counts = new Map<string, { count: number; refs: [number, number][] }>();
  const stoppedSet = new Set<string>();
  let tokens = 0;
  let stoppedTokens = 0;
  for (let chapter = 1; chapter <= book.chapters; chapter++) {
    const verses = await getTaggedChapter(book.slug, chapter);
    if (!verses) return null;
    for (const v of verses) {
      for (const token of v.words) {
        for (const word of surfaceWords(token.t)) {
          tokens++;
          if (!includeStoplisted && STOP_WORDS.has(word)) {
            stoppedSet.add(word);
            stoppedTokens++;
            continue;
          }
          let row = counts.get(word);
          if (!row) {
            row = { count: 0, refs: [] };
            counts.set(word, row);
          }
          row.count++;
          row.refs.push([chapter, v.verse]);
        }
      }
    }
  }
  const entries: ConcordanceEntry[] = [...counts.entries()]
    .map(([word, row]) => ({ key: word, display: word, count: row.count, refs: row.refs }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return {
    book: book.slug,
    bookName: book.name,
    mode: "words",
    tokens,
    stopped: { entries: stoppedSet.size, tokens: stoppedTokens },
    entries,
    pericopes: await pericopeRanges(book, text.chapterEnds),
    texts: citedTexts(text.texts, entries),
  };
}

/* ------------------------------ lemmas mode ----------------------------- */

interface LemmaRow {
  count: number;
  refs: [number, number][];
  lemmas: Map<string, number>;
  xlits: Map<string, number>;
  pos: Set<string>;
}

/** The form heard most often wins the row's display. */
function mostFrequent(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  for (const [form, n] of counts) {
    if (n > bestN || (n === bestN && best !== null && form < best)) {
      best = form;
      bestN = n;
    }
  }
  return best;
}

async function buildLemmas(book: Book, includeStoplisted: boolean): Promise<ConcordancePayload | null> {
  const text = await loadBookText(book);
  if (!text) return null;
  const lang = book.testament === "OT" ? "hebrew" : "greek";
  const rows = new Map<string, LemmaRow>();
  const stoppedSet = new Set<string>();
  let tokens = 0;
  let stoppedTokens = 0;
  for (let chapter = 1; chapter <= book.chapters; chapter++) {
    const verses = await getOriginalChapter(book.slug, chapter);
    if (!verses) return null;
    for (const v of verses) {
      for (const w of v.words) {
        // The root id: TAHOT carries it as r, TAGNT as the last s segment.
        const root = normalizeStrongs(w.r ?? w.s[w.s.length - 1] ?? "");
        if (!root) continue;
        tokens++;
        if (!includeStoplisted && STOP_STRONGS.has(root)) {
          stoppedSet.add(root);
          stoppedTokens++;
          continue;
        }
        let row = rows.get(root);
        if (!row) {
          row = { count: 0, refs: [], lemmas: new Map(), xlits: new Map(), pos: new Set() };
          rows.set(root, row);
        }
        row.count++;
        row.refs.push([chapter, v.verse]);
        if (w.l) row.lemmas.set(w.l, (row.lemmas.get(w.l) ?? 0) + 1);
        if (w.x) row.xlits.set(w.x.replace(/[.-]+$/, ""), (row.xlits.get(w.x) ?? 0) + 1);
        const parsed = lang === "greek" ? parseRobinson(w.m) : parseHebrewMorph(w.m).pop();
        if (parsed?.pos) row.pos.add(parsed.pos);
      }
    }
  }
  const entries: ConcordanceEntry[] = await Promise.all(
    [...rows.entries()].map(async ([strongs, row]) => {
      const hit = await getLexiconEntry(strongs);
      return {
        key: strongs,
        display: mostFrequent(row.lemmas) ?? hit?.entry.lemma ?? strongs,
        count: row.count,
        refs: row.refs,
        strongs,
        xlit: mostFrequent(row.xlits) ?? hit?.entry.xlit ?? undefined,
        gloss: hit?.entry.kjv_def ?? undefined,
        pos: [...row.pos].sort(),
      } satisfies ConcordanceEntry;
    })
  );
  entries.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return {
    book: book.slug,
    bookName: book.name,
    mode: "lemmas",
    lang,
    tokens,
    stopped: { entries: stoppedSet.size, tokens: stoppedTokens },
    entries,
    pericopes: await pericopeRanges(book, text.chapterEnds),
    texts: citedTexts(text.texts, entries),
  };
}

/* ------------------------------ composition ----------------------------- */

const cache = new Map<string, Promise<ConcordancePayload | null>>();

/**
 * One book's concordance. Null when the apparatus behind the mode is not
 * furnished for the book. The stoplist applies unless includeStoplisted;
 * the payload reports what it folded away either way.
 */
export function buildConcordance(
  slug: string,
  mode: ConcordanceMode,
  includeStoplisted = false
): Promise<ConcordancePayload | null> | null {
  const book = getBook(slug);
  if (!book) return null;
  const key = `${book.slug}|${mode}|${includeStoplisted ? "all" : "main"}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = mode === "words" ? buildWords(book, includeStoplisted) : buildLemmas(book, includeStoplisted);
  cache.set(key, job);
  return job;
}
