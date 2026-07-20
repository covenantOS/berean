import { promises as fs } from "fs";
import path from "path";
import { getBook } from "./canon";

/**
 * OT quotations in the NT, hand-built from the standard lists following the
 * NA27/UBS appendix convention (data/otnt/quotations.json; its sources field
 * states the scope). Direct quotations only, plus a small set of extremely
 * well-established allusions marked as such. Both directions index at module
 * scope on first read: the NT side answers "this chapter quotes these OT
 * texts", the OT side answers "these NT passages quote this chapter". A bad
 * ref fails the load loudly; the data file's own harness validates every
 * verse against the canon before it ships.
 */

export interface OtntRef {
  book: string;
  chapter: number;
  verse: number;
  endVerse?: number;
}

export interface OtntQuotation {
  /** Where the citation stands in the New Testament. */
  nt: OtntRef;
  /** The OT source(s); composite citations carry more than one. */
  ot: OtntRef[];
  kind: "quotation" | "allusion";
  /** The introductory formula, where cleanly derivable. */
  formula?: "written" | "fulfilled";
  /** Source criticism the standard lists flag, e.g. an attribution mismatch. */
  note?: string;
}

interface RawFile {
  sources: string[];
  quotations: OtntQuotation[];
}

const chapterKey = (slug: string, chapter: number) => `${slug}:${chapter}`;

let cache: Promise<{
  all: OtntQuotation[];
  byNt: Map<string, OtntQuotation[]>;
  byOt: Map<string, OtntQuotation[]>;
}> | null = null;

function load() {
  cache ??= (async () => {
    const raw = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "otnt", "quotations.json"), "utf8")
    ) as RawFile;
    const byNt = new Map<string, OtntQuotation[]>();
    const byOt = new Map<string, OtntQuotation[]>();
    for (const rec of raw.quotations) {
      for (const r of [rec.nt, ...rec.ot]) {
        const book = getBook(r.book);
        if (!book || r.chapter < 1 || r.chapter > book.chapters) {
          throw new Error(`otnt: reference outside the canon: ${JSON.stringify(r)}`);
        }
      }
      const ntKey = chapterKey(rec.nt.book, rec.nt.chapter);
      byNt.set(ntKey, [...(byNt.get(ntKey) ?? []), rec]);
      // One index entry per source chapter; a composite citation with two
      // sources in the same chapter still answers once there.
      const otKeys = new Set(rec.ot.map((src) => chapterKey(src.book, src.chapter)));
      for (const otKey of otKeys) {
        byOt.set(otKey, [...(byOt.get(otKey) ?? []), rec]);
      }
    }
    return { all: raw.quotations, byNt, byOt };
  })();
  return cache;
}

/** The quotations a chapter contains (the NT view); empty when none. */
export async function getQuotesInChapter(
  slug: string,
  chapter: number
): Promise<OtntQuotation[]> {
  const { byNt } = await load();
  return byNt.get(chapterKey(slug, chapter)) ?? [];
}

/** The quotations of a chapter's text (the OT view); empty when none. */
export async function getQuotedByChapter(
  slug: string,
  chapter: number
): Promise<OtntQuotation[]> {
  const { byOt } = await load();
  return byOt.get(chapterKey(slug, chapter)) ?? [];
}

/** The quotations whose NT side stands inside a verse range, the harmony's
 * question; the range may cross chapters. */
export async function getQuotesInRange(
  slug: string,
  fromChapter: number,
  fromVerse: number,
  toChapter: number,
  toVerse: number
): Promise<OtntQuotation[]> {
  const { all } = await load();
  return all.filter(
    (rec) =>
      rec.nt.book === slug &&
      (rec.nt.chapter > fromChapter ||
        (rec.nt.chapter === fromChapter && rec.nt.verse >= fromVerse)) &&
      (rec.nt.chapter < toChapter || (rec.nt.chapter === toChapter && rec.nt.verse <= toVerse))
  );
}
