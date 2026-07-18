import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";

/**
 * Verse text for the editors (Writing Desk insertion, Chapel composer).
 * Scripture is always fetched from the actual text, never typed from memory.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }
  const verses = await getChapter(book.slug, chapter);
  if (!verses) return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  const from = params.get("from") ? Number(params.get("from")) : undefined;
  const to = params.get("to") ? Number(params.get("to")) : undefined;
  const range = verses.filter(
    (v) => (from === undefined || v.verse >= from) && (to === undefined || v.verse <= to)
  );
  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    verses: range,
  });
}
