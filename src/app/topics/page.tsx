import Link from "next/link";
import type { Metadata } from "next";
import { listTopics, TOPIC_WORKS } from "@/lib/topics";

export const metadata: Metadata = { title: "Topical Index" };

const PAGE = 200;

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const works = await Promise.all(
    TOPIC_WORKS.map(async (w) => {
      const all = await listTopics(w.id);
      const matches = query ? all.filter((t) => t.title.includes(query)) : all;
      return { ...w, total: all.length, matches, shown: matches.slice(0, PAGE) };
    })
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Topical Index</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        The canon gathered under its subjects: every doctrine, duty, person, and place with its
        verses set out in full. From two public-domain works, Nave&apos;s Topical Bible and
        Torrey&apos;s New Topical Textbook.
      </p>

      <form action="/topics" method="get" className="mb-10 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="A topic: faith, prayer, atonement…"
          aria-label="Filter topics"
          className="w-full max-w-md rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <button
          type="submit"
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Filter
        </button>
      </form>

      {works.map((w) => (
        <section key={w.id} className="mb-10">
          <h2 className="small-caps mb-2 border-b border-rule pb-2 text-sm text-muted">
            {w.label} · {w.total.toLocaleString()} topics
            {query &&
              ` · ${w.matches.length.toLocaleString()} ${w.matches.length === 1 ? "match" : "matches"}`}
            {w.matches.length > w.shown.length && ` · showing first ${w.shown.length}`}
          </h2>
          <ul className="grid gap-x-8 gap-y-1.5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {w.shown.map((t) => (
              <li key={t.id} className="text-sm">
                <Link
                  href={`/workspace?tab=topicguide:${w.id}:${t.id}`}
                  className="text-sapphire no-underline hover:underline capitalize"
                >
                  {t.title}
                </Link>{" "}
                <span className="text-xs text-muted">
                  {t.refs.toLocaleString()} {t.refs === 1 ? "ref" : "refs"}
                </span>
              </li>
            ))}
          </ul>
          {w.matches.length === 0 && (
            <p className="pt-3 text-sm text-muted">No topic in this work matches that filter.</p>
          )}
        </section>
      ))}
    </div>
  );
}
