import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";
import { DEFAULT_TRANSLATION, getTranslation } from "@/lib/translations";

/**
 * Chapter text for workspace panes. The shell is client-driven; panes fetch
 * Scripture here instead of navigating. The text always comes from the
 * actual server-side data (src/lib/bible.ts), never from the client.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }
  const requested = params.get("translation") ?? DEFAULT_TRANSLATION;
  const translation = getTranslation(requested) ?? getTranslation(DEFAULT_TRANSLATION)!;
  const verses = await getChapter(book.slug, chapter, translation.id);
  if (!verses) return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    chapters: book.chapters,
    poetry: book.poetry === true,
    translation: translation.abbrev,
    verses,
  });
}
