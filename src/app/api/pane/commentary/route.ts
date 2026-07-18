import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapterCommentary } from "@/lib/commentary";

/**
 * Chapter commentary for the workspace dock: every shipped work's sections
 * for the chapter, in wall order. Which works ship is gated by the rights
 * registry inside getChapterCommentary; the dock renders what returns.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }
  const wall = await getChapterCommentary(book.slug, chapter);
  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    works: wall.map((w) => ({ id: w.work.id, label: w.work.label, sections: w.sections })),
  });
}
