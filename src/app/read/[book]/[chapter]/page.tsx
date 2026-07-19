import Link from "next/link";
import { notFound } from "next/navigation";
import { adjacentChapter, getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";
import { getAvailableTranslations, getTranslation, translationsForBook, DEFAULT_TRANSLATION } from "@/lib/translations";
import { isLxxTranslation, lxxNumberingNote } from "@/lib/lxx";
import { getTaggedChapter, getOriginalChapter, decodeMorph } from "@/lib/tagged";
import { getChapterCrossRefs } from "@/lib/crossrefs";
import { getChapterCommentary } from "@/lib/commentary";
import { getChapterEntities } from "@/lib/entities";
import { getChapterTopics } from "@/lib/topics";
import { getChapterAudio } from "@/lib/audio";
import ChapterReader from "@/components/ChapterReader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book, chapter } = await params;
  const b = getBook(book);
  return { title: b ? `${b.name} ${chapter}` : "Read" };
}

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ book: string; chapter: string }>;
  searchParams: Promise<{ t?: string; p?: string }>;
}) {
  const { book: slug, chapter: chapterStr } = await params;
  const { t, p } = await searchParams;
  const book = getBook(slug);
  const chapter = Number(chapterStr);
  if (!book || !Number.isInteger(chapter)) notFound();

  const available = translationsForBook(await getAvailableTranslations(), book.testament);
  const translationId =
    t && available.some((x) => x.id === t) ? t : DEFAULT_TRANSLATION;
  const translation = getTranslation(translationId)!;
  const parallelId =
    p && p !== translationId && available.some((x) => x.id === p) ? p : null;

  const [verses, parallelVerses, tagged, original, crossrefs, commentary, entities, verseTopics, audio] = await Promise.all([
    getChapter(slug, chapter, translationId),
    parallelId ? getChapter(slug, chapter, parallelId) : Promise.resolve(null),
    translationId === "kjv" ? getTaggedChapter(slug, chapter) : Promise.resolve(null),
    getOriginalChapter(slug, chapter),
    getChapterCrossRefs(slug, chapter),
    getChapterCommentary(slug, chapter),
    getChapterEntities(slug, chapter),
    getChapterTopics(slug, chapter),
    // The recordings are the KJV read aloud; offer them only on the KJV text.
    translationId === "kjv" ? getChapterAudio(slug, chapter) : Promise.resolve(null),
  ]);
  if (!verses) notFound();

  // The LXX columns keep the Septuagint's own numbering; say so where it
  // diverges from the KJV, and say when the LXX has no such chapter at all.
  let parallelNote: string | null = null;
  if (parallelId && isLxxTranslation(parallelId)) {
    parallelNote = lxxNumberingNote(slug, chapter);
    if (!parallelVerses) {
      parallelNote = `${getTranslation(parallelId)!.abbrev} has no ${book.name} ${chapter} under Septuagint numbering.` + (parallelNote ? ` ${parallelNote}` : "");
    }
  }

  // Expand morphology codes server-side so the client never guesses.
  const lang = book.testament === "OT" ? ("hebrew" as const) : ("greek" as const);
  const originalDecoded = original
    ? original.map((v) => ({
        verse: v.verse,
        alt: v.alt,
        words: v.words.map((w) => ({ ...w, md: decodeMorph(w.m, lang) })),
      }))
    : null;

  const prev = adjacentChapter(slug, chapter, -1);
  const next = adjacentChapter(slug, chapter, 1);
  const isPsalm = slug === "psalms";
  const keepQuery = (() => {
    const q = new URLSearchParams();
    if (translationId !== DEFAULT_TRANSLATION) q.set("t", translationId);
    if (parallelId) q.set("p", parallelId);
    const s = q.toString();
    return s ? `?${s}` : "";
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav className="mb-6 flex items-center justify-between text-sm">
        <span className="text-muted">
          <Link href="/workspace" className="text-sapphire no-underline hover:underline">
            Canon
          </Link>{" "}
          /{" "}
          <Link href="/workspace" className="text-sapphire no-underline hover:underline">
            {book.name}
          </Link>{" "}
          / {chapter}
        </span>
        <span className="flex gap-2">
          {prev && (
            <Link
              href={`/read/${prev.book.slug}/${prev.chapter}${keepQuery}`}
              className="rounded-[4px] border border-rule bg-surface px-3 py-1 text-ink no-underline hover:bg-paper"
              rel="prev"
            >
              ← {prev.book.slug === slug ? prev.chapter : prev.book.name}
            </Link>
          )}
          {next && (
            <Link
              href={`/read/${next.book.slug}/${next.chapter}${keepQuery}`}
              className="rounded-[4px] border border-rule bg-surface px-3 py-1 text-ink no-underline hover:bg-paper"
              rel="next"
            >
              {next.book.slug === slug ? next.chapter : next.book.name} →
            </Link>
          )}
        </span>
      </nav>

      <ChapterReader
        bookSlug={book.slug}
        bookName={book.name}
        chapter={chapter}
        verses={verses}
        poetry={!!book.poetry}
        heading={isPsalm ? `Psalm ${chapter}` : `${book.name} ${chapter}`}
        translationId={translationId}
        translationAbbrev={translation.abbrev}
        translations={available.map((x) => ({ id: x.id, abbrev: x.abbrev, name: x.name }))}
        parallel={
          parallelId && parallelVerses
            ? {
                id: parallelId,
                abbrev: getTranslation(parallelId)!.abbrev,
                verses: parallelVerses,
              }
            : null
        }
        parallelRequested={
          parallelId
            ? { id: parallelId, abbrev: getTranslation(parallelId)!.abbrev }
            : null
        }
        parallelNote={parallelNote}
        tagged={tagged}
        original={originalDecoded}
        lang={lang}
        crossrefs={crossrefs}
        commentary={commentary}
        entities={entities}
        verseTopics={verseTopics}
        audio={audio}
      />
    </div>
  );
}
