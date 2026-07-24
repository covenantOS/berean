import { promises as fs } from "fs";
import path from "path";
import { getRights } from "./rights";

/**
 * The Chapel hymnbook: 250 public-domain hymns from the Open Hymnal
 * Project's 2014.06 release, built by scripts/build-hymns.mjs into
 * data/hymns/ from the vendored sources (data/_sources/openhymnal/
 * PROVENANCE.md). The index carries one summary row per hymn; each hymn's
 * full record rides in its own reader file under texts/. The words verify
 * as public domain per score (the registry entry openhymnal-pd); music
 * and settings do not ship.
 */

export interface HymnRef {
  book: string;
  chapter: number;
  from?: number;
  to?: number;
}

export interface HymnSummary {
  id: string;
  title: string;
  altTitles?: string[];
  author: string | null;
  translator: string | null;
  meter: string;
  tunes: string[];
  firstLine: string;
  verses: number;
  refrain: boolean;
}

export interface HymnTune {
  name: string;
  composer: string | null;
}

export interface Hymn {
  id: string;
  title: string;
  altTitles: string[];
  author: string | null;
  translator: string | null;
  /** Dotted syllable count of the verse, e.g. "8.6.8.6". */
  meter: string;
  /** The words credit as the score prints it ("John Newton, 1779."). */
  credit: string;
  tunes: HymnTune[];
  /** The printed sources the score's words come from. */
  lyricSources: string[];
  firstLine: string;
  verses: string[][];
  refrain: string[] | null;
  refs: HymnRef[];
}

interface HymnIndex {
  hymns: HymnSummary[];
}

let indexCache: HymnIndex | null = null;

async function loadIndex(): Promise<HymnIndex | null> {
  if (getRights("openhymnal-pd")?.status !== "shipped") return null;
  if (indexCache) return indexCache;
  try {
    const file = path.join(process.cwd(), "data", "hymns", "index.json");
    indexCache = JSON.parse(await fs.readFile(file, "utf8")) as HymnIndex;
    return indexCache;
  } catch {
    return null;
  }
}

/** The hymnbook's summary rows, title order; empty when the hymnal is
 * not registered as shipped, so the Chapel's section hides. */
export async function listHymns(): Promise<HymnSummary[]> {
  const index = await loadIndex();
  return index ? index.hymns : [];
}

/** One hymn's full reader record, or null when the id is unknown or the
 * hymnal is not registered as shipped. */
export async function getHymn(id: string): Promise<Hymn | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  if (getRights("openhymnal-pd")?.status !== "shipped") return null;
  try {
    const file = path.join(process.cwd(), "data", "hymns", "texts", `${id}.json`);
    return JSON.parse(await fs.readFile(file, "utf8")) as Hymn;
  } catch {
    return null;
  }
}
