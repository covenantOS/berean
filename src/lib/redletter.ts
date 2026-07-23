import { promises as fs } from "fs";
import path from "path";
import { getBook } from "./canon";

/**
 * Words-of-Christ verse flags, from the World English Bible USFM \wj spans
 * (public domain; built by scripts/build-redletter.mjs). A verse is flagged
 * when any part of it is marked dominical. The granularity is the verse:
 * span offsets belong to the WEB wording and do not transfer onto another
 * translation's words, while the flags anchor by canon reference, so every
 * furnished text wears them (the pericope set's idiom).
 */

interface RawRedLetterBook {
  book: string;
  chapters: { chapter: number; verses: number[] }[];
}

const cache = new Map<string, RawRedLetterBook | null>();

async function loadBook(file: string): Promise<RawRedLetterBook | null> {
  if (cache.has(file)) return cache.get(file) ?? null;
  let raw: RawRedLetterBook | null;
  try {
    raw = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "redletter", `${file}.json`), "utf8")
    ) as RawRedLetterBook;
  } catch {
    raw = null;
  }
  cache.set(file, raw);
  return raw;
}

/** The chapter's dominical verses, ascending; empty when none are furnished. */
export async function getRedLetterVerses(slug: string, chapter: number): Promise<number[]> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return [];
  const raw = await loadBook(book.file);
  if (!raw) return [];
  return raw.chapters.find((c) => c.chapter === chapter)?.verses ?? [];
}
