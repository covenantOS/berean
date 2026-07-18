import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";

export interface Verse {
  verse: number;
  text: string;
}

interface RawBook {
  book: string;
  chapters: { chapter: string; verses: { verse: string; text: string }[] }[];
}

const cache = new Map<string, RawBook>();

async function loadBook(book: Book): Promise<RawBook> {
  const hit = cache.get(book.file);
  if (hit) return hit;
  const file = path.join(process.cwd(), "data", "kjv", `${book.file}.json`);
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawBook;
  cache.set(book.file, raw);
  return raw;
}

export async function getChapter(slug: string, chapter: number): Promise<Verse[] | null> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  const raw = await loadBook(book);
  const ch = raw.chapters[chapter - 1];
  if (!ch) return null;
  return ch.verses.map((v) => ({ verse: Number(v.verse), text: v.text }));
}

export async function getVerses(
  slug: string,
  chapter: number,
  from: number,
  to: number
): Promise<Verse[] | null> {
  const verses = await getChapter(slug, chapter);
  if (!verses) return null;
  return verses.filter((v) => v.verse >= from && v.verse <= to);
}

export interface SearchHit {
  book: Book;
  chapter: number;
  verse: number;
  text: string;
}

/** Case-insensitive whole-canon concordance search. */
export async function searchCanon(query: string, limit = 200): Promise<{ hits: SearchHit[]; total: number }> {
  const { CANON } = await import("./canon");
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return { hits: [], total: 0 };
  const hits: SearchHit[] = [];
  let total = 0;
  for (const book of CANON) {
    const raw = await loadBook(book);
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
