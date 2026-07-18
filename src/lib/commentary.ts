import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";
import { getRights } from "./rights";

export interface CommentarySection {
  verses: string;
  text: string;
}

/** A commentary work on the shelf, in wall order (Henry first). */
export interface CommentaryWork {
  id: string;
  /** Short attribution shown above each section. */
  label: string;
  /** Rights registry id; the work renders only while registered as shipped. */
  rightsId: string;
}

export const COMMENTARY_WORKS: CommentaryWork[] = [
  { id: "mhenry", label: "Matthew Henry — Commentary on the Whole Bible", rightsId: "matthew-henry-full" },
  { id: "mhc", label: "Matthew Henry — Concise Commentary", rightsId: "matthew-henry" },
  { id: "calvin", label: "John Calvin — Commentaries", rightsId: "calvin" },
  { id: "jfb", label: "Jamieson, Fausset & Brown", rightsId: "jfb" },
  { id: "clarke", label: "Adam Clarke — Commentary and Critical Notes", rightsId: "clarke" },
  { id: "barnes", label: "Albert Barnes — Notes on the New Testament", rightsId: "barnes" },
];

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

/** Every shipped work's sections for a chapter, in wall order; works with no
 * volume for the book (or no entry for the chapter) are omitted. */
export async function getChapterCommentary(
  slug: string,
  chapter: number
): Promise<{ work: CommentaryWork; sections: CommentarySection[] }[]> {
  const wall = await Promise.all(
    COMMENTARY_WORKS.filter((w) => getRights(w.rightsId)?.status === "shipped").map(
      async (work) => ({ work, sections: await getCommentary(work.id, slug, chapter) })
    )
  );
  return wall.filter(
    (x): x is { work: CommentaryWork; sections: CommentarySection[] } =>
      x.sections !== null && x.sections.length > 0
  );
}

/* The range helpers live in src/lib/sections.ts so client code (the
 * workspace dock) can filter sections without importing this fs-backed
 * module; the export stays here for the shelf's existing callers. */
export { sectionsForVerse } from "./sections";
