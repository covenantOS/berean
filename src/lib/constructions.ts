import { promises as fs } from "fs";
import path from "path";
import { getBook } from "./canon";

/**
 * The clause-level grammatical constructions behind the Exegetical Guide's
 * Constructions section: per chapter and verse, the clauses of the MACULA
 * lowfat syntax trees with their constituent functions (Subject, Verb,
 * Copula, Object, and the rest of each treebank's documented label set),
 * built by scripts/build-constructions.mjs from the Clear Bible trees
 * (macula-greek Nestle 1904 and macula-hebrew WLC, both CC BY 4.0; rights
 * ids `macula-greek` and `macula-hebrew`). Verses follow the shipped
 * TAHOT/TAGNT English numbering; the Hebrew-numbered WLC refs were mapped
 * through the TAHOT alt table at build time.
 */

export interface ConstructionPart {
  /** The treebank's role code (s, vc, o, adv, pp, ...). */
  role: string;
  /** The documented function label (Subject, Copula, Object, ...). */
  label: string;
  /** The constituent's phrase or word class (np, pp, cl, verb, ...). */
  class: string;
  /** The constituent's surface text. */
  text: string;
}

export interface ConstructionClause {
  /** The treebank's clause rule naming the construction ("P-VC-S"). */
  rule: string;
  parts: ConstructionPart[];
}

interface RawConstructionsBook {
  book: string;
  chapters: { chapter: string; verses: { verse: string; clauses: ConstructionClause[] }[] }[];
}

const cache = new Map<string, Promise<RawConstructionsBook | null>>();

async function loadBook(file: string): Promise<RawConstructionsBook | null> {
  let hit = cache.get(file);
  if (!hit) {
    hit = (async () => {
      try {
        const target = path.join(process.cwd(), "data", "constructions", `${file}.json`);
        return JSON.parse(await fs.readFile(target, "utf8")) as RawConstructionsBook;
      } catch {
        return null;
      }
    })();
    cache.set(file, hit);
  }
  return hit;
}

/**
 * One chapter's constructions: verse number to the clauses beginning in
 * that verse, in source order. Null when the book is not furnished (or the
 * chapter has none), so the guide drops the section rather than stubbing it.
 */
export async function getConstructions(
  slug: string,
  chapter: number
): Promise<Record<number, ConstructionClause[]> | null> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  const raw = await loadBook(book.file);
  if (!raw) return null;
  const ch = raw.chapters.find((c) => Number(c.chapter) === chapter);
  if (!ch) return null;
  const out: Record<number, ConstructionClause[]> = {};
  for (const v of ch.verses) out[Number(v.verse)] = v.clauses;
  return Object.keys(out).length > 0 ? out : null;
}
