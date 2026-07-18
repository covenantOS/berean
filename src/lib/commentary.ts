import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";

export interface CommentarySection {
  verses: string;
  text: string;
}

interface RawCommentaryBook {
  book: string;
  chapters: { chapter: string; sections: CommentarySection[] }[];
}

const cache = new Map<string, RawCommentaryBook | null>();

async function loadCommentaryBook(work: string, book: Book): Promise<RawCommentaryBook | null> {
  const key = `${work}/${book.file}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  try {
    const file = path.join(process.cwd(), "data", "commentary", work, `${book.file}.json`);
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawCommentaryBook;
    cache.set(key, raw);
    return raw;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** A chapter's commentary sections, or null when the shelf lacks the volume. */
export async function getCommentary(
  work: string,
  slug: string,
  chapter: number
): Promise<CommentarySection[] | null> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  const raw = await loadCommentaryBook(work, book);
  if (!raw) return null;
  const ch = raw.chapters.find((c) => Number(c.chapter) === chapter);
  if (!ch) return null;
  return ch.sections;
}
