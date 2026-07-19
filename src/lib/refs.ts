import { BOOK_NAME_PATTERN, resolveBookName, type Book } from "./canon";
import { getChapter } from "./bible";

/**
 * Server-side Scripture reference parsing and quotation verification.
 * Used by the Writing Desk's critique and by any surface that must confirm
 * quoted words actually stand in the cited verse. Book names resolve through
 * canon.ts, the single source shared with the query language's in: scoping.
 */

export interface ParsedRef {
  book: Book;
  chapter: number;
  from?: number;
  to?: number;
  /** The raw matched string, e.g. "1 Peter 2:9-10". */
  raw: string;
  /** Character offset in the source text. */
  index: number;
}

const REF_RE = new RegExp(`\\b(${BOOK_NAME_PATTERN})\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:[-–](\\d{1,3}))?)?`, "gi");

/** Find every Scripture reference in a body of text. */
export function findRefs(text: string): ParsedRef[] {
  const out: ParsedRef[] = [];
  for (const m of text.matchAll(REF_RE)) {
    const book = resolveBookName(m[1]);
    if (!book) continue;
    const chapter = Number(m[2]);
    if (chapter < 1 || chapter > book.chapters) continue;
    out.push({
      book,
      chapter,
      from: m[3] ? Number(m[3]) : undefined,
      to: m[4] ? Number(m[4]) : m[3] ? Number(m[3]) : undefined,
      raw: m[0],
      index: m.index,
    });
  }
  return out;
}

const normalize = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

/** Does the quoted string stand verbatim in the cited verse range? */
export async function verifyQuote(
  book: string,
  chapter: number,
  from: number | undefined,
  to: number | undefined,
  quote: string
): Promise<boolean> {
  const verses = await getChapter(book, chapter);
  if (!verses) return false;
  const range = verses.filter(
    (v) => (from === undefined || v.verse >= from) && (to === undefined || v.verse <= to)
  );
  const joined = normalize(range.map((v) => v.text).join(" "));
  return joined.includes(normalize(quote));
}

export interface QuoteCheck {
  ref: string;
  quote: string;
  verified: boolean;
}

/**
 * Deterministic manuscript check: every quotation marked with quotes that
 * sits adjacent to a reference is verified against the actual verse text.
 * Pattern: "quoted words" (Reference) or Reference: "quoted words".
 */
export async function checkManuscriptQuotes(text: string): Promise<QuoteCheck[]> {
  const checks: QuoteCheck[] = [];
  const refs = findRefs(text);
  const QUOTE_RE = /[""]([^""]{8,500})[""]|"([^"]{8,500})"/g;
  const quotes: { quote: string; index: number }[] = [];
  for (const m of text.matchAll(QUOTE_RE)) {
    quotes.push({ quote: m[1] ?? m[2], index: m.index });
  }
  for (const q of quotes) {
    // The governing reference: nearest ref within 220 chars before or after the quote.
    let nearest: ParsedRef | undefined;
    let nearestDist = Infinity;
    for (const r of refs) {
      const dist = Math.min(Math.abs(r.index - q.index), Math.abs(r.index - (q.index + q.quote.length)));
      if (dist < nearestDist && dist <= 220) {
        nearest = r;
        nearestDist = dist;
      }
    }
    if (!nearest) continue;
    const verified = await verifyQuote(nearest.book.slug, nearest.chapter, nearest.from, nearest.to, q.quote);
    checks.push({
      ref: `${nearest.book.name} ${nearest.chapter}${nearest.from ? `:${nearest.from}` : ""}${
        nearest.to && nearest.to !== nearest.from ? `-${nearest.to}` : ""
      }`,
      quote: q.quote,
      verified,
    });
  }
  return checks;
}
