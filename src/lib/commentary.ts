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
 * 1263 to 1917, and the era facet is honest about what it holds: a
 * patristic-medieval catena, the Reformation and Post-Reformation
 * centuries, and the nineteenth and twentieth centuries. Sources sit in
 * the comments beside each entry.
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
  {
    id: "wesley",
    label: "John Wesley — Explanatory Notes",
    rightsId: "wesley",
    /* Explanatory Notes upon the New Testament (1755) and Explanatory Notes
     * upon the Old Testament (1765, three volumes). Wesley, fellow of Lincoln
     * College Oxford and an ordained Anglican priest, led the Methodist
     * revival; the notes are the movement's standard Bible companion. The
     * source module lacks 1 Kings and Philemon and lost Judges and Jonah to
     * production damage (both dropped at build time, documented in
     * data/_sources/wesley/PROVENANCE.md). */
    meta: {
      author: "John Wesley",
      years: "1755–1765",
      from: 1755,
      era: "Post-Reformation",
      tradition: "Methodist",
      type: "whole-bible",
    },
  },
  {
    id: "tdavid",
    label: "C. H. Spurgeon — The Treasury of David",
    rightsId: "tdavid",
    /* The Treasury of David, Spurgeon's commentary on the Psalms in seven
     * volumes, published in weekly installments through The Sword and the
     * Trowel, 1865–1885. Spurgeon pastored the Metropolitan Tabernacle in
     * London, a Particular Baptist congregation. Psalms only: his exposition
     * rides with a gathering of Puritan and older voices per verse and his
     * hints to the village preacher per psalm. */
    meta: {
      author: "C. H. Spurgeon",
      years: "1865–1885",
      from: 1865,
      era: "19th century",
      tradition: "Baptist",
      type: "selective",
    },
  },
  {
    id: "scofield",
    label: "C. I. Scofield — Scofield Reference Notes",
    rightsId: "scofield",
    /* Scofield Reference Notes, 1917 edition (the first edition appeared in
     * 1909). Cyrus I. Scofield was a Congregational minister (First Church,
     * Dallas); the notes frame dispensational premillennialism and became
     * the century's most influential study-Bible apparatus. The notes
     * comment selectively across the whole Bible; verses without a note
     * simply do not appear. */
    meta: {
      author: "C. I. Scofield",
      years: "1917",
      from: 1917,
      era: "20th century",
      tradition: "Dispensational",
      type: "whole-bible",
    },
  },
  {
    id: "catena",
    label: "Thomas Aquinas, Catena Aurea",
    rightsId: "catena",
    /* The Catena Aurea, Aquinas's chain of patristic comments on the four
     * Gospels, composed 1262-1267; the Matthew volume was presented to Pope
     * Urban IV in 1263 (Catholic Encyclopedia). Aquinas compiled the
     * fathers, and the work's tradition is his own: Roman Catholic. The
     * English text on the shelf is John Henry Newman's translation (4
     * vols., Oxford, 1841-1845). Gospels only, so the work is a
     * selection. */
    meta: {
      author: "Thomas Aquinas",
      years: "1263",
      from: 1263,
      era: "Patristic-Medieval",
      tradition: "Roman Catholic",
      type: "selective",
    },
  },
  {
    id: "pnt",
    label: "B. W. Johnson, People's New Testament",
    rightsId: "pnt",
    /* The People's New Testament with Explanatory Notes, two volumes (St.
     * Louis: Christian Publishing Company, 1889-1891; CCEL title page
     * shows the 1891 copyright). Barton W. Johnson (1833-1894) studied at
     * Bethany College under Alexander Campbell, presided over Eureka and
     * Oskaloosa Colleges, and edited The Evangelist and the St. Louis
     * Christian-Evangelist: the Restoration Movement's Disciples of
     * Christ (J. H. Garrison's 1891 biographical sketch). New Testament
     * only. */
    meta: {
      author: "B. W. Johnson",
      years: "1889–1891",
      from: 1889,
      era: "19th century",
      tradition: "Restoration Movement",
      type: "new-testament",
    },
  },
  {
    id: "burkitt",
    label: "William Burkitt, Expository Notes",
    rightsId: "burkitt",
    /* Expository Notes with Practical Observations on the New Testament:
     * the Gospels in 1700, Acts to Revelation in 1703, the year of his
     * death. Burkitt (1650-1703) was vicar of Dedham, Essex: Church of
     * England. New Testament only. (Dictionary of National Biography;
     * the module's About text.) */
    meta: {
      author: "William Burkitt",
      years: "1700–1703",
      from: 1700,
      era: "Post-Reformation",
      tradition: "Church of England",
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
