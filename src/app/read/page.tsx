import Link from "next/link";
import type { Metadata } from "next";
import { CANON } from "@/lib/canon";

export const metadata: Metadata = { title: "Read" };

export default function ReadIndex() {
  const divisions: { name: string; testament: string; books: typeof CANON }[] = [];
  for (const book of CANON) {
    const last = divisions[divisions.length - 1];
    if (last && last.name === book.division && last.testament === book.testament) {
      last.books.push(book);
    } else {
      divisions.push({ name: book.division, testament: book.testament, books: [book] });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">The Canon</h1>
      <p className="mb-8 text-sm text-muted">
        King James Version · public domain ·{" "}
        <Link href="/sources" className="text-sapphire">
          rights &amp; provenance
        </Link>
      </p>
      {(["OT", "NT"] as const).map((t) => (
        <section key={t} className="mb-10">
          <h2 className="small-caps mb-4 border-b border-rule pb-2 text-base text-ruby">
            {t === "OT" ? "The Old Testament" : "The New Testament"}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {divisions
              .filter((d) => d.testament === t)
              .map((d) => (
                <div key={`${d.testament}-${d.name}`}>
                  <h3 className="small-caps mb-2 text-sm text-muted">{d.name}</h3>
                  <ul className="space-y-1">
                    {d.books.map((b) => (
                      <li key={b.slug}>
                        <Link
                          href={`/read/${b.slug}`}
                          className="text-[0.95rem] text-ink no-underline hover:text-sapphire hover:underline"
                        >
                          {b.name}
                        </Link>
                        <span className="ml-2 text-xs text-muted">{b.chapters}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
