import { promises as fs } from "fs";
import path from "path";
import { getBook } from "./canon";

/**
 * Pericope boundaries with headings, from the Berean Study Bible paratext
 * (public domain; built by scripts/build-pericopes.mjs). A pericope names
 * the passage that starts at its verse and runs to the next pericope. The
 * set is translation-independent: boundaries anchor by canon reference, so
 * every furnished text wears the same headings.
 */

export interface Pericope {
  /** The verse where the named passage starts. */
  verse: number;
  heading: string;
  /** Parallel passages from the source's cross-references, when it gave them. */
  parallels?: string;
}

interface RawPericopeBook {
  book: string;
  chapters: { chapter: number; sections: Pericope[] }[];
}

const cache = new Map<string, RawPericopeBook | null>();

async function loadBook(file: string): Promise<RawPericopeBook | null> {
  if (cache.has(file)) return cache.get(file) ?? null;
  let raw: RawPericopeBook | null;
  try {
    raw = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "pericopes", `${file}.json`), "utf8")
    ) as RawPericopeBook;
  } catch {
    raw = null;
  }
  cache.set(file, raw);
  return raw;
}

/** The chapter's pericopes in verse order; empty when none are furnished. */
export async function getPericopes(slug: string, chapter: number): Promise<Pericope[]> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return [];
  const raw = await loadBook(book.file);
  if (!raw) return [];
  return raw.chapters.find((c) => c.chapter === chapter)?.sections ?? [];
}
