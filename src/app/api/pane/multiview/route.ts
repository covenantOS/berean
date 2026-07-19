import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapter, type Verse } from "@/lib/bible";
import { getAvailableTranslations, translationsForBook } from "@/lib/translations";
import { isLxxTranslation, lxxNumberingNote } from "@/lib/lxx";

/**
 * The Multiview report: one chapter in the chosen translations, verse-aligned
 * for the pane's columns. Two to four translation ids come in as ?texts=;
 * ids the book's shelf does not furnish drop out, and a set that cannot hold
 * two columns fails the request rather than rendering a one-text view.
 *
 * Versification stays honest, the comparison route's discipline: verses
 * align by number under each text's own numbering, LXX columns carry the
 * numbering note from src/lib/lxx.ts, a text with no such chapter reports
 * itself missing, and the row anchor is the union of every column's verse
 * numbers so a verse only one text numbers (the LXX's extra Daniel verses)
 * still appears, the other cells naming the gap. Lettered verses sharing a
 * number (Esther's additions) join into one verse's text, labels kept.
 */

/** Lettered verses under one number join into a single verse text. */
function groupVerses(verses: Verse[]): { verse: number; text: string }[] {
  const byNumber = new Map<number, string[]>();
  for (const v of verses) {
    const parts = byNumber.get(v.verse) ?? [];
    parts.push(v.label ? `${v.label} ${v.text}` : v.text);
    byNumber.set(v.verse, parts);
  }
  return [...byNumber.entries()].map(([verse, parts]) => ({
    verse,
    text: parts.join(" "),
  }));
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }

  const available = translationsForBook(await getAvailableTranslations(), book.testament);
  const requested = (params.get("texts") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const ids = [...new Set(requested)].filter((id) => available.some((t) => t.id === id));
  if (ids.length < 2 || ids.length > 4) {
    return NextResponse.json(
      { error: "Multiview needs two to four furnished translations." },
      { status: 400 }
    );
  }

  const columns = await Promise.all(
    ids.map(async (id) => {
      const t = available.find((x) => x.id === id)!;
      const note = isLxxTranslation(t.id) ? lxxNumberingNote(book.slug, chapter) : null;
      const chapterText = await getChapter(book.slug, chapter, t.id);
      if (!chapterText) {
        return { id: t.id, abbrev: t.abbrev, name: t.name, note, missing: true, verses: [] };
      }
      return { id: t.id, abbrev: t.abbrev, name: t.name, note, missing: false, verses: groupVerses(chapterText) };
    })
  );

  // The row anchor: every verse number any column carries, in order.
  const verseSet = new Set<number>();
  for (const c of columns) for (const v of c.verses) verseSet.add(v.verse);
  const verses = [...verseSet].sort((a, b) => a - b);

  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    chapters: book.chapters,
    verses,
    columns,
  });
}
