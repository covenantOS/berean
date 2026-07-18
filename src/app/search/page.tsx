import Link from "next/link";
import type { Metadata } from "next";
import { searchCanon } from "@/lib/bible";

export const metadata: Metadata = { title: "Concordance" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length >= 2 ? await searchCanon(query, 200) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Concordance</h1>
      <p className="mb-6 text-sm text-muted">
        Search every word of the canon (KJV). Results open the passage at the verse.
      </p>

      <form action="/search" method="get" className="mb-8 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="e.g. mercy and truth"
          aria-label="Search the canon"
          className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <button
          type="submit"
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Search
        </button>
      </form>

      {results && (
        <>
          <p className="small-caps mb-4 border-b border-rule pb-2 text-sm text-muted">
            {results.total.toLocaleString()} {results.total === 1 ? "verse" : "verses"}
            {results.total > results.hits.length &&
              ` · showing first ${results.hits.length}`}
          </p>
          <ol className="space-y-4">
            {results.hits.map((hit) => (
              <li key={`${hit.book.slug}-${hit.chapter}-${hit.verse}`}>
                <Link
                  href={`/read/${hit.book.slug}/${hit.chapter}#v${hit.verse}`}
                  className="small-caps text-sm font-medium text-sapphire no-underline hover:underline"
                >
                  {hit.book.name} {hit.chapter}:{hit.verse}
                </Link>
                <p className="font-reader mt-0.5 leading-relaxed">
                  <Highlighted text={hit.text} needle={query} />
                </p>
              </li>
            ))}
          </ol>
          {results.total === 0 && (
            <p className="text-sm text-muted">No verses contain “{query}”.</p>
          )}
        </>
      )}
    </div>
  );
}

function Highlighted({ text, needle }: { text: string; needle: string }) {
  const lower = text.toLowerCase();
  const n = needle.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(n);
  let key = 0;
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="rounded-[2px] bg-amber/25 px-0.5">
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    i = idx + needle.length;
    idx = lower.indexOf(n, i);
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}
