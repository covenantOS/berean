import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapterCrossRefs } from "@/lib/crossrefs";

/**
 * Chapter cross-references for the workspace dock, listed per verse.
 * `furnished` is false on installations without the cross-reference data,
 * so the dock can say so instead of showing an empty list.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }
  const refs = await getChapterCrossRefs(book.slug, chapter);
  const verses = refs
    ? Object.entries(refs)
        .map(([verse, list]) => ({ verse: Number(verse), refs: list }))
        .sort((a, b) => a.verse - b.verse)
    : [];
  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    furnished: refs !== null,
    verses,
  });
}
