import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";

export interface CrossRef {
  ref: string;
  slug: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  votes: number;
}

type BookCrossRefs = Record<string, CrossRef[]>;

const cache = new Map<string, BookCrossRefs | null>();

async function loadBookRefs(book: Book): Promise<BookCrossRefs | null> {
  const hit = cache.get(book.file);
  if (hit !== undefined) return hit;
  try {
    const file = path.join(process.cwd(), "data", "crossrefs", `${book.file}.json`);
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as BookCrossRefs;
    cache.set(book.file, raw);
    return raw;
  } catch {
    cache.set(book.file, null);
    return null;
  }
}

/** Cross-references for every verse of a chapter: { "3": [...], "16": [...] }. */
export async function getChapterCrossRefs(
  slug: string,
  chapter: number
): Promise<Record<number, CrossRef[]> | null> {
  const book = getBook(slug);
  if (!book) return null;
  const raw = await loadBookRefs(book);
  if (!raw) return null;
  const out: Record<number, CrossRef[]> = {};
  const prefix = `${chapter}:`;
  for (const [key, refs] of Object.entries(raw)) {
    if (key.startsWith(prefix)) {
      const verse = Number(key.slice(prefix.length));
      if (Number.isFinite(verse)) out[verse] = refs;
    }
  }
  return out;
}
