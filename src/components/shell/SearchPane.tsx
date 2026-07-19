"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CANON, getBook, resolveBookName } from "@/lib/canon";
import { listDocuments } from "@/lib/documents";
import { HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/highlights";
import { recordSearch, toggleFavorite, useSearchSaves } from "@/lib/search-history";
import { createVisualFilter } from "@/lib/visualfilters";
import SearchChart, { type ChartKind, type ChartSlice } from "./SearchChart";
import PrintButton from "./PrintButton";
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
  | { status: "invalid"; message: string }
  | { status: "ready"; hits: Hit[]; total: number };

/** The arrangements the pane offers over one fetched result set. */
type View = "verses" | "grid" | "analysis" | "chart";

const VIEWS: { key: View; label: string }[] = [
  { key: "verses", label: "Verses" },
  { key: "grid", label: "Grid" },
  { key: "analysis", label: "Analysis" },
  { key: "chart", label: "Chart" },
];

/** The precise grammar's quick reference, listed by the header's ? toggle. */
const SYNTAX_HINTS: { example: string; note: string }[] = [
  { example: '"grace and truth"', note: "consecutive words" },
  { example: "grace AND truth", note: "both words (a space alone also means AND)" },
  { example: "faith OR love · NOT wrath", note: "either word · verses without the word" },
  { example: "(law OR grace) AND truth", note: "parentheses group" },
  { example: "bapt* · *bapt", note: "wildcards, two letters beside the *" },
  { example: "grace NEAR truth", note: "within four words of each other" },
  { example: "faith WITHIN 3 VERSES OF love", note: "at most three verses apart" },
  { example: "in:romans · in:gen-exod · in:ps.23 · in:john.3.16-21", note: "scope the search" },
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
  /** The visual filter handoff: an inline name-and-tint capture under the header. */
  const [namingFilter, setNamingFilter] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterColor, setFilterColor] = useState<HighlightColor>("sapphire");
  const [filterSaved, setFilterSaved] = useState(false);
  /** The syntax quick reference under the header. */
  const [showSyntax, setShowSyntax] = useState(false);
  /** The fill-in query forms under the header. */
  const [showTemplates, setShowTemplates] = useState(false);

  /* A template's generated query runs as an ordinary search: the rail's
   * history records it, and a fresh concordance pane answers it. */
  const runGenerated = (generated: string) => {
    recordSearch(generated);
    dispatch({ type: "openSearch", q: generated });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hits: Hit[]; total: number; error?: string };
        if (data.error) setLoad({ status: "invalid", message: data.error });
        else setLoad({ status: "ready", hits: data.hits, total: data.total });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [q]);

  const books = useMemo(() => (load.status === "ready" ? aggregate(load.hits) : []), [load]);
  const truncated = load.status === "ready" && load.total > load.hits.length;

  /* Saves the fetched answer set as a named, visible visual filter. The cap
   * is the fetched set itself; the capture row says so when it truncated. */
  const saveFilter = () => {
    if (load.status !== "ready" || !filterName.trim()) return;
    createVisualFilter(
      filterName.trim(),
      filterColor,
      load.hits.map((h) => ({ book: h.book, chapter: h.chapter, verse: h.verse })),
      q
    );
    setNamingFilter(false);
    setFilterSaved(true);
    window.setTimeout(() => setFilterSaved(false), 1500);
  };

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col" data-print-root>
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          “{q}”
          <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">Concordance</span>
        </h2>
        <button
          type="button"
          title={pinned ? "Remove this search from the pinned list" : "Pin this search in the Search rail"}
          onClick={() => toggleFavorite(q)}
          className="no-print ml-auto text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
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
            className="no-print ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Save as passage list
          </button>
        )}
        {load.status === "ready" && load.hits.length > 0 && (
          <button
            type="button"
            title="Mark the listed verses in the reader as a named, toggleable visual filter"
            onClick={() => {
              setFilterName(`“${q}” matches`);
              setNamingFilter(true);
            }}
            className="no-print ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            {filterSaved ? "Saved" : "Save as visual filter"}
          </button>
        )}
        <button
          type="button"
          title="Fill-in forms that write a precise query for you"
          aria-expanded={showTemplates}
          onClick={() => setShowTemplates((v) => !v)}
          className={`no-print ml-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
            showTemplates ? "text-sapphire" : "text-muted hover:text-ink"
          }`}
        >
          Templates
        </button>
        <button
          type="button"
          title="Search syntax"
          aria-expanded={showSyntax}
          onClick={() => setShowSyntax((v) => !v)}
          className={`no-print ml-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
            showSyntax ? "text-sapphire" : "text-muted hover:text-ink"
          }`}
        >
          ?
        </button>
        <PrintButton className="ml-3" />
      </header>
      {showSyntax && (
        <div className="no-print shrink-0 border-b border-rule px-4 py-2">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[0.72rem]">
            {SYNTAX_HINTS.map((h) => (
              <div key={h.example} className="contents">
                <dt className="text-ink">{h.example}</dt>
                <dd className="text-muted">{h.note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1.5 text-[0.68rem] text-muted">
            Words match whole words; operators stay uppercase, so a lowercase and or or remains an
            ordinary word.
          </p>
        </div>
      )}
      {showTemplates && <TemplatesPanel onRun={runGenerated} />}
      {namingFilter && load.status === "ready" && (
        <div className="no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-rule px-4 py-2">
          <label htmlFor="vf-name" className="text-[0.72rem] text-muted">
            Filter name
          </label>
          <input
            id="vf-name"
            autoFocus
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveFilter();
              if (e.key === "Escape") setNamingFilter(false);
            }}
            className="w-56 border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <span className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={`Tint ${c}`}
                aria-pressed={filterColor === c}
                onClick={() => setFilterColor(c)}
                className={`h-3.5 w-3.5 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                  filterColor === c ? "border-ink" : "border-rule"
                }`}
                style={{ background: `var(--stained-${c})` }}
              />
            ))}
          </span>
          <button
            type="button"
            onClick={saveFilter}
            disabled={!filterName.trim()}
            className="border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Save filter
          </button>
          <button
            type="button"
            onClick={() => setNamingFilter(false)}
            className="px-2 py-1 text-[0.72rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Cancel
          </button>
          {truncated && (
            <span className="text-[0.68rem] text-muted">
              The first {load.hits.length.toLocaleString()} of {load.total.toLocaleString()}{" "}
              verses are marked.
            </span>
          )}
        </div>
      )}
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
        {load.status === "invalid" && (
          <p className="mx-auto max-w-prose px-6 py-8 text-center text-xs text-muted">
            {load.message}
          </p>
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

/* ---------- Templates: fill-in forms that write the query ---------- */

/** One query term: a bare word, or a quoted phrase when the input carries spaces. */
function termOf(input: string): string {
  const t = input.trim().replace(/["“”]/g, "").replace(/\s+/g, " ");
  return t.includes(" ") ? `"${t}"` : t;
}

const TPL_INPUT =
  "border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire";
const TPL_RUN =
  "border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink no-underline hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

/**
 * The templates strip: a small set of forms for the questions the precise
 * grammar answers, so the syntax is never a prerequisite. Each form builds
 * its query live under the inputs; running one dispatches an ordinary
 * search. The Strong's form is the exception: Greek and Hebrew numbers are
 * original-language questions, so it links to the /search page's original
 * mode, which answers them; the concordance never sees the query.
 */
function TemplatesPanel({ onRun }: { onRun: (q: string) => void }) {
  return (
    <div className="no-print shrink-0 border-b border-rule px-4 py-2">
      <p className="pb-1 text-[0.72rem] text-muted">
        Fill a form and the query writes itself; it runs as an ordinary search and enters the
        rail&apos;s history.
      </p>
      <NearTemplate onRun={onRun} />
      <PhraseTemplate onRun={onRun} />
      <AnyOfTemplate onRun={onRun} />
      <WithoutTemplate onRun={onRun} />
      <StrongsTemplate />
    </div>
  );
}

/** One form row: the label, the inputs, the run action, the live query. */
function TemplateRow({
  label,
  ready,
  onRun,
  preview,
  children,
}: {
  label: string;
  ready: boolean;
  onRun?: () => void;
  preview: string;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready && onRun) onRun();
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rule/60 py-1.5 first:border-t-0"
    >
      <span className="small-caps w-44 shrink-0 text-[0.68rem] font-semibold text-muted">
        {label}
      </span>
      {children}
      {onRun && (
        <button type="submit" disabled={!ready} className={TPL_RUN}>
          Search
        </button>
      )}
      {ready && <span className="text-[0.68rem] text-muted">{preview}</span>}
    </form>
  );
}

/** grace WITHIN 5 WORDS OF truth */
function NearTemplate({ onRun }: { onRun: (q: string) => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [windowInput, setWindowInput] = useState("5");
  const n = Number(windowInput);
  const ready =
    a.trim().length > 0 && b.trim().length > 0 && Number.isInteger(n) && n >= 1 && n <= 20;
  const q = ready ? `${termOf(a)} WITHIN ${n} WORDS OF ${termOf(b)}` : "";
  return (
    <TemplateRow label="Two words near each other" ready={ready} onRun={() => onRun(q)} preview={q}>
      <input
        value={a}
        onChange={(e) => setA(e.target.value)}
        placeholder="grace"
        aria-label="First word"
        className={`w-28 ${TPL_INPUT}`}
      />
      <span className="text-[0.72rem] text-muted">within</span>
      <input
        value={windowInput}
        onChange={(e) => setWindowInput(e.target.value)}
        inputMode="numeric"
        aria-label="Word window"
        className={`w-12 ${TPL_INPUT}`}
      />
      <span className="text-[0.72rem] text-muted">words of</span>
      <input
        value={b}
        onChange={(e) => setB(e.target.value)}
        placeholder="truth"
        aria-label="Second word"
        className={`w-28 ${TPL_INPUT}`}
      />
    </TemplateRow>
  );
}

/** "grace and truth" in:john */
function PhraseTemplate({ onRun }: { onRun: (q: string) => void }) {
  const [phrase, setPhrase] = useState("");
  const [book, setBook] = useState("");
  const resolved = resolveBookName(book);
  const p = phrase.trim().replace(/["“”]/g, "").replace(/\s+/g, " ");
  const ready = p.length > 0 && resolved !== undefined;
  const q = ready ? `"${p}" in:${resolved!.slug}` : "";
  return (
    <TemplateRow label="A phrase in a book" ready={ready} onRun={() => onRun(q)} preview={q}>
      <input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder="grace and truth"
        aria-label="Phrase"
        className={`w-44 ${TPL_INPUT}`}
      />
      <span className="text-[0.72rem] text-muted">in</span>
      <input
        value={book}
        onChange={(e) => setBook(e.target.value)}
        placeholder="john"
        aria-label="Book"
        className={`w-24 ${TPL_INPUT}`}
      />
      {book.trim().length > 0 && !resolved && (
        <span className="text-[0.68rem] text-ruby">No book answers to that name.</span>
      )}
    </TemplateRow>
  );
}

/** faith OR hope OR love */
function AnyOfTemplate({ onRun }: { onRun: (q: string) => void }) {
  const [words, setWords] = useState("");
  const tokens = words.split(/[\s,]+/).filter(Boolean);
  const ready = tokens.length >= 2;
  const q = ready ? tokens.join(" OR ") : "";
  return (
    <TemplateRow label="Any of these words" ready={ready} onRun={() => onRun(q)} preview={q}>
      <input
        value={words}
        onChange={(e) => setWords(e.target.value)}
        placeholder="faith hope love"
        aria-label="Words, separated by spaces or commas"
        className={`w-56 ${TPL_INPUT}`}
      />
    </TemplateRow>
  );
}

/** justified NOT works */
function WithoutTemplate({ onRun }: { onRun: (q: string) => void }) {
  const [keep, setKeep] = useState("");
  const [drop, setDrop] = useState("");
  const ready = keep.trim().length > 0 && drop.trim().length > 0;
  const q = ready ? `${termOf(keep)} NOT ${termOf(drop)}` : "";
  return (
    <TemplateRow label="One word but not another" ready={ready} onRun={() => onRun(q)} preview={q}>
      <input
        value={keep}
        onChange={(e) => setKeep(e.target.value)}
        placeholder="justified"
        aria-label="Word to find"
        className={`w-28 ${TPL_INPUT}`}
      />
      <span className="text-[0.72rem] text-muted">but not</span>
      <input
        value={drop}
        onChange={(e) => setDrop(e.target.value)}
        placeholder="works"
        aria-label="Word to exclude"
        className={`w-28 ${TPL_INPUT}`}
      />
    </TemplateRow>
  );
}

/** G26 in:romans, answered by the original-language search page */
function StrongsTemplate() {
  const [id, setId] = useState("");
  const [book, setBook] = useState("");
  const resolved = resolveBookName(book);
  const sid = id.trim().toUpperCase();
  const ready = /^[GH]\d{1,5}$/.test(sid) && resolved !== undefined;
  const q = ready ? `${sid} in:${resolved!.slug}` : "";
  return (
    <TemplateRow label="Strong's number in a book" ready={ready} preview={q}>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="G26"
        aria-label="Strong's number"
        className={`w-20 ${TPL_INPUT}`}
      />
      <span className="text-[0.72rem] text-muted">in</span>
      <input
        value={book}
        onChange={(e) => setBook(e.target.value)}
        placeholder="romans"
        aria-label="Book"
        className={`w-24 ${TPL_INPUT}`}
      />
      {ready ? (
        <Link href={`/search?mode=original&q=${encodeURIComponent(q)}`} className={TPL_RUN}>
          Search
        </Link>
      ) : (
        <button type="submit" disabled className={TPL_RUN}>
          Search
        </button>
      )}
      <span className="text-[0.68rem] text-muted">runs on the original-language search page</span>
    </TemplateRow>
  );
}
