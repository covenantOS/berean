import { CANON, getBook } from "@/lib/canon";

/**
 * Client-side parsing for the command omnibox: the whole input is read as a
 * Bible reference, then as a Strong's number, and otherwise falls through to
 * plain search text. The abbreviation table mirrors src/lib/refs.ts, which
 * stays server-only because it imports the fs-backed text layer.
 */

export interface ParsedRefInput {
  kind: "ref";
  /** Canon slug, e.g. "john". */
  book: string;
  /** Display name, e.g. "John". */
  bookName: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
  /** Display form, e.g. "Romans 8:28-31". */
  label: string;
}

export interface ParsedStrongsInput {
  kind: "strongs";
  /** Normalized id, e.g. "G25", "H7225". */
  id: string;
}

export interface ParsedSearchInput {
  kind: "search";
  q: string;
}

export type ParsedInput = ParsedRefInput | ParsedStrongsInput | ParsedSearchInput;

/** Book-name variants → slug (display names plus common abbreviations). */
const NAME_TO_SLUG = new Map<string, string>();
for (const b of CANON) {
  NAME_TO_SLUG.set(b.name.toLowerCase(), b.slug);
}
// Copied from src/lib/refs.ts; keep the two tables in step.
const ABBREVIATIONS: Record<string, string> = {
  gen: "genesis", exod: "exodus", ex: "exodus", lev: "leviticus", num: "numbers",
  deut: "deuteronomy", josh: "joshua", judg: "judges", "1 sam": "1-samuel", "2 sam": "2-samuel",
  "1 kgs": "1-kings", "2 kgs": "2-kings", "1 chron": "1-chronicles", "2 chron": "2-chronicles",
  "1 chr": "1-chronicles", "2 chr": "2-chronicles", neh: "nehemiah", esth: "esther",
  ps: "psalms", psalm: "psalms", prov: "proverbs", eccl: "ecclesiastes",
  song: "song-of-solomon", "song of songs": "song-of-solomon", isa: "isaiah", jer: "jeremiah",
  lam: "lamentations", ezek: "ezekiel", dan: "daniel", hos: "hosea", obad: "obadiah",
  mic: "micah", nah: "nahum", hab: "habakkuk", zeph: "zephaniah", hag: "haggai",
  zech: "zechariah", mal: "malachi", matt: "matthew", mk: "mark", lk: "luke", jn: "john",
  rom: "romans", "1 cor": "1-corinthians", "2 cor": "2-corinthians", gal: "galatians",
  eph: "ephesians", phil: "philippians", col: "colossians",
  "1 thess": "1-thessalonians", "2 thess": "2-thessalonians",
  "1 tim": "1-timothy", "2 tim": "2-timothy", philem: "philemon", heb: "hebrews",
  jas: "james", "1 pet": "1-peter", "2 pet": "2-peter", "1 jn": "1-john", "2 jn": "2-john",
  "3 jn": "3-john", rev: "revelation",
};
for (const [abbr, slug] of Object.entries(ABBREVIATIONS)) NAME_TO_SLUG.set(abbr, slug);

/** Sorted longest-first so "1 Corinthians" wins over "Corinthians". */
const NAME_PATTERN = [...NAME_TO_SLUG.keys()]
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

/** The whole input as one reference: "jn 3:16", "gen 1", "romans 8:28-31". */
const REF_RE = new RegExp(
  `^\\s*(${NAME_PATTERN})\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:[-–](\\d{1,3}))?)?\\s*$`,
  "i"
);

/** Base Strong's ids only; extended forms (H7225G) stay with the original-language search. */
const STRONGS_RE = /^\s*([GH])0*(\d{1,5})\s*$/i;

/** Beyond these the lexicon has no entries; treat the input as search text. */
const STRONGS_MAX: Record<"G" | "H", number> = { G: 5624, H: 8674 };

export function parseInput(raw: string): ParsedInput {
  const strongs = raw.match(STRONGS_RE);
  if (strongs) {
    const prefix = strongs[1].toUpperCase() as "G" | "H";
    const num = Number(strongs[2]);
    if (num >= 1 && num <= STRONGS_MAX[prefix]) {
      return { kind: "strongs", id: `${prefix}${num}` };
    }
  }
  const m = raw.match(REF_RE);
  if (m) {
    const slug = NAME_TO_SLUG.get(m[1].toLowerCase().replace(/\.$/, ""));
    const book = slug ? getBook(slug) : undefined;
    if (book) {
      const chapter = Number(m[2]);
      if (chapter >= 1 && chapter <= book.chapters) {
        const verse = m[3] ? Number(m[3]) : undefined;
        const verseEnd = m[4] ? Number(m[4]) : undefined;
        const label = `${book.name} ${chapter}${verse ? `:${verse}` : ""}${
          verseEnd ? `-${verseEnd}` : ""
        }`;
        return { kind: "ref", book: book.slug, bookName: book.name, chapter, verse, verseEnd, label };
      }
    }
  }
  return { kind: "search", q: raw.trim() };
}
