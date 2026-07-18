import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";
import { DEFAULT_TRANSLATION, getTranslation } from "./translations";

export interface Verse {
  verse: number;
  text: string;
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
  return ch.verses.map((v) => ({ verse: Number(v.verse), text: v.text }));
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
