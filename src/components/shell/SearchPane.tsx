"use client";

import { useEffect, useMemo, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import { listDocuments } from "@/lib/documents";
import { toggleFavorite, useSearchSaves } from "@/lib/search-history";
import SearchChart, { type ChartKind, type ChartSlice } from "./SearchChart";
import { useWorkspace } from "./WorkspaceContext";

interface Hit {
  book: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; hits: Hit[]; total: number };

/** The arrangements the pane offers over one fetched result set. */
type View = "verses" | "grid" | "analysis" | "chart";

const VIEWS: { key: View; label: string }[] = [
  { key: "verses", label: "Verses" },
  { key: "grid", label: "Grid" },
  { key: "analysis", label: "Analysis" },
  { key: "chart", label: "Chart" },
];

interface BookBucket {
  slug: string;
  name: string;
  count: number;
  /** Chapter of the first hit, so a book row can open where the word starts. */
  firstChapter: number;
  /** Hit count per chapter, for the chart's drill-down. */
  chapters: Map<number, number>;
}

/** Counts the fetched hits by book, canon order, with per-chapter detail. */
function aggregate(hits: Hit[]): BookBucket[] {
  const buckets = new Map<string, BookBucket>();
  for (const h of hits) {
    let b = buckets.get(h.book);
    if (!b) {
      b = { slug: h.book, name: h.bookName, count: 0, firstChapter: h.chapter, chapters: new Map() };
      buckets.set(h.book, b);
    }
    b.count += 1;
    b.chapters.set(h.chapter, (b.chapters.get(h.chapter) ?? 0) + 1);
  }
  const order = new Map(CANON.map((b, i) => [b.slug, i]));
  return [...buckets.values()].sort(
    (a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0)
  );
}

function openRef(book: string, chapter: number, verse?: number) {
  window.dispatchEvent(new CustomEvent("berean:open-ref", { detail: { book, chapter, verse } }));
}

/**
 * The concordance pane: opened by the omnibox's berean:search event. One
 * fetch to /api/pane/search carries the whole working set; the Verses,
 * Grid, Analysis, and Chart arrangements are different readings of that
 * same set, computed on the client, never re-fetched. Every row in every
 * view dispatches berean:open-ref, carrying the pane to the passage. The
 * header pin keeps the query among the Search rail's pinned searches.
 */
export default function SearchPane({ q }: { q: string }) {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [view, setView] = useState<View>("verses");
  const { favorites } = useSearchSaves();
  const pinned = favorites.some((f) => f.q.toLowerCase() === q.trim().toLowerCase());

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hits: Hit[]; total: number };
        setLoad({ status: "ready", hits: data.hits, total: data.total });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [q]);

  const books = useMemo(() => (load.status === "ready" ? aggregate(load.hits) : []), [load]);
  const truncated = load.status === "ready" && load.total > load.hits.length;

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col">
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          “{q}”
          <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">Concordance</span>
        </h2>
        <button
          type="button"
          title={pinned ? "Remove this search from the pinned list" : "Pin this search in the Search rail"}
          onClick={() => toggleFavorite(q)}
          className="ml-auto text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {pinned ? "Pinned" : "Pin search"}
        </button>
        {load.status === "ready" && load.hits.length > 0 && (
          <button
            type="button"
            title="Save the listed verses as a passage list document"
            onClick={() => {
              if (load.status !== "ready") return;
              const doc = listDocuments.create({
                title: `Passages for “${q}”`,
                kind: "passage-list",
                items: load.hits.map((h) => ({ book: h.book, chapter: h.chapter, verse: h.verse })),
              });
              dispatch({ type: "openListDoc", docId: doc.id, title: doc.title });
            }}
            className="ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Save as passage list
          </button>
        )}
      </header>
      <nav
        aria-label="Result views"
        className="flex shrink-0 items-center gap-4 border-b border-rule px-4"
      >
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={view === v.key}
            onClick={() => setView(v.key)}
            className={`small-caps py-1.5 text-[0.68rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
              view === v.key
                ? "border-b-2 border-sapphire font-semibold text-sapphire"
                : "text-muted hover:text-ink"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {load.status === "loading" && (
          <p className="px-6 py-8 text-center text-xs text-muted">Searching the canon…</p>
        )}
        {load.status === "error" && (
          <p className="px-6 py-8 text-center text-xs text-muted">The search could not be run.</p>
        )}
        {load.status === "ready" && load.total === 0 && (
          <p className="px-6 py-8 text-center text-xs text-muted">
            No verse in the canon answers to “{q}”.
          </p>
        )}
        {load.status === "ready" && load.total > 0 && (
          <>
            {view === "verses" && <VersesView hits={load.hits} total={load.total} />}
            {view === "grid" && <GridView hits={load.hits} total={load.total} />}
            {view === "analysis" && (
              <AnalysisView books={books} total={load.total} truncated={truncated} listed={load.hits.length} />
            )}
            {view === "chart" && (
              <ChartView key={q} books={books} truncated={truncated} listed={load.hits.length} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Verses: the reading list ---------- */

function VersesView({ hits, total }: { hits: Hit[]; total: number }) {
  return (
    <div className="mx-auto max-w-prose px-6 py-4">
      <p className="mb-3 text-xs text-muted">
        {total.toLocaleString()} {total === 1 ? "verse answers" : "verses answer"}
        {total > hits.length ? `; the first ${hits.length} are listed` : ""}.
      </p>
      <ul>
        {hits.map((h) => (
          <li key={`${h.book}-${h.chapter}-${h.verse}`} className="border-b border-rule/60">
            <button
              type="button"
              onClick={() => openRef(h.book, h.chapter, h.verse)}
              className="block w-full py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              <span className="small-caps text-sm font-medium text-sapphire">
                {h.bookName} {h.chapter}:{h.verse}
              </span>
              <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed">
                {h.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Grid: the compact reference table ---------- */

function GridView({ hits, total }: { hits: Hit[]; total: number }) {
  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-xs text-muted">
        {total.toLocaleString()} {total === 1 ? "verse answers" : "verses answer"}
        {total > hits.length ? `; the first ${hits.length} are listed` : ""}.
      </p>
      <ul className="divide-y divide-rule/60 border-y border-rule/60">
        {hits.map((h) => (
          <li key={`${h.book}-${h.chapter}-${h.verse}`}>
            <button
              type="button"
              onClick={() => openRef(h.book, h.chapter, h.verse)}
              className="grid w-full grid-cols-[6.5rem_1fr] items-baseline gap-3 py-1 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              <span className="small-caps shrink-0 text-[0.7rem] font-medium text-sapphire">
                {h.bookName} {h.chapter}:{h.verse}
              </span>
              <span className="truncate font-reader text-[0.8rem] text-ink">{h.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Analysis: counts and breakdowns ---------- */

function AnalysisView({
  books,
  total,
  truncated,
  listed,
}: {
  books: BookBucket[];
  total: number;
  truncated: boolean;
  listed: number;
}) {
  const divisions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of books) {
      const book = getBook(b.slug);
      if (!book) continue;
      counts.set(book.division, (counts.get(book.division) ?? 0) + b.count);
    }
    return [...counts.entries()].map(([division, count]) => ({ division, count }));
  }, [books]);
  const maxBook = Math.max(1, ...books.map((b) => b.count));
  const maxDivision = Math.max(1, ...divisions.map((d) => d.count));
  const ot = books.filter((b) => getBook(b.slug)?.testament === "OT").reduce((n, b) => n + b.count, 0);
  const chapters = books.reduce((n, b) => n + b.chapters.size, 0);

  return (
    <div className="mx-auto max-w-prose space-y-6 px-6 py-4">
      <p className="text-xs text-muted">
        {total.toLocaleString()} {total === 1 ? "verse answers" : "verses answer"} across{" "}
        {books.length} {books.length === 1 ? "book" : "books"} and {chapters.toLocaleString()}{" "}
        {chapters === 1 ? "chapter" : "chapters"}: {ot.toLocaleString()} in the Old Testament,{" "}
        {(listed - ot).toLocaleString()} in the New
        {truncated ? `; the first ${listed.toLocaleString()} verses are counted` : ""}.
      </p>
      <section>
        <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">By book</p>
        <div className="space-y-1 pt-3">
          {books.map((b) => (
            <button
              key={b.slug}
              type="button"
              title={`Open ${b.name} ${b.firstChapter}, where the word first appears there`}
              onClick={() => openRef(b.slug, b.firstChapter)}
              className="flex w-full items-center gap-2 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              <span className="w-28 shrink-0 truncate text-ink">{b.name}</span>
              <span className="h-2 bg-sapphire/70" style={{ width: `${(b.count / maxBook) * 100}%` }} />
              <span className="text-[0.68rem] text-muted">{b.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
          By division
        </p>
        <div className="space-y-1 pt-3">
          {divisions.map((d) => (
            <p key={d.division} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate">{d.division}</span>
              <span className="h-2 bg-amber/70" style={{ width: `${(d.count / maxDivision) * 100}%` }} />
              <span className="text-[0.68rem] text-muted">{d.count.toLocaleString()}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------- Chart: the frequency graph, drilling book to chapter ---------- */

function ChartView({ books, truncated, listed }: { books: BookBucket[]; truncated: boolean; listed: number }) {
  const [kind, setKind] = useState<ChartKind>("bar");
  /** The drilled-into book; null graphs the whole canon by book. */
  const [scope, setScope] = useState<string | null>(null);

  const scoped = scope ? books.find((b) => b.slug === scope) : undefined;
  const series: ChartSlice[] = scoped
    ? Array.from({ length: getBook(scoped.slug)?.chapters ?? 0 }, (_, i) => i + 1).map((ch) => ({
        key: String(ch),
        label: `${scoped.name} ${ch}`,
        value: scoped.chapters.get(ch) ?? 0,
      }))
    : CANON.map((b) => ({
        key: b.slug,
        label: b.name,
        value: books.find((x) => x.slug === b.slug)?.count ?? 0,
      }));

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-baseline gap-3">
        <p className="small-caps text-xs font-semibold text-muted">
          {scoped ? `${scoped.name}, by chapter` : "The canon, by book"}
        </p>
        {scoped && (
          <button
            type="button"
            onClick={() => setScope(null)}
            className="text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Back to all books
          </button>
        )}
        {truncated && (
          <span className="ml-auto text-[0.68rem] text-muted">
            The first {listed.toLocaleString()} verses are counted.
          </span>
        )}
      </div>
      <SearchChart
        series={series}
        kind={kind}
        onKindChange={setKind}
        onSelect={(key) => {
          if (scoped) openRef(scoped.slug, Number(key));
          // A book without hits has nothing to drill into.
          else if (books.some((b) => b.slug === key)) setScope(key);
        }}
      />
      <p className="mt-3 text-[0.68rem] text-muted">
        {scoped
          ? "A chapter opens its passage."
          : "A book drills into its chapters."}
      </p>
    </div>
  );
}
