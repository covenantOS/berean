import Link from "next/link";
import { notFound } from "next/navigation";
import { CANON, getBook } from "@/lib/canon";

export function generateStaticParams() {
  return CANON.map((b) => ({ book: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ book: string }> }) {
  const { book } = await params;
  return { title: getBook(book)?.name ?? "Read" };
}

export default async function BookPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: slug } = await params;
  const book = getBook(slug);
  if (!book) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/read" className="text-sapphire no-underline hover:underline">
          Canon
        </Link>{" "}
        / {book.name}
      </nav>
      <h1 className="font-editorial mb-1 text-3xl font-bold">{book.name}</h1>
      <p className="small-caps mb-8 text-sm text-muted">
        {book.division} · {book.chapters} {book.chapters === 1 ? "chapter" : "chapters"}
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
          <Link
            key={c}
            href={`/read/${book.slug}/${c}`}
            className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-rule bg-surface text-sm font-medium text-ink no-underline hover:border-sapphire hover:text-sapphire"
          >
            {c}
          </Link>
        ))}
      </div>
    </div>
  );
}
