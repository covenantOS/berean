import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";

/** One ordered token of tagged text: a word/phrase with its Strong's numbers. */
export interface TaggedWord {
  t: string;
  s?: string[];
}

export interface TaggedVerse {
  verse: number;
  words: TaggedWord[];
}

interface RawTaggedBook {
  book: string;
  chapters: { chapter: string; verses: { verse: string; words: TaggedWord[] }[] }[];
}

const cache = new Map<string, RawTaggedBook | null>();

async function loadTaggedBook(book: Book): Promise<RawTaggedBook | null> {
  const hit = cache.get(book.file);
  if (hit !== undefined) return hit;
  try {
    const file = path.join(process.cwd(), "data", "kjv-strongs", `${book.file}.json`);
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawTaggedBook;
    cache.set(book.file, raw);
    return raw;
  } catch {
    cache.set(book.file, null);
    return null;
  }
}

/** Strong's-tagged KJV chapter, or null when the apparatus is not furnished. */
export async function getTaggedChapter(slug: string, chapter: number): Promise<TaggedVerse[] | null> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  const raw = await loadTaggedBook(book);
  if (!raw) return null;
  const ch = raw.chapters[chapter - 1];
  if (!ch) return null;
  return ch.verses.map((v) => ({ verse: Number(v.verse), words: v.words }));
}

export interface StrongsOccurrence {
  book: Book;
  chapter: number;
  verse: number;
  text: string;
}

/** Every canon occurrence of a Strong's number, from the tagged KJV. */
export async function findOccurrences(
  strongs: string,
  limit = 500
): Promise<{ occurrences: StrongsOccurrence[]; total: number; byBook: { book: Book; count: number }[] }> {
  const { CANON } = await import("./canon");
  const occurrences: StrongsOccurrence[] = [];
  const byBook: { book: Book; count: number }[] = [];
  let total = 0;
  for (const book of CANON) {
    const raw = await loadTaggedBook(book);
    if (!raw) continue;
    let count = 0;
    for (const ch of raw.chapters) {
      for (const v of ch.verses) {
        if (v.words.some((w) => w.s?.includes(strongs))) {
          total++;
          count++;
          if (occurrences.length < limit) {
            occurrences.push({
              book,
              chapter: Number(ch.chapter),
              verse: Number(v.verse),
              text: v.words.map((w) => w.t).join(" ").replace(/\s+([.,;:!?])/g, "$1"),
            });
          }
        }
      }
    }
    if (count > 0) byBook.push({ book, count });
  }
  return { occurrences, total, byBook };
}
