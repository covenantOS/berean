"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { alignedChapter, alignedScope, alignedTextIds, type AlignedChapterPayload } from "@/lib/aligned";
import { CANON, getBook, resolveBookName } from "@/lib/canon";
import { listDocuments } from "@/lib/documents";
import { HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/highlights";
import {
  GREEK_FILTER_DEFS,
  HEBREW_FILTER_DEFS,
  type FilterDef,
} from "@/lib/morphfilters";
import { recordSearch, toggleFavorite, useSearchSaves } from "@/lib/search-history";
import { playSound } from "@/lib/sound";
import { createVisualFilter } from "@/lib/visualfilters";
import { translationShelf } from "./ReaderPane";
import SearchChart, { type ChartKind, type ChartSlice } from "./SearchChart";
import PrintButton from "./PrintButton";
import { useWorkspaceDispatch } from "./WorkspaceContext";
import { preferredTranslation, searchTab, type SearchMode } from "./workspace-state";

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
type View = "verses" | "aligned" | "grid" | "analysis" | "chart";

const VIEWS: { key: View; label: string }[] = [
  { key: "verses", label: "Verses" },
  { key: "aligned", label: "Aligned" },
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

interface PaneProps {
  q: string;
  mode?: SearchMode;
  paneId: string;
  tabId: string;
}

/**
 * The search pane, opened by the omnibox's berean:search event. The tab's
 * mode picks the engine: "bible" is the precise KJV concordance, "original"
 * the morphology-aware Greek and Hebrew search, "semantic" search by
 * meaning. The header's mode switch re-asks the same query of another
 * engine, in place.
 */
export default function SearchPane({ q, mode = "bible", paneId, tabId }: PaneProps) {
  if (mode === "original") return <OriginalPane q={q} paneId={paneId} tabId={tabId} />;
  if (mode === "semantic") return <SemanticPane q={q} paneId={paneId} tabId={tabId} />;
  return <BiblePane q={q} paneId={paneId} tabId={tabId} />;
}

/* ---------- The mode switch, shared by every engine's header ---------- */

const SEARCH_MODES: { key: SearchMode; label: string; title: string }[] = [
  { key: "bible", label: "Bible", title: "The precise KJV concordance" },
  {
    key: "original",
    label: "Original",
    title: "Lemma, Strong's number, or script letters over the tagged Greek and Hebrew, narrowed by parsing",
  },
  {
    key: "semantic",
    label: "Meaning",
    title: "Name a concept; the Scribe names passages, each verified against the canon",
  },
];

/** Re-asks the tab's query of another engine, replacing the tab in place. */
function ModeSwitch({ q, mode, paneId, tabId }: { q: string; mode: SearchMode; paneId: string; tabId: string }) {
  const { dispatch } = useWorkspaceDispatch();
  return (
    <span className="seg no-print ml-3" role="group" aria-label="Search mode">
      {SEARCH_MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          title={m.title}
          aria-pressed={mode === m.key}
          onClick={() => {
            if (m.key === mode) return;
            dispatch({ type: "replaceTab", paneId, tabId, tab: searchTab(q, m.key) });
          }}
        >
          {m.label}
        </button>
      ))}
    </span>
  );
}

/* ---------- Bible: the precise concordance ---------- */

/**
 * The concordance pane: opened by the omnibox's berean:search event. One
 * fetch to /api/pane/search carries the whole working set; the Verses,
 * Grid, Analysis, and Chart arrangements are different readings of that
 * same set, computed on the client, never re-fetched, while the Aligned
 * arrangement batches the hit set's chapters through the multiview route,
 * the payloads cached in src/lib/aligned.ts so returning to the view
 * re-reads the cache.
 * Every row in every view dispatches berean:open-ref, carrying the pane to
 * the passage. The header pin keeps the query among the Search rail's
 * pinned searches.
 */
