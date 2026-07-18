import { CANON, getBook, type Book } from "./canon";
import { getChapter } from "./bible";

/**
 * Server-side Scripture reference parsing and quotation verification.
 * Used by the Writing Desk's critique and by any surface that must confirm
 * quoted words actually stand in the cited verse.
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

/** Book-name variants → slug (display names plus common abbreviations). */
const NAME_TO_SLUG = new Map<string, string>();
for (const b of CANON) {
  NAME_TO_SLUG.set(b.name.toLowerCase(), b.slug);
}
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

function resolveBookName(name: string): Book | undefined {
  const slug = NAME_TO_SLUG.get(name.trim().toLowerCase().replace(/\.$/, ""));
  return slug ? getBook(slug) : undefined;
}

/** Sorted longest-first so "1 Corinthians" wins over "Corinthians". */
const NAME_PATTERN = [...NAME_TO_SLUG.keys()]
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const REF_RE = new RegExp(`\\b(${NAME_PATTERN})\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:[-–](\\d{1,3}))?)?`, "gi");

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
