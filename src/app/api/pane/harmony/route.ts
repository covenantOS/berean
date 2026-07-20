import { NextRequest, NextResponse } from "next/server";
import { GOSPEL_SLUGS, getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";
import { getQuotesInRange } from "@/lib/otnt";
import { getAllPericopes, type FlatPericope } from "@/lib/pericopes";
import { findRefs } from "@/lib/refs";

/**
 * The Parallel Gospel Reader: the pericope dataset's parallel references
 * (the BSB paratext, src/lib/pericopes.ts) resolved into a harmony report.
 *
 * With no params the route answers the index: every gospel pericope with its
 * heading and the other gospels its parallels name, the pane's navigation.
 * With ?book=&chapter=&verse= naming a pericope's start it answers the
 * report: the anchor account and each parallel account with its KJV verses,
 * one account per gospel in canon order. The anchor runs to the next
 * pericope in its book, crossing chapter boundaries when the dataset leaves
 * none between; a parallel's range is the range the source gave. References
 * outside the four gospels (the Old Testament quotations, Acts, the
 * epistles) are not accounts; they answer as see-also cross-references. A
 * start that names no pericope fails the request rather than guessing.
 */

interface VerseRow {
  chapter: number;
  verse: number;
  text: string;
}

interface Account {
  book: string;
  bookName: string;
  /** Display form, e.g. "Mark 1:9–11". */
  ref: string;
  /** True when the account crosses a chapter boundary. */
  spanChapters: boolean;
  verses: VerseRow[];
  /** The OT sources quoted inside the account's range, from the OT-in-NT
   * dataset; deduplicated by display ref. */
  otQuotes: { ref: string; slug: string; chapter: number; kind: "quotation" | "allusion" }[];
}

const isGospel = (slug: string): boolean =>
  (GOSPEL_SLUGS as readonly string[]).includes(slug);

/** The verse before a given verse, crossing to the previous chapter at 1. */
async function verseBefore(
  slug: string,
  chapter: number,
  verse: number
): Promise<{ chapter: number; verse: number }> {
  if (verse > 1) return { chapter, verse: verse - 1 };
  const prev = await getChapter(slug, chapter - 1);
  return { chapter: chapter - 1, verse: prev ? prev[prev.length - 1].verse : 1 };
}

/** The verses of a reference range, walking chapters when it spans them. */
async function rangeVerses(
  slug: string,
  fromChapter: number,
  fromVerse: number,
  toChapter: number,
  toVerse: number
): Promise<VerseRow[]> {
  const out: VerseRow[] = [];
  for (let ch = fromChapter; ch <= toChapter; ch++) {
    const rows = await getChapter(slug, ch);
    if (!rows) continue;
    for (const v of rows) {
      if (ch === fromChapter && v.verse < fromVerse) continue;
      if (ch === toChapter && v.verse > toVerse) continue;
      out.push({ chapter: ch, verse: v.verse, text: v.text });
    }
  }
  return out;
}

function fmtRef(
  bookName: string,
  from: { chapter: number; verse: number },
  to: { chapter: number; verse: number }
): string {
  const start = `${from.chapter}:${from.verse}`;
  if (from.chapter === to.chapter && from.verse === to.verse) return `${bookName} ${start}`;
  const end =
    from.chapter === to.chapter ? `${to.verse}` : `${to.chapter}:${to.verse}`;
  return `${bookName} ${start}–${end}`;
}

async function buildAccount(
  slug: string,
  from: { chapter: number; verse: number },
  to: { chapter: number; verse: number }
): Promise<Account | null> {
  const book = getBook(slug);
  if (!book) return null;
  const verses = await rangeVerses(slug, from.chapter, from.verse, to.chapter, to.verse);
  const seen = new Set<string>();
  const otQuotes: Account["otQuotes"] = [];
  for (const rec of await getQuotesInRange(slug, from.chapter, from.verse, to.chapter, to.verse)) {
    for (const src of rec.ot) {
      const srcBook = getBook(src.book);
      if (!srcBook) continue;
      const ref = fmtRef(
        srcBook.name,
        { chapter: src.chapter, verse: src.verse },
        { chapter: src.chapter, verse: src.endVerse ?? src.verse }
      );
      if (seen.has(ref)) continue;
      seen.add(ref);
      otQuotes.push({ ref, slug: src.book, chapter: src.chapter, kind: rec.kind });
    }
  }
  return {
    book: slug,
    bookName: book.name,
    ref: fmtRef(book.name, from, to),
    spanChapters: from.chapter !== to.chapter,
    verses,
    otQuotes,
  };
}

/** The anchor's account: from its start to the verse before the next pericope. */
async function anchorAccount(
  slug: string,
  all: FlatPericope[],
  index: number
): Promise<Account | null> {
  const book = getBook(slug)!;
  const p = all[index];
  const next = all[index + 1];
  let to: { chapter: number; verse: number };
  if (next) {
    to = await verseBefore(slug, next.chapter, next.verse);
  } else {
    // The book's last verse: ask the chapter itself rather than assuming
    // dense numbering.
    const rows = await getChapter(slug, book.chapters);
    to = { chapter: book.chapters, verse: rows ? rows[rows.length - 1].verse : p.verse };
  }
  return buildAccount(slug, { chapter: p.chapter, verse: p.verse }, to);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const bookParam = params.get("book");

  /* The index: every gospel pericope with the gospels its parallels name. */
  if (!bookParam) {
    const books = [];
    for (const slug of GOSPEL_SLUGS) {
      const book = getBook(slug)!;
      const pericopes = (await getAllPericopes(slug)).map((p) => {
        const gospels = new Set<string>();
        for (const r of findRefs(p.parallels ?? "")) {
          if (isGospel(r.book.slug) && r.book.slug !== slug) gospels.add(r.book.slug);
        }
        return {
          chapter: p.chapter,
          verse: p.verse,
          heading: p.heading,
          gospels: GOSPEL_SLUGS.filter((g) => gospels.has(g)),
        };
      });
      books.push({ slug, name: book.name, pericopes });
    }
    return NextResponse.json({ books });
  }

  /* The report: one pericope with its parallel accounts. */
  const book = getBook(bookParam);
  const chapter = Number(params.get("chapter"));
  const verse = Number(params.get("verse"));
  if (
    !book ||
    !isGospel(book.slug) ||
    !Number.isInteger(chapter) ||
    !Number.isInteger(verse)
  ) {
    return NextResponse.json({ error: "Unknown pericope." }, { status: 400 });
  }
  const all = await getAllPericopes(book.slug);
  const index = all.findIndex((p) => p.chapter === chapter && p.verse === verse);
  if (index < 0) {
    return NextResponse.json(
      { error: "No pericope begins at this verse." },
      { status: 404 }
    );
  }
  const anchor = all[index];

  const accounts: Account[] = [];
  const seeAlso: string[] = [];
  const byGospel = new Map<string, { from: number; to: number; chapter: number }>();
  for (const part of (anchor.parallels ?? "").split(";")) {
    const raw = part.trim();
    if (!raw) continue;
    const r = findRefs(raw)[0];
    // A reference the shared grammar cannot read still answers as a see-also.
    if (!r || r.from === undefined) {
      seeAlso.push(raw);
      continue;
    }
    if (!isGospel(r.book.slug) || r.book.slug === book.slug) {
      seeAlso.push(raw);
      continue;
    }
    // One account per gospel; a second range in the same gospel reads as a
    // see-also rather than a second column.
    if (byGospel.has(r.book.slug)) {
      seeAlso.push(raw);
      continue;
    }
    byGospel.set(r.book.slug, { chapter: r.chapter, from: r.from, to: r.to ?? r.from });
  }

  const anchorAcc = await anchorAccount(book.slug, all, index);
  if (!anchorAcc) {
    return NextResponse.json({ error: "The anchor text could not be read." }, { status: 500 });
  }
  for (const slug of GOSPEL_SLUGS) {
    if (slug === book.slug) {
      accounts.push(anchorAcc);
      continue;
    }
    const range = byGospel.get(slug);
    if (!range) continue;
    const acc = await buildAccount(
      slug,
      { chapter: range.chapter, verse: range.from },
      { chapter: range.chapter, verse: range.to }
    );
    if (acc) accounts.push(acc);
  }

  return NextResponse.json({
    anchor: {
      book: book.slug,
      bookName: book.name,
      chapter: anchor.chapter,
      verse: anchor.verse,
      heading: anchor.heading,
    },
    accounts,
    seeAlso,
  });
}