function BiblePane({ q, paneId, tabId }: PaneProps) {
  const { dispatch } = useWorkspaceDispatch();
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
   * history records it, and a fresh search pane answers it. The Strong's
   * form passes "original", so its query goes to the morph engine. */
  const runGenerated = (generated: string, mode: SearchMode = "bible") => {
    recordSearch(generated, mode);
    dispatch({ type: "openSearch", q: generated, mode });
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
        <ModeSwitch q={q} mode="bible" paneId={paneId} tabId={tabId} />
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
        <div className="fx-fade no-print shrink-0 border-b border-rule px-4 py-2">
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
        <div className="fx-fade no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-rule px-4 py-2">
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
            className="fx-press border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
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
          <div key={view} className="fx-fade">
            {view === "verses" && <VersesView hits={load.hits} total={load.total} />}
            {view === "aligned" && <AlignedView hits={load.hits} total={load.total} />}
            {view === "grid" && <GridView hits={load.hits} total={load.total} />}
            {view === "analysis" && (
              <AnalysisView books={books} total={load.total} truncated={truncated} listed={load.hits.length} />
            )}
            {view === "chart" && (
              <ChartView key={q} books={books} truncated={truncated} listed={load.hits.length} />
            )}
          </div>
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
              className="block w-full py-3 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
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

/* ---------- Aligned: hit verses in more than one translation ---------- */

type AlignedLoad =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; chapters: Map<string, AlignedChapterPayload> };

/**
 * The Aligned arrangement: each hit verse in the reader's preferred text
 * beside the KJV and one more witness, the multiview report fetched once
 * per chapter the capped hit set touches (src/lib/aligned.ts). Rows align
 * by verse number under each text's own numbering, a verse a text does not
 * number naming the gap, the multiview pane's discipline. The payloads
 * cache at module scope, so leaving the view and returning re-reads the
 * cache rather than fetching again; the cap keeps the first batch honest:
 * the first ALIGNED_HIT_CAP hits align, and the header note says so when
 * the set runs longer.
 */
function AlignedView({ hits, total }: { hits: Hit[]; total: number }) {
  const scope = useMemo(() => alignedScope(hits), [hits]);
  const [load, setLoad] = useState<AlignedLoad>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    translationShelf()
      .then((shelf) => {
        const hasNT = scope.hits.some((h) => getBook(h.book)?.testament === "NT");
        const texts = alignedTextIds(preferredTranslation(), shelf, hasNT).join(",");
        return Promise.all(scope.chapters.map((c) => alignedChapter(c.book, c.chapter, texts)));
      })
      .then((payloads) => {
        if (cancelled) return;
        setLoad({
          status: "ready",
          chapters: new Map(scope.chapters.map((c, i) => [c.key, payloads[i]])),
        });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  /* The fetched chapters share one column set (the request resolves against
   * the shelf first), so the header row reads from any payload. */
  const columns = useMemo(() => {
    if (load.status !== "ready") return [];
    const first = load.chapters.values().next().value;
    return first ? first.columns.map((c) => ({ id: c.id, abbrev: c.abbrev, name: c.name })) : [];
  }, [load]);

  /* Cell lookup by verse number, one map per chapter per column. */
  const cellText = useMemo(() => {
    if (load.status !== "ready") return new Map<string, Map<string, Map<number, string>>>();
    const out = new Map<string, Map<string, Map<number, string>>>();
    for (const [key, p] of load.chapters) {
      out.set(
        key,
        new Map(p.columns.map((c) => [c.id, new Map(c.verses.map((v) => [v.verse, v.text]))]))
      );
    }
    return out;
  }, [load]);

  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-xs text-muted">
        {total.toLocaleString()} {total === 1 ? "verse answers" : "verses answer"}
        {total > scope.hits.length
          ? `; the first ${scope.hits.length.toLocaleString()} are aligned`
          : ""}
        {columns.length > 0 ? `, each in ${columns.map((c) => c.abbrev).join(" · ")}` : ""}.
      </p>
      {load.status === "loading" && (
        <p className="py-8 text-center text-xs text-muted">Laying out the columns…</p>
      )}
      {load.status === "error" && (
        <p className="py-8 text-center text-xs text-muted">The columns could not be laid out.</p>
      )}
      {load.status === "ready" && (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `6.5rem repeat(${columns.length}, minmax(0, 1fr))`,
          }}
        >
          <div aria-hidden="true" className="sticky top-0 z-10 border-b border-rule bg-surface" />
          {columns.map((c) => (
            <div
              key={c.id}
              className="sticky top-0 z-10 border-b border-l border-rule bg-surface px-3 py-1.5"
            >
              <span className="small-caps text-xs font-semibold text-muted" title={c.name}>
                {c.abbrev}
              </span>
            </div>
          ))}
          {scope.hits.map((h) => {
            const chapter = load.chapters.get(`${h.book}:${h.chapter}`);
            return (
              <Fragment key={`${h.book}-${h.chapter}-${h.verse}`}>
                <div className="border-b border-rule/50 py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => openRef(h.book, h.chapter, h.verse)}
                    className="small-caps text-[0.7rem] font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    {h.bookName} {h.chapter}:{h.verse}
                  </button>
                </div>
                {columns.map((c) => {
                  const column = chapter?.columns.find((x) => x.id === c.id);
                  const cell = cellText.get(`${h.book}:${h.chapter}`)?.get(c.id)?.get(h.verse);
                  return (
                    <div
                      key={c.id}
                      className="border-b border-l border-rule/50 px-3 py-2 font-reader text-[0.84rem] leading-relaxed"
                    >
                      {cell !== undefined ? (
                        cell
                      ) : (
                        <span className="text-[0.68rem] text-muted">
                          {column?.missing
                            ? `No ${h.bookName} ${h.chapter} under this text's numbering.`
                            : `No verse ${h.verse} under this text's numbering.`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      )}
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
  "fx-press border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink no-underline hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

/**
 * The templates strip: a small set of forms for the questions the precise
 * grammar answers, so the syntax is never a prerequisite. Each form builds
 * its query live under the inputs; running one dispatches an ordinary
 * search. The Strong's form is the exception: Greek and Hebrew numbers are
 * original-language questions, so it runs in the pane's original mode,
 * which answers them; the concordance never sees the query.
 */
function TemplatesPanel({ onRun }: { onRun: (q: string, mode?: SearchMode) => void }) {
  return (
    <div className="fx-fade no-print shrink-0 border-b border-rule px-4 py-2">
      <p className="pb-1 text-[0.72rem] text-muted">
        Fill a form and the query writes itself; it runs as an ordinary search and enters the
        rail&apos;s history.
      </p>
      <NearTemplate onRun={onRun} />
      <PhraseTemplate onRun={onRun} />
      <AnyOfTemplate onRun={onRun} />
      <WithoutTemplate onRun={onRun} />
      <StrongsTemplate onRun={onRun} />
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

/** G26 in:romans, answered by the pane's original-language mode */
function StrongsTemplate({ onRun }: { onRun: (q: string, mode?: SearchMode) => void }) {
  const [id, setId] = useState("");
  const [book, setBook] = useState("");
  const resolved = resolveBookName(book);
  const sid = id.trim().toUpperCase();
  const ready = /^[GH]\d{1,5}$/.test(sid) && resolved !== undefined;
  const q = ready ? `${sid} in:${resolved!.slug}` : "";
  return (
    <TemplateRow label="Strong's number in a book" ready={ready} onRun={() => onRun(q, "original")} preview={q}>
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
      <span className="text-[0.68rem] text-muted">runs in the original-language mode</span>
    </TemplateRow>
  );
}

/* ---------- Original: the morphology-aware Greek and Hebrew search ---------- */

interface MorphMatch {
  t: string;
  parsing: string;
  gloss?: string;
  strongs?: string;
}

interface MorphHit {
  book: string;
  bookName: string;
  testament: "OT" | "NT";
  chapter: number;
  verse: number;
  /** Original-language surface text of the verse. */
  text: string;
  matches: MorphMatch[];
}

type MorphLoad =
  | { status: "loading" }
  | { status: "error" }
  | { status: "invalid"; message: string }
  | { status: "ready"; hits: MorphHit[]; total: number; verses: number; lang: string };

/**
 * The original-language mode: the /search page's morph search carried into
 * the workspace. The query takes a lemma, a transliteration, a Strong's
 * number, or letters in the script, with in: scoping; the "Narrow by
 * parsing" strip adds the Greek and Hebrew morphology filters. One fetch to
 * /api/pane/morph carries the working set; the Verses view keeps the old
 * page's parsing and gloss display, while Aligned, Grid, Analysis, and
 * Chart read the hits as the verse list they group into. A matched word with a plain
 * Strong's number opens its word study. Filter-only searches stay with the
 * /search page: a workspace tab keys on its query, so a question with no
 * query has nothing to persist or re-run.
 */
function OriginalPane({ q, paneId, tabId }: PaneProps) {
  const { dispatch } = useWorkspaceDispatch();
  const [load, setLoad] = useState<MorphLoad>({ status: "loading" });
  const [view, setView] = useState<View>("verses");
  const { favorites } = useSearchSaves();
  const pinned = favorites.some(
    (f) => f.q.toLowerCase() === q.trim().toLowerCase() && (f.mode ?? "bible") === "original"
  );
  /** The parsing filters; any change re-runs the fetch. */
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [namingFilter, setNamingFilter] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterColor, setFilterColor] = useState<HighlightColor>("sapphire");
  const [filterSaved, setFilterSaved] = useState(false);

  /* The query form re-asks the question in place: the rail's history
   * records it under "original", and the tab wears the new query. */
  const runQuery = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = String(new FormData(e.currentTarget).get("mq") ?? "").trim();
    if (!query) return;
    recordSearch(query, "original");
    playSound("navigate");
    dispatch({ type: "replaceTab", paneId, tabId, tab: searchTab(query, "original") });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    const params = new URLSearchParams({ q });
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    fetch(`/api/pane/morph?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          hits: MorphHit[];
          total: number;
          verses: number;
          lang: string;
          error?: string;
        };
        if (data.error) setLoad({ status: "invalid", message: data.error });
        else {
          setLoad({
            status: "ready",
            hits: data.hits,
            total: data.total,
            verses: data.verses,
            lang: data.lang,
          });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [q, filters]);

  /* Grid, Analysis, and Chart read the same verse-list shape the Bible
   * pane's arrangements do, so the verse-grouped hits map down to it. */
  const verseHits: Hit[] = useMemo(
    () =>
      load.status === "ready"
        ? load.hits.map((h) => ({
            book: h.book,
            bookName: h.bookName,
            chapter: h.chapter,
            verse: h.verse,
            text: h.text,
          }))
        : [],
    [load]
  );
  const books = useMemo(() => aggregate(verseHits), [verseHits]);
  const truncated = load.status === "ready" && load.verses > load.hits.length;

  /* The visual filter handoff, as in the Bible pane: the fetched verses
   * become a named, tinted set of marks in the reader. */
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
          <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">
            Original languages
          </span>
        </h2>
        <ModeSwitch q={q} mode="original" paneId={paneId} tabId={tabId} />
        <button
          type="button"
          title={pinned ? "Remove this search from the pinned list" : "Pin this search in the Search rail"}
          onClick={() => toggleFavorite(q, "original")}
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
          title="Narrow by parsing: part of speech, tense, case, stem, and more"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
          className={`no-print ml-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
            showFilters ? "text-sapphire" : "text-muted hover:text-ink"
          }`}
        >
          Parsing
        </button>
        <PrintButton className="ml-3" />
      </header>
      <form onSubmit={runQuery} className="no-print flex shrink-0 gap-2 border-b border-rule px-4 py-2">
        <input
          key={q}
          type="search"
          name="mq"
          defaultValue={q}
          placeholder="Lemma, transliteration, Strong's (G25, H1254), or letters in the script (λογ, ברא)"
          aria-label="Search the Greek and Hebrew text"
          className="w-full border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <button
          type="submit"
          className="fx-press border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Search
        </button>
      </form>
      {showFilters && (
        <div className="fx-fade no-print shrink-0 border-b border-rule px-4 py-2">
          <p className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
            Greek (New Testament)
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pb-2 sm:grid-cols-4">
            {GREEK_FILTER_DEFS.map((def) => (
              <ParsingSelect key={def.key} def={def} filters={filters} onChange={setFilters} />
            ))}
          </div>
          <p className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
            Hebrew (Old Testament)
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {HEBREW_FILTER_DEFS.map((def) => (
              <ParsingSelect key={def.key} def={def} filters={filters} onChange={setFilters} />
            ))}
          </div>
        </div>
      )}
      {namingFilter && load.status === "ready" && (
        <div className="fx-fade no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-rule px-4 py-2">
          <label htmlFor="vf-name-orig" className="text-[0.72rem] text-muted">
            Filter name
          </label>
          <input
            id="vf-name-orig"
            autoFocus
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveFilter();
              if (e.key === "Escape") setNamingFilter(false);
            }}
            className="w-56 border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus-visible:outline-sapphire"
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
            className="fx-press border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
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
              The first {load.hits.length.toLocaleString()} of {load.verses.toLocaleString()}{" "}
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
          <p className="px-6 py-8 text-center text-xs text-muted">
            Searching the tagged Greek and Hebrew…
          </p>
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
            Nothing in the tagged{" "}
            {load.lang === "hebrew" ? "Hebrew" : load.lang === "greek" ? "Greek" : "original"}{" "}
            text answers to “{q}”
            {Object.values(filters).some(Boolean) ? " with those filters" : ""}.
          </p>
        )}
        {load.status === "ready" && load.total > 0 && (
          <div key={view} className="fx-fade">
            {view === "verses" && (
              <OriginalVersesView hits={load.hits} total={load.total} verses={load.verses} />
            )}
            {view === "aligned" && <AlignedView hits={verseHits} total={load.verses} />}
            {view === "grid" && <GridView hits={verseHits} total={load.verses} />}
            {view === "analysis" && (
              <AnalysisView books={books} total={load.verses} truncated={truncated} listed={verseHits.length} />
            )}
            {view === "chart" && (
              <ChartView
                key={`${q}:${JSON.stringify(filters)}`}
                books={books}
                truncated={truncated}
                listed={verseHits.length}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** One parsing filter: a labeled select feeding the pane's filter state. */
function ParsingSelect({
  def,
  filters,
  onChange,
}: {
  def: FilterDef;
  filters: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[0.68rem] text-muted">
      {def.label}
      <select
        value={filters[def.key] ?? ""}
        onChange={(e) => onChange({ ...filters, [def.key]: e.target.value })}
        className="border border-rule bg-paper px-1.5 py-1 text-[0.75rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
      >
        <option value="">any</option>
        {def.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/* Verses: the old page's reading list, matched words marked, parsings listed */
function OriginalVersesView({
  hits,
  total,
  verses,
}: {
  hits: MorphHit[];
  total: number;
  verses: number;
}) {
  const { dispatch } = useWorkspaceDispatch();
  return (
    <div className="mx-auto max-w-prose px-6 py-4">
      <p className="mb-3 text-xs text-muted">
        {total.toLocaleString()} {total === 1 ? "occurrence" : "occurrences"} in{" "}
        {verses.toLocaleString()} {verses === 1 ? "verse" : "verses"}
        {verses > hits.length ? `; the first ${hits.length} verses are listed` : ""}.
      </p>
      <ul>
        {hits.map((h) => {
          const matched = new Set(h.matches.map((m) => m.t));
          return (
            <li key={`${h.book}-${h.chapter}-${h.verse}`} className="border-b border-rule/60 py-3">
              <button
                type="button"
                onClick={() => openRef(h.book, h.chapter, h.verse)}
                className="small-caps text-sm font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {h.bookName} {h.chapter}:{h.verse}
              </button>
              <p
                className={`mt-0.5 text-lg leading-relaxed ${
                  h.testament === "OT" ? "lang-hebrew" : "lang-greek"
                }`}
                dir={h.testament === "OT" ? "rtl" : "ltr"}
              >
                {h.text.split(" ").map((w, i) =>
                  matched.has(w) ? (
                    <mark key={i} className="rounded-[2px] bg-amber/25 px-0.5">
                      {w}{" "}
                    </mark>
                  ) : (
                    <span key={i}>{w} </span>
                  )
                )}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {h.matches.map((m, i) => (
                  <li key={i}>
                    <span className={h.testament === "OT" ? "lang-hebrew" : "lang-greek"}>
                      {m.t}
                    </span>
                    {" · "}
                    {m.parsing}
                    {m.gloss ? ` · “${m.gloss}”` : ""}
                    {m.strongs ? (
                      <>
                        {" · "}
                        {/^[GH]\d{1,5}$/i.test(m.strongs) ? (
                          <button
                            type="button"
                            title={`Open the word study for ${m.strongs}`}
                            onClick={() => dispatch({ type: "openWordStudy", strongsId: m.strongs! })}
                            className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                          >
                            {m.strongs}
                          </button>
                        ) : (
                          m.strongs
                        )}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Semantic: search by meaning, every reference verified ---------- */

interface SemanticHit {
  ref: string;
  book: string;
  chapter: number;
  from: number;
  to: number;
  text: string;
  reason: string;
}

type SemanticLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; hits: SemanticHit[]; withheld: { ref: string; reason: string }[] };

/**
 * Search by meaning: the /search page's semantic mode carried into the
 * workspace. The concept posts to /api/semantic, where the Scribe's
 * candidate references are verified against the actual canon before one is
 * shown; anything unverifiable is withheld and reported. The result is a
 * curated handful of passages, not a result set, so the Verses, Grid,
 * Analysis, and Chart arrangements do not apply: counting and charting a
 * curation would dress judgment up as frequency.
 */
function SemanticPane({ q, paneId, tabId }: PaneProps) {
  const { dispatch } = useWorkspaceDispatch();
  const [load, setLoad] = useState<SemanticLoad>({ status: "loading" });
  const { favorites } = useSearchSaves();
  const pinned = favorites.some(
    (f) => f.q.toLowerCase() === q.trim().toLowerCase() && (f.mode ?? "bible") === "semantic"
  );
  const [scope, setScope] = useState("all");
  /** The scope the answered question used; the select applies on submit. */
  const [appliedScope, setAppliedScope] = useState("all");

  /* The concept form re-asks the question in place, the way the original
   * mode's does; a same-concept submit applies the scope. */
  const runQuery = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const concept = String(new FormData(e.currentTarget).get("sq") ?? "").trim();
    if (concept.length < 3) return;
    recordSearch(concept, "semantic");
    playSound("navigate");
    setAppliedScope(scope);
    if (concept.toLowerCase() !== q.trim().toLowerCase()) {
      dispatch({ type: "replaceTab", paneId, tabId, tab: searchTab(concept, "semantic") });
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch("/api/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: q, scope: appliedScope }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          hits?: SemanticHit[];
          withheld?: { ref: string; reason: string }[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        setLoad({ status: "ready", hits: data.hits ?? [], withheld: data.withheld ?? [] });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({
          status: "error",
          message: err instanceof Error ? err.message : "The search could not be completed.",
        });
      });
    return () => controller.abort();
  }, [q, appliedScope]);

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col" data-print-root>
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          “{q}”
          <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">By meaning</span>
        </h2>
        <ModeSwitch q={q} mode="semantic" paneId={paneId} tabId={tabId} />
        <button
          type="button"
          title={pinned ? "Remove this search from the pinned list" : "Pin this search in the Search rail"}
          onClick={() => toggleFavorite(q, "semantic")}
          className="no-print ml-auto text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {pinned ? "Pinned" : "Pin search"}
        </button>
        <PrintButton className="ml-3" />
      </header>
      <form onSubmit={runQuery} className="no-print flex shrink-0 gap-2 border-b border-rule px-4 py-2">
        <input
          key={q}
          type="search"
          name="sq"
          defaultValue={q}
          placeholder="e.g. covenant faithfulness, the fear of the LORD"
          aria-label="Search by meaning"
          className="w-full border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          aria-label="Range"
          className="border border-rule bg-paper px-1.5 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        >
          <option value="all">Whole canon</option>
          <option value="ot">Old Testament</option>
          <option value="nt">New Testament</option>
        </select>
        <button
          type="submit"
          className="fx-press border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Search
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-prose px-6 py-4">
          <p className="mb-3 text-xs text-muted">
            Name a concept and the Scribe names passages that bear on it. Every reference is
            verified against the canon before it is shown; the text you read is the actual KJV,
            not the model&apos;s words.
          </p>
          {load.status === "loading" && (
            <p className="py-8 text-center text-xs text-muted">Asking the Scribe…</p>
          )}
          {load.status === "error" && (
            <p className="border border-rule bg-surface p-4 text-xs text-muted">{load.message}</p>
          )}
          {load.status === "ready" && (
            <div className="fx-fade">
              <p className="small-caps mb-4 border-b border-rule pb-2 text-xs text-muted">
                {load.hits.length} verified {load.hits.length === 1 ? "passage" : "passages"}
              </p>
              <ul>
                {load.hits.map((h) => (
                  <li
                    key={`${h.book}-${h.chapter}-${h.from}-${h.to}`}
                    className="border-b border-rule/60"
                  >
                    <button
                      type="button"
                      onClick={() => openRef(h.book, h.chapter, h.from)}
                      className="block w-full py-3 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      <span className="small-caps text-sm font-medium text-sapphire">
                        {h.ref}
                      </span>
                      <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed">
                        {h.text}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{h.reason}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {load.hits.length === 0 && (
                <p className="text-xs text-muted">
                  The Scribe offered nothing that could be verified for “{q}”.
                </p>
              )}
              {load.withheld.length > 0 && (
                <p className="mt-6 border-t border-rule pt-4 text-xs text-muted">
                  {load.withheld.length}{" "}
                  {load.withheld.length === 1 ? "suggestion was" : "suggestions were"} withheld
                  because {load.withheld.length === 1 ? "it" : "they"} could not be verified
                  against the canon
                  {load.withheld.length <= 3
                    ? `: ${load.withheld.map((w) => w.ref).join(", ")}`
                    : ""}
                  .
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
