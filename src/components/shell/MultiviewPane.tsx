"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { adjacentChapter, getBook } from "@/lib/canon";
import { translationShelf, type ShelfTranslation } from "./ReaderPane";
import { useWorkspace } from "./WorkspaceContext";
import { MULTIVIEW_TEXTS_MAX, MULTIVIEW_TEXTS_MIN } from "./workspace-state";

interface MultiviewColumn {
  id: string;
  abbrev: string;
  name: string;
  /** The LXX numbering note where the Septuagint counts differently. */
  note: string | null;
  /** True when the text has no such chapter at all. */
  missing: boolean;
  verses: { verse: number; text: string }[];
}

interface MultiviewPayload {
  book: string;
  bookName: string;
  chapter: number;
  chapters: number;
  /** The row anchor: every verse number any column carries, in order. */
  verses: number[];
  columns: MultiviewColumn[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; report: MultiviewPayload };

const CTRL =
  "border border-rule bg-paper px-1.5 py-0.5 text-xs text-ink hover:border-sapphire disabled:opacity-40 disabled:hover:border-rule focus:border-sapphire focus:outline-none";

/**
 * The Multiview pane: one chapter read in two to four translations at once,
 * the columns verse-aligned inside a single pane (the Logos multiview).
 * Shared scrolling is the default: one scroll container carries a verse-row
 * grid, so a row's height is its tallest cell and the columns stay aligned
 * verse for verse. The Independent toggle gives each column its own scroll,
 * an honest trade: alignment lets go with it. A verse a text does not number
 * names the gap rather than aligning it away, and LXX columns wear the
 * numbering note the reader and the comparison already carry. The column set
 * lives on the tab; adding or removing a column dispatches in place.
 */
export default function MultiviewPane({
  paneId,
  tabId,
  book,
  chapter,
  texts,
}: {
  paneId: string;
  tabId: string;
  book: string;
  chapter: number;
  texts: string[];
}) {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [shelf, setShelf] = useState<ShelfTranslation[]>([]);
  /** False is the shared scroll; true gives each column its own. */
  const [independent, setIndependent] = useState(false);

  useEffect(() => {
    let live = true;
    translationShelf().then((t) => {
      if (live) setShelf(t);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    const q = new URLSearchParams({
      book,
      chapter: String(chapter),
      texts: texts.join(","),
    });
    fetch(`/api/pane/multiview?${q}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", report: (await res.json()) as MultiviewPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter, texts]);

  /* The add-column choices: the book's shelf minus the columns standing. */
  const addable = useMemo(() => {
    const testament = getBook(book)?.testament ?? "OT";
    return shelf.filter(
      (t) => (testament === "OT" || !t.otOnly) && !texts.includes(t.id)
    );
  }, [shelf, book, texts]);

  const go = (dir: -1 | 1) => {
    const next = adjacentChapter(book, chapter, dir);
    if (next) {
      dispatch({ type: "setMultiviewRef", paneId, tabId, book: next.book.slug, chapter: next.chapter });
    }
  };

  const removeColumn = (id: string) => {
    dispatch({ type: "setMultiviewTexts", paneId, tabId, texts: texts.filter((t) => t !== id) });
  };

  const addColumn = (id: string) => {
    if (id) dispatch({ type: "setMultiviewTexts", paneId, tabId, texts: [...texts, id] });
  };

  /** A column's head: its abbrev, its notes, and its close control. */
  const columnHead = (c: MultiviewColumn, report: MultiviewPayload) => (
    <>
      <p className="flex items-baseline gap-1.5">
        <span className="small-caps text-xs font-semibold text-muted" title={c.name}>
          {c.abbrev}
        </span>
        <button
          type="button"
          aria-label={`Remove the ${c.abbrev} column`}
          disabled={texts.length <= MULTIVIEW_TEXTS_MIN}
          onClick={() => removeColumn(c.id)}
          className="ml-auto px-0.5 text-[0.85rem] leading-none text-muted hover:text-ruby disabled:opacity-30 disabled:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          ×
        </button>
      </p>
      {c.note && <p className="mt-1 text-[0.68rem] leading-relaxed text-muted">{c.note}</p>}
      {c.missing && (
        <p className="mt-1 text-[0.68rem] leading-relaxed text-muted">
          No {report.bookName} {report.chapter} under this text's numbering.
        </p>
      )}
    </>
  );

  const ready = load.status === "ready" ? load.report : null;

  /* Cell lookup by verse number, one map per column. */
  const cellText = useMemo(
    () => (ready ? ready.columns.map((c) => new Map(c.verses.map((v) => [v.verse, v.text]))) : []),
    [ready]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-rule px-4 py-2">
        <p className="small-caps text-xs font-semibold text-amber">Multiview</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">
          {ready ? `${ready.bookName} ${ready.chapter}` : `${getBook(book)?.name ?? book} ${chapter}`}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="Previous chapter"
            aria-label="Previous chapter"
            onClick={() => go(-1)}
            className={CTRL}
          >
            ‹
          </button>
          <button
            type="button"
            title="Next chapter"
            aria-label="Next chapter"
            onClick={() => go(1)}
            className={CTRL}
          >
            ›
          </button>
          <span
            role="group"
            aria-label="Scrolling"
            className="ml-1 inline-flex border border-rule text-[0.68rem]"
          >
            <button
              type="button"
              aria-pressed={!independent}
              title="One scroll carries every column, verses aligned"
              onClick={() => setIndependent(false)}
              className={`px-2 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                independent ? "text-muted hover:text-ink" : "bg-paper font-semibold text-sapphire"
              }`}
            >
              Shared
            </button>
            <button
              type="button"
              aria-pressed={independent}
              title="Each column scrolls on its own; verse alignment lets go"
              onClick={() => setIndependent(true)}
              className={`border-l border-rule px-2 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                independent ? "bg-paper font-semibold text-sapphire" : "text-muted hover:text-ink"
              }`}
            >
              Independent
            </button>
          </span>
          <select
            aria-label="Add a translation column"
            value=""
            disabled={texts.length >= MULTIVIEW_TEXTS_MAX || addable.length === 0}
            onChange={(e) => addColumn(e.target.value)}
            className={`${CTRL} ml-auto`}
          >
            <option value="" disabled>
              Add a column
            </option>
            {addable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.abbrev} · {t.name}
              </option>
            ))}
          </select>
        </p>
      </header>

      {load.status === "loading" && (
        <p className="p-4 text-xs text-muted">Laying out the columns…</p>
      )}
      {load.status === "error" && (
        <p className="p-4 text-xs text-muted">This chapter could not be laid out.</p>
      )}

      {ready && !independent && (
        /* Shared: one scroll carries the whole grid, so a row's height is
         * its tallest cell and the columns stay verse-aligned. */
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `2.5rem repeat(${ready.columns.length}, minmax(0, 1fr))`,
            }}
          >
            <div aria-hidden="true" className="sticky top-0 z-10 border-b border-rule bg-surface" />
            {ready.columns.map((c) => (
              <div
                key={c.id}
                className="sticky top-0 z-10 border-b border-l border-rule bg-surface px-3 py-2"
              >
                {columnHead(c, ready)}
              </div>
            ))}
            {ready.verses.map((v) => (
              <Fragment key={v}>
                <div className="border-b border-rule/50 py-2 pr-2 text-right">
                  <span className="small-caps text-[0.62rem] font-semibold text-sapphire">{v}</span>
                </div>
                {ready.columns.map((c, ci) => {
                  const cell = cellText[ci].get(v);
                  return (
                    <div
                      key={c.id}
                      className="border-b border-l border-rule/50 px-3 py-2 font-reader text-[0.84rem] leading-relaxed"
                    >
                      {cell !== undefined ? (
                        cell
                      ) : (
                        <span className="text-[0.68rem] text-muted">
                          No verse {v} under this text's numbering.
                        </span>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {ready && independent && (
        /* Independent: each column its own scroll over its own numbering. */
        <div className="flex min-h-0 flex-1 divide-x divide-rule">
          {ready.columns.map((c) => (
            <div key={c.id} className="min-w-0 flex-1 overflow-y-auto">
              <div className="sticky top-0 border-b border-rule bg-surface px-3 py-2">
                {columnHead(c, ready)}
              </div>
              <div className="space-y-2 px-3 py-3">
                {c.verses.map((v) => (
                  <p key={v.verse} className="font-reader text-[0.84rem] leading-relaxed">
                    <span className="small-caps mr-2 align-super text-[0.62rem] font-semibold text-sapphire">
                      {v.verse}
                    </span>
                    {v.text}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
