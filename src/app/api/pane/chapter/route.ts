import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";
import { DEFAULT_TRANSLATION, getTranslation } from "@/lib/translations";
import { getPericopes } from "@/lib/pericopes";
import { getRedLetterVerses } from "@/lib/redletter";
import { getChapterAudio } from "@/lib/audio";
import { decodeMorph, getOriginalChapter, getTaggedChapter } from "@/lib/tagged";

/**
 * Chapter text for workspace panes. The shell is client-driven; panes fetch
 * Scripture here instead of navigating. The text always comes from the
 * actual server-side data (src/lib/bible.ts), never from the client.
 *
 * The default payload stays lean: verses plus the hasTagged/hasOriginal
 * flags that let a pane offer word-level toggles without fetching the
 * apparatus first. ?tagged=1 adds the Strong's-tagged KJV words and
 * ?original=1 adds the TAHOT/TAGNT words with morphology pre-decoded
 * server-side (md), so word interaction needs no new routes. KJV chapters
 * also carry their LibriVox recording (src/lib/audio.ts), null where no
 * chapter recording is mapped.
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
  const wantTagged = params.get("tagged") === "1";
  const wantOriginal = params.get("original") === "1";
  const lang = book.testament === "OT" ? ("hebrew" as const) : ("greek" as const);
  const [verses, tagged, original, pericopes, redletter, audio] = await Promise.all([
    getChapter(book.slug, chapter, translation.id),
    // The tagged apparatus is KJV-only; other texts report it as absent.
    translation.id === "kjv" ? getTaggedChapter(book.slug, chapter) : Promise.resolve(null),
    getOriginalChapter(book.slug, chapter),
    getPericopes(book.slug, chapter),
    getRedLetterVerses(book.slug, chapter),
    // The recordings are the KJV read aloud; other texts report none.
    translation.id === "kjv" ? getChapterAudio(book.slug, chapter) : Promise.resolve(null),
  ]);
  if (!verses) return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    chapters: book.chapters,
    poetry: book.poetry === true,
    translation: translation.abbrev,
    translationId: translation.id,
    lang,
    hasTagged: tagged !== null,
    hasOriginal: original !== null,
    verses,
    pericopes,
    redletter,
    audio,
    ...(wantTagged && tagged ? { tagged } : {}),
    ...(wantOriginal && original
      ? {
          original: original.map((v) => ({
            verse: v.verse,
            ...(v.alt ? { alt: v.alt } : {}),
            words: v.words.map((w) => ({ ...w, md: decodeMorph(w.m ?? "", lang) })),
          })),
        }
      : {}),
  });
}
