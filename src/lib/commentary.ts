import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";
import { getRights } from "./rights";

export interface CommentarySection {
  verses: string;
  text: string;
}

/**
 * Bibliographic facts about a work on the shelf: who wrote it, when it first
 * appeared, from which tradition, and what it covers. The shelf runs from
 * 1540 to 1871, so the era facet is honest about what it holds: Reformation
 * through nineteenth century, nothing patristic and nothing contemporary.
 * Sources sit in the comments beside each entry.
 */
export interface CommentaryWorkMeta {
  author: string;
  /** First-publication range, for display. */
  years: string;
  /** First publication year; the era sort key. */
  from: number;
  /** The era label the facet sorts and reports. */
  era: string;
  /** The tradition the author (or authors) wrote from. */
  tradition: string;
  /** What the work covers: the whole Bible, the New Testament only, or a
   * selection (Calvin left books uncommented). */
  type: "whole-bible" | "new-testament" | "selective";
}

/** A commentary work on the shelf, in wall order (Henry first). */
export interface CommentaryWork {
  id: string;
  /** Short attribution shown above each section. */
  label: string;
  /** Rights registry id; the work renders only while registered as shipped. */
  rightsId: string;
  meta: CommentaryWorkMeta;
}

export const COMMENTARY_WORKS: CommentaryWork[] = [
  {
    id: "mhenry",
    label: "Matthew Henry — Commentary on the Whole Bible",
    rightsId: "matthew-henry-full",
    /* Henry's Exposition of the Old and New Testaments appeared in six
     * volumes, 1706–1721; he carried it through Acts before his death in
     * 1714, and fellow Nonconformist ministers finished Romans to Revelation
     * from his notes. Henry was ordained a Presbyterian minister at Chester
     * in 1687. (Oxford DNB; Schaff-Herzog.) */
    meta: {
      author: "Matthew Henry",
      years: "1706–1721",
      from: 1706,
      era: "Post-Reformation",
      tradition: "Presbyterian",
      type: "whole-bible",
    },
  },
  {
    id: "mhc",
    label: "Matthew Henry — Concise Commentary",
    rightsId: "matthew-henry",
    /* The concise edition on the shelf is an abridgment of the 1706–1721
     * Exposition; it carries the original's author, date, and tradition. */
    meta: {
      author: "Matthew Henry",
      years: "1706–1721",
      from: 1706,
      era: "Post-Reformation",
      tradition: "Presbyterian",
      type: "whole-bible",
    },
  },
  {
    id: "calvin",
    label: "John Calvin — Commentaries",
    rightsId: "calvin",
    /* Calvin's commentaries appeared from 1540 (Romans) through the 1550s.
     * He commented on 47 of the 66 books, none on 2 and 3 John or Revelation,
     * so the work is a selection rather than a whole-Bible commentary; the
     * shelf's 47 volumes match his coverage. The English text is the Calvin
     * Translation Society edition (Edinburgh, 1843–1855). Calvin pastored at
     * Geneva; the Reformed tradition bears his name. */
    meta: {
      author: "John Calvin",
      years: "1540–1555",
      from: 1540,
      era: "Reformation",
      tradition: "Reformed",
      type: "selective",
    },
  },
  {
    id: "jfb",
    label: "Jamieson, Fausset & Brown",
    rightsId: "jfb",
    /* A Commentary, Critical and Explanatory on the Whole Bible, 1871.
     * Robert Jamieson was a Church of Scotland minister at Glasgow, Andrew
     * Fausset an Anglican rector (St Cuthbert's, York), and David Brown a
     * Free Church of Scotland minister: two Presbyterians and an evangelical
     * Anglican. (The work's prefaces; WikiTree and Free Church records.) */
    meta: {
      author: "Jamieson, Fausset & Brown",
      years: "1871",
      from: 1871,
      era: "19th century",
      tradition: "Presbyterian and Anglican",
      type: "whole-bible",
    },
  },
  {
    id: "clarke",
    label: "Adam Clarke — Commentary and Critical Notes",
    rightsId: "clarke",
    /* The Holy Bible with a Commentary and Critical Notes, eight volumes,
     * Liverpool 1810–1826 (New Schaff-Herzog Encyclopedia). Clarke was a
     * Methodist theologian, three times president of the Methodist
     * Conference (1806, 1814, 1822). */
    meta: {
      author: "Adam Clarke",
      years: "1810–1826",
      from: 1810,
      era: "19th century",
      tradition: "Methodist",
      type: "whole-bible",
    },
  },
  {
    id: "barnes",
    label: "Albert Barnes — Notes on the New Testament",
    rightsId: "barnes",
    /* Notes, Explanatory and Practical, on the New Testament, eleven volumes,
     * 1832–1851 (the Gospels first, Revelation last). Barnes was a
     * Presbyterian minister (First Presbyterian Church, Philadelphia) of the
     * New School branch. His Old Testament notes (Job, Isaiah, Daniel) are
     * not on the shelf, so the work here is New Testament only. (CCEL
     * biography; the volumes' title pages.) */
    meta: {
      author: "Albert Barnes",
      years: "1832–1851",
      from: 1832,
      era: "19th century",
      tradition: "Presbyterian",
      type: "new-testament",
    },
  },
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
