import Link from "next/link";
import { notFound } from "next/navigation";
import { adjacentChapter, getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";
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
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: slug, chapter: chapterStr } = await params;
  const book = getBook(slug);
  const chapter = Number(chapterStr);
  if (!book || !Number.isInteger(chapter)) notFound();
  const verses = await getChapter(slug, chapter);
  if (!verses) notFound();

  const prev = adjacentChapter(slug, chapter, -1);
  const next = adjacentChapter(slug, chapter, 1);
  const isPsalm = slug === "psalms";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav className="mb-6 flex items-center justify-between text-sm">
        <span className="text-muted">
          <Link href="/read" className="text-sapphire no-underline hover:underline">
            Canon
          </Link>{" "}
          /{" "}
          <Link href={`/read/${book.slug}`} className="text-sapphire no-underline hover:underline">
            {book.name}
          </Link>{" "}
          / {chapter}
        </span>
        <span className="flex gap-2">
          {prev && (
            <Link
              href={`/read/${prev.book.slug}/${prev.chapter}`}
              className="rounded-[4px] border border-rule bg-surface px-3 py-1 text-ink no-underline hover:bg-paper"
              rel="prev"
            >
              ← {prev.book.slug === slug ? prev.chapter : prev.book.name}
            </Link>
          )}
          {next && (
            <Link
              href={`/read/${next.book.slug}/${next.chapter}`}
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
      />
    </div>
  );
}
