import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";
import {
  Node,
  WithinVersesNode,
  evalVerse,
  hasPreciseSyntax,
  parseQuery,
  scopeMatch,
  verseWords,
  windowFlags,
} from "./query";
import { DEFAULT_TRANSLATION, getTranslation } from "./translations";

export interface Verse {
  verse: number;
  text: string;
  /** Source label when it is not the plain number, e.g. "1b" for LXX
   *  addition verses in Esther. Numbered under verse by parseInt. */
  label?: string;
}

interface RawBook {
  book: string;
  chapters: { chapter: string; verses: { verse: string; text: string }[] }[];
}

const cache = new Map<string, RawBook>();

async function loadBook(book: Book, translation = DEFAULT_TRANSLATION): Promise<RawBook> {
  const t = getTranslation(translation) ?? getTranslation(DEFAULT_TRANSLATION)!;
  const key = `${t.id}/${book.file}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const file = path.join(process.cwd(), "data", t.dir, `${book.file}.json`);
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawBook;
  cache.set(key, raw);
  return raw;
}

export async function getChapter(
  slug: string,
  chapter: number,
  translation = DEFAULT_TRANSLATION
): Promise<Verse[] | null> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  let raw: RawBook;
  try {
    raw = await loadBook(book, translation);
  } catch {
    return null;
  }
  const ch = raw.chapters[chapter - 1];
  if (!ch) return null;
  return ch.verses.map((v) => {
    const n = parseInt(v.verse, 10);
    return { verse: n, text: v.text, ...(v.verse !== String(n) ? { label: v.verse } : {}) };
  });
}

export async function getVerses(
  slug: string,
  chapter: number,
  from: number,
  to: number,
  translation = DEFAULT_TRANSLATION
): Promise<Verse[] | null> {
  const verses = await getChapter(slug, chapter, translation);
  if (!verses) return null;
  return verses.filter((v) => v.verse >= from && v.verse <= to);
}

export interface SearchHit {
  book: Book;
  chapter: number;
  verse: number;
  text: string;
}

export interface WordStudy {
  word: string;
  total: number;
  /** Occurrence count per book slug, canon order, zero-count books omitted. */
  byBook: { book: Book; count: number }[];
  first: SearchHit | null;
  last: SearchHit | null;
}

/** Whole-word usage across the canon — the Library's word-study apparatus. */
export async function studyWord(word: string): Promise<WordStudy | null> {
  const { CANON } = await import("./canon");
  const needle = word.trim().toLowerCase();
  if (needle.length < 2) return null;
  const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  const byBook: { book: Book; count: number }[] = [];
  let total = 0;
  let first: SearchHit | null = null;
  let last: SearchHit | null = null;
  for (const book of CANON) {
    const raw = await loadBook(book);
    let count = 0;
    for (const ch of raw.chapters) {
      for (const v of ch.verses) {
        const matches = v.text.match(re);
        if (matches) {
          count += matches.length;
          const hit = { book, chapter: Number(ch.chapter), verse: Number(v.verse), text: v.text };
          if (!first) first = hit;
          last = hit;
        }
      }
    }
    if (count > 0) byBook.push({ book, count });
    total += count;
  }
  return { word: needle, total, byBook, first, last };
}

/** Case-insensitive whole-canon concordance search. */
export async function searchCanon(
  query: string,
  limit = 200,
  translation = DEFAULT_TRANSLATION
): Promise<{ hits: SearchHit[]; total: number }> {
  const { CANON } = await import("./canon");
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return { hits: [], total: 0 };
  if (hasPreciseSyntax(query)) {
    return searchPrecise(query, CANON, limit, translation);
  }
  const hits: SearchHit[] = [];
  let total = 0;
  for (const book of CANON) {
    const raw = await loadBook(book, translation);
    for (const ch of raw.chapters) {
      for (const v of ch.verses) {
        if (v.text.toLowerCase().includes(needle)) {
          total++;
          if (hits.length < limit) {
            hits.push({ book, chapter: Number(ch.chapter), verse: Number(v.verse), text: v.text });
          }
        }
      }
    }
  }
  return { hits, total };
}

/**
 * The precise path: parseQuery compiles the operators (src/lib/query.ts) and
 * throws QueryError on malformed input, which the routes turn into a
 * message. The scan collects the in-scope verses once, answers cross-verse
 * windows from where each side held, then evaluates the tree per verse.
 */
async function searchPrecise(
  query: string,
  CANON: Book[],
  limit: number,
  translation: string
): Promise<{ hits: SearchHit[]; total: number }> {
  const plan = parseQuery(query.trim());
  interface ScopedVerse {
    book: Book;
    chapter: number;
    verse: number;
    text: string;
    words: string[];
  }
  const verses: ScopedVerse[] = [];
  for (let bi = 0; bi < CANON.length; bi++) {
    const book = CANON[bi];
    if (plan.scopes.length > 0 && !plan.scopes.some((s) => bi >= s.fromBook && bi <= s.toBook)) {
      continue;
    }
    const raw = await loadBook(book, translation);
    for (const ch of raw.chapters) {
      const chapter = Number(ch.chapter);
      for (const v of ch.verses) {
        const verse = Number(v.verse);
        if (plan.scopes.length > 0 && !plan.scopes.some((s) => scopeMatch(s, bi, chapter, verse))) {
          continue;
        }
        verses.push({ book, chapter, verse, text: v.text, words: verseWords(v.text) });
      }
    }
  }
  const withinFlags = new Map<WithinVersesNode, boolean[]>();
  for (const w of plan.within) {
    const left = verses.map((v) => evalVerse(w.left, v.words));
    const right = verses.map((v) => evalVerse(w.right, v.words));
    withinFlags.set(w, windowFlags(left, right, w.maxVerses));
  }
  const resolveWithin = (n: Node) => withinFlags.get(n as WithinVersesNode);
  const hits: SearchHit[] = [];
  let total = 0;
  verses.forEach((v, i) => {
    if (!evalVerse(plan.root, v.words, (n) => resolveWithin(n)?.[i] ?? false)) return;
    total++;
    if (hits.length < limit) {
      hits.push({ book: v.book, chapter: v.chapter, verse: v.verse, text: v.text });
    }
  });
  return { hits, total };
}
