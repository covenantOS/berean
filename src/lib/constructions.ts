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

/**
 * The search side of the constructions: for one book, a map of
 * "chapter.verse" to each clause-function role present and the number of
 * clauses carrying it (a verse with two O2 clauses counts two). The
 * clause filter in morphsearch gates hit verses against this map and
 * counts constructions for a clause-only query.
 */
export type ClauseRoleIndex = Map<string, Map<string, number>>;

const clauseRoleIndexes = new Map<string, Promise<ClauseRoleIndex | null>>();

export async function getClauseRoleIndex(file: string): Promise<ClauseRoleIndex | null> {
  let hit = clauseRoleIndexes.get(file);
  if (!hit) {
    hit = (async () => {
      const raw = await loadBook(file);
      if (!raw) return null;
      const index: ClauseRoleIndex = new Map();
      for (const ch of raw.chapters) {
        for (const v of ch.verses) {
          const key = `${Number(ch.chapter)}.${Number(v.verse)}`;
          for (const clause of v.clauses) {
            const seen = new Set<string>();
            for (const part of clause.parts) {
              if (seen.has(part.role)) continue;
              seen.add(part.role);
              if (!index.has(key)) index.set(key, new Map());
              const atVerse = index.get(key)!;
              atVerse.set(part.role, (atVerse.get(part.role) ?? 0) + 1);
            }
          }
        }
      }
      return index;
    })();
    clauseRoleIndexes.set(file, hit);
  }
  return hit;
}
