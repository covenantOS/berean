import { BOOK_NAME_PATTERN, resolveBookName, type Book } from "./canon";

/**
 * Scripture reference scanning for prose: finds the references a personal
 * book cites so the reader can render them as working links. The grammar is
 * the canon name table (BOOK_NAME_PATTERN, longest name first, so "1 John"
 * wins over "John") followed by a chapter, an optional :verse, and an
 * optional -end range: "John 3:16", "Rom 8:1-3", "1 Peter 2:9", and the
 * chapter-only "John 3". Pure and synchronous, the way refs.ts is, but
 * client-safe: refs.ts pulls the fs-backed bible module for quote
 * verification, while this scanner only reads the name table.
 *
 * False-positive discipline: the book name must stand on a word boundary,
 * the chapter must exist in the book ("exodus 2023" dies against Exodus's
 * forty chapters), and the character after the match must not be a letter
 * or digit, so "John 3:16pm" and a four-digit verse stay prose. Verse
 * numbers go unchecked against the text itself, the same honesty refs.ts
 * practices: chapter counts live in the canon table, verse counts live
 * behind the data files.
 */

export interface ScannedRef {
  book: Book;
  chapter: number;
  verse?: number;
  verseEnd?: number;
  /** The matched text exactly as written. */
  raw: string;
  /** Character offset in the source text. */
  index: number;
}

const REF_RE = new RegExp(
  `\\b(${BOOK_NAME_PATTERN})\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:[-–](\\d{1,3}))?)?`,
  "gi"
);

/** Every Scripture reference in the text, in reading order. */
export function scanRefs(text: string): ScannedRef[] {
  const out: ScannedRef[] = [];
  for (const m of text.matchAll(REF_RE)) {
    const book = resolveBookName(m[1]);
    if (!book) continue;
    const chapter = Number(m[2]);
    if (chapter < 1 || chapter > book.chapters) continue;
    // A letter or digit hard against the match means prose, not a citation:
    // "3:16pm" is a time, "3:1616" is nothing the grammar recognizes.
    const after = text[m.index + m[0].length];
    if (after && /[A-Za-z0-9]/.test(after)) continue;
    const verse = m[3] ? Number(m[3]) : undefined;
    const verseEnd = m[4] ? Number(m[4]) : undefined;
    out.push({
      book,
      chapter,
      ...(verse !== undefined ? { verse } : {}),
      ...(verseEnd !== undefined ? { verseEnd } : {}),
      raw: m[0],
      index: m.index,
    });
  }
  return out;
}

/** The reference as the workspace speaks of it, e.g. "John 3:16-18". */
export function formatScannedRef(r: ScannedRef): string {
  return `${r.book.name} ${r.chapter}${r.verse !== undefined ? `:${r.verse}` : ""}${
    r.verseEnd !== undefined ? `–${r.verseEnd}` : ""
  }`;
}
