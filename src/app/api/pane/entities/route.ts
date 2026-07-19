import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapterEntities } from "@/lib/entities";

/**
 * The right-click menu's entity feed: the TIPNR people, places, and things
 * tagged to a single verse. An unfurnished dataset degrades to an empty
 * list, the same honesty as the Passage Guide's sections.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  const verse = Number(params.get("verse"));
  if (
    !book ||
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    chapter > book.chapters ||
    !Number.isInteger(verse) ||
    verse < 1
  ) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }

  const entities = await getChapterEntities(book.slug, chapter);
  return NextResponse.json({
    book: book.slug,
    chapter,
    verse,
    mentions: entities?.[verse] ?? [],
  });
}
