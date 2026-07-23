import { promises as fs } from "fs";
import path from "path";
import { getBook } from "./canon";
import { getRights } from "./rights";

/**
 * The Spurgeon sermon archive: the New Park Street Pulpit and the
 * Metropolitan Tabernacle Pulpit (1855-1917), harvested from The Spurgeon
 * Library (spurgeon.org) by scripts/build-sermons.mjs into
 * data/sermons/. The index carries one summary row per sermon; each
 * sermon's full text rides in its own reader file under texts/. The
 * chapter map builds lazily at module scope, the confessions pattern.
 */

export interface SermonSummary {
  slug: string;
  title: string;
  /** Canonical sermon number where the library records one ("3060",
   * "3141A", "39-40"); most sermons carry none. */
  number: string | null;
  year: number | null;
  /** Collection volume, e.g. "Metropolitan Tabernacle Pulpit Volume 32". */
  volume: string | null;
  /** The appointed text as printed, e.g. "Romans 10:1-3". */
  ref: string | null;
  /** The sermon at spurgeon.org. */
  url: string;
  /** The printed page facsimile PDF, when the library has one. */
  pdf: string | null;
  chapters: { book: string; chapter: number }[];
}

export interface SermonText {
  slug: string;
  title: string;
  number: string | null;
  year: number | null;
  volume: string | null;
  ref: string | null;
  /** The printed publication block where the record carries one. */
  header: string | null;
  /** The appointed text's quotation, leading the reader. */
  quote: string | null;
  paragraphs: string[];
  url: string;
  pdf: string | null;
}

interface SermonIndex {
  sermons: SermonSummary[];
}

let indexCache: SermonIndex | null = null;

async function loadIndex(): Promise<SermonIndex | null> {
  if (getRights("spurgeon-sermons")?.status !== "shipped") return null;
  if (indexCache) return indexCache;
  try {
    const file = path.join(process.cwd(), "data", "sermons", "index.json");
    indexCache = JSON.parse(await fs.readFile(file, "utf8")) as SermonIndex;
    return indexCache;
  } catch {
    return null;
  }
}

let chapterMap: Map<string, SermonSummary[]> | null = null;

function buildChapterMap(index: SermonIndex): Map<string, SermonSummary[]> {
  if (!chapterMap) {
    chapterMap = new Map();
    for (const s of index.sermons) {
      for (const c of s.chapters) {
        const key = `${c.book}:${c.chapter}`;
        const list = chapterMap.get(key);
        if (list) list.push(s);
        else chapterMap.set(key, [s]);
      }
    }
  }
  return chapterMap;
}

/** The chapter's sermons, oldest first (index order); empty when the
 * archive has none on the chapter, so the guide's section hides. */
export async function getChapterSermons(slug: string, chapter: number): Promise<SermonSummary[]> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return [];
  const index = await loadIndex();
  if (!index) return [];
  return buildChapterMap(index).get(`${slug}:${chapter}`) ?? [];
}

/** One sermon's full reader record, or null when the slug is unknown or
 * the archive is not registered as shipped. */
export async function getSermon(slug: string): Promise<SermonText | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  if (getRights("spurgeon-sermons")?.status !== "shipped") return null;
  try {
    const file = path.join(process.cwd(), "data", "sermons", "texts", `${slug}.json`);
    return JSON.parse(await fs.readFile(file, "utf8")) as SermonText;
  } catch {
    return null;
  }
}
