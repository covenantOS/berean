"use client";

import { useEffect, useMemo, useState } from "react";
import { CANON } from "@/lib/canon";
import type {
  ConcordanceEntry,
  ConcordanceMode,
  ConcordancePayload,
} from "@/lib/concordance";
import { useWorkspace } from "./WorkspaceContext";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; report: ConcordancePayload };

type SortOrder = "freq" | "alpha";

/** The verses one expanded entry lists before the rest fold behind a note. */
const REF_LIST_CAP = 100;

/**
 * The Concordance pane: one book, pinned at open time, every word or lemma
 * in it counted and listed with its verses. English words come from the
 * tagged KJV with a function-word stoplist folding the crowd away (a toggle
 * brings it back); lemmas come from the original-language apparatus with
 * Strong's id, gloss, and part of speech. The book's pericope headings and
 * (in lemma mode) parts of speech stand as facets, beside a filter box and
 * frequency or alphabetical order. An entry expands to its verses in place;
 * a verse opens the passage in the pane.
 */
export default function ConcordancePane({
  paneId,
  tabId,
  book,
}: {
  paneId: string;
  tabId: string;
  book: string;
}) {
  const { dispatch } = useWorkspace();
  const [mode, setMode] = useState<ConcordanceMode>("words");
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<SortOrder>("freq");
  const [filter, setFilter] = useState("");
  const [posFacet, setPosFacet] = useState("");
  const [periFacet, setPeriFacet] = useState(-1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    const q = new URLSearchParams({ book, mode, ...(showAll ? { all: "1" } : {}) });
    fetch(`/api/pane/concordance?${q}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", report: (await res.json()) as ConcordancePayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, mode, showAll]);

  /* A new book or mode starts the facets and the drill-down over. */
  useEffect(() => {
    setFilter("");
    setPosFacet("");
    setPeriFacet(-1);
    setExpanded(null);
  }, [book, mode]);

  const report = load.status === "ready" ? load.report : null;

  const posOptions = useMemo(() => {
    if (!report) return [];
    const set = new Set<string>();
    for (const e of report.entries) for (const p of e.pos ?? []) set.add(p);
    return [...set].sort();
  }, [report]);

  const entries = useMemo(() => {
    if (!report) return [];
    const needle = filter.trim().toLowerCase();
    const peri = periFacet >= 0 ? report.pericopes[periFacet] : null;
    const inPeri = (ref: [number, number]) =>
      !peri ||
      ((ref[0] > peri.from[0] || (ref[0] === peri.from[0] && ref[1] >= peri.from[1])) &&
        (ref[0] < peri.to[0] || (ref[0] === peri.to[0] && ref[1] <= peri.to[1])));
    const kept = report.entries
      .map((e) => {
        const refs = peri ? e.refs.filter(inPeri) : e.refs;
        return { ...e, refs, count: peri ? refs.length : e.count };
      })
      .filter((e) => e.count > 0)
      .filter((e) => !posFacet || (e.pos ?? []).includes(posFacet))
      .filter(
        (e) =>
          !needle ||
          e.display.toLowerCase().includes(needle) ||
          (e.gloss ?? "").toLowerCase().includes(needle) ||
          (e.strongs ?? "").toLowerCase().includes(needle) ||
          (e.xlit ?? "").toLowerCase().includes(needle)
      );
    if (sort === "alpha") {
      return [...kept].sort((a, b) => a.display.localeCompare(b.display));
    }
    return [...kept].sort((a, b) => b.count - a.count || a.display.localeCompare(b.display));
  }, [report, filter, posFacet, periFacet, sort]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Composing the concordance…</p>;
  }
  if (load.status === "error" || !report) {
    return <p className="text-xs text-muted">This book could not be concorded.</p>;
  }

  const lemmaLabel = report.lang === "hebrew" ? "Hebrew lemmas" : "Greek lemmas";
  const toggleBtn = (on: boolean) =>
    `border px-2 py-0.5 text-[0.68rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
      on ? "border-sapphire text-sapphire" : "border-rule text-muted hover:text-ink"
    }`;

  return (
    <div className="mx-auto max-w-prose space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Concordance</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">
          <select
            aria-label="Concordance book"
            value={report.book}
            onChange={(e) =>
              dispatch({ type: "setConcordanceBook", paneId, tabId, book: e.target.value })
            }
            className="cursor-pointer border border-transparent bg-transparent font-editorial text-lg font-semibold hover:border-rule focus:border-sapphire focus:outline-none"
          >
            {CANON.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.68rem]">
          <button type="button" className={toggleBtn(mode === "words")} onClick={() => setMode("words")}>
            English words
          </button>
          <button
            type="button"
            className={toggleBtn(mode === "lemmas")}
            onClick={() => setMode("lemmas")}
          >
            {lemmaLabel}
          </button>
          <span className="ml-1 text-muted">
            {entries.length.toLocaleString()} {entries.length === 1 ? "entry" : "entries"} ·{" "}
            {report.tokens.toLocaleString()} tokens
          </span>
        </p>
        <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted">
          {report.stopped.tokens > 0 ? (
            <>
              {report.stopped.tokens.toLocaleString()} function words across{" "}
              {report.stopped.entries} entries are folded away.{" "}
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Include them
              </button>
            </>
          ) : (
            <>Function words are listed. </>
          )}
          An entry expands to its verses.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filter}
          aria-label="Filter entries"
          placeholder={mode === "words" ? "Filter words" : "Filter lemmas, glosses, Strong's"}
          onChange={(e) => setFilter(e.target.value)}
          className="min-w-40 flex-1 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
        />
        <select
          aria-label="Sort order"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOrder)}
          className="border border-rule bg-paper px-1.5 py-1 text-xs text-ink focus:border-sapphire focus:outline-none"
        >
          <option value="freq">By frequency</option>
          <option value="alpha">A to Z</option>
        </select>
        {posOptions.length > 1 && (
          <select
            aria-label="Part of speech"
            value={posFacet}
            onChange={(e) => setPosFacet(e.target.value)}
            className="border border-rule bg-paper px-1.5 py-1 text-xs text-ink focus:border-sapphire focus:outline-none"
          >
            <option value="">Every part of speech</option>
            {posOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        {report.pericopes.length > 0 && (
          <select
            aria-label="Pericope"
            value={periFacet}
            onChange={(e) => setPeriFacet(Number(e.target.value))}
            className="max-w-56 border border-rule bg-paper px-1.5 py-1 text-xs text-ink focus:border-sapphire focus:outline-none"
          >
            <option value={-1}>Every heading</option>
            {report.pericopes.map((p, i) => (
              <option key={i} value={i}>
                {p.ref} {p.heading}
              </option>
            ))}
          </select>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted">No entries match.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {entries.map((e) => (
            <ConcordanceRow
              key={e.key}
              entry={e}
              report={report}
              expanded={expanded === e.key}
              onToggle={() => setExpanded(expanded === e.key ? null : e.key)}
              onOpen={(chapter) => dispatch({ type: "openRef", book: report.book, chapter, paneId })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConcordanceRow({
  entry,
  report,
  expanded,
  onToggle,
  onOpen,
}: {
  entry: ConcordanceEntry;
  report: ConcordancePayload;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (chapter: number) => void;
}) {
  const shown = entry.refs.slice(0, REF_LIST_CAP);
  return (
    <li>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-baseline gap-2 py-1 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        <span className={`text-[0.85rem] ${report.mode === "lemmas" ? "font-editorial" : ""}`}>
          {entry.display}
        </span>
        {entry.strongs && (
          <span className="text-[0.62rem] font-semibold text-sapphire">{entry.strongs}</span>
        )}
        {entry.xlit && <span className="text-[0.68rem] text-muted italic">{entry.xlit}</span>}
        {entry.gloss && (
          <span className="min-w-0 flex-1 truncate text-[0.68rem] text-muted">{entry.gloss}</span>
        )}
        {!entry.gloss && <span className="flex-1" />}
        {entry.pos && entry.pos.length > 0 && (
          <span className="hidden text-[0.62rem] text-muted sm:inline">{entry.pos.join(", ")}</span>
        )}
        <span className="shrink-0 text-[0.68rem] font-semibold text-ink">
          ×{entry.count.toLocaleString()}
        </span>
      </button>
      {expanded && (
        <div className="space-y-1 pb-2 pl-3">
          {shown.map(([c, v]) => (
            <p key={`${c}:${v}`} className="text-[0.78rem] leading-relaxed">
              <button
                type="button"
                title={`Open ${report.bookName} ${c}`}
                onClick={() => onOpen(c)}
                className="small-caps mr-2 align-super text-[0.62rem] font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {c}:{v}
              </button>
              {report.texts[`${c}:${v}`] ?? ""}
            </p>
          ))}
          {entry.refs.length > shown.length && (
            <p className="text-[0.68rem] text-muted">
              First {shown.length} of {entry.refs.length.toLocaleString()} occurrences.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
