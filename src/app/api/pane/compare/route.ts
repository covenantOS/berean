import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapter, type Verse } from "@/lib/bible";
import {
  DEFAULT_TRANSLATION,
  getAvailableTranslations,
  getTranslation,
  translationsForBook,
} from "@/lib/translations";
import { isLxxTranslation, lxxNumberingNote } from "@/lib/lxx";
import { diffIsClean, diffWords } from "@/lib/textdiff";

/**
 * The Text Comparison report: one chapter of every furnished translation
 * diffed against a base text, word by word (src/lib/textdiff.ts). The base
 * defaults to the shelf default and falls back to it whenever the requested
 * base has no text for this book, the chapter route's own idiom.
 *
 * Versification stays honest. Verses align by number under each text's own
 * numbering; LXX columns carry the numbering note from src/lib/lxx.ts, a
 * text with no such chapter reports itself missing rather than failing the
 * report, a base verse a text lacks says so, and verses with no base
 * counterpart (LXX additions and the like) come back as onlyHere. Lettered
 * verses sharing a number (Esther's additions) join into one verse's text,
 * labels kept, the way the reader renders them.
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
  const requestedBase = params.get("base") ?? DEFAULT_TRANSLATION;
  const base = available.find((t) => t.id === requestedBase) ?? getTranslation(DEFAULT_TRANSLATION)!;
  const baseChapter = await getChapter(book.slug, chapter, base.id);
  if (!baseChapter) {
    return NextResponse.json({ error: "The base text has no such chapter." }, { status: 400 });
  }
  const baseVerses = groupVerses(baseChapter);
  const baseNumbers = new Set(baseVerses.map((v) => v.verse));

  const columns = await Promise.all(
    available
      .filter((t) => t.id !== base.id)
      .map(async (t) => {
        const note = isLxxTranslation(t.id) ? lxxNumberingNote(book.slug, chapter) : null;
        const chapterText = await getChapter(book.slug, chapter, t.id);
        if (!chapterText) {
          return {
            id: t.id,
            abbrev: t.abbrev,
            name: t.name,
            note,
            missing: true,
            verses: [],
            onlyHere: [],
          };
        }
        const grouped = new Map(groupVerses(chapterText).map((v) => [v.verse, v.text]));
        // One entry per base verse, in base order; the pane reads them index-aligned.
        const verses = baseVerses.map((bv) => {
          const other = grouped.get(bv.verse);
          if (other === undefined) {
            return { verse: bv.verse, missingVerse: true, identical: false, segments: [] };
          }
          const segments = diffWords(bv.text, other);
          return { verse: bv.verse, identical: diffIsClean(segments), segments };
        });
        const onlyHere = chapterText
          .filter((v) => !baseNumbers.has(v.verse))
          .map((v) => ({
            verse: v.verse,
            ...(v.label ? { label: v.label } : {}),
            text: v.text,
          }));
        return { id: t.id, abbrev: t.abbrev, name: t.name, note, missing: false, verses, onlyHere };
      })
  );

  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    base: { id: base.id, abbrev: base.abbrev },
    baseVerses,
    shelf: available.map((t) => ({ id: t.id, abbrev: t.abbrev, name: t.name })),
    columns,
  });
}
