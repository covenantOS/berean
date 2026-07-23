"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getBook } from "@/lib/canon";
import { documents, listDocuments, listKindLabel } from "@/lib/documents";
import { resultCount, searchDocs, type DocResults, type HighlightRow } from "@/lib/docsearch";
import {
  highlights as highlightCollection,
  highlightStyles,
  listStyles,
  resolveStyle,
} from "@/lib/highlights";
import { useCollection } from "@/lib/hooks";
import { isAnchored, notes as marginNotes, type AnchoredNote } from "@/lib/marginalia";
import { personalbooks } from "@/lib/personalbooks";
import { prayerLists } from "@/lib/prayers";
import { printbooks } from "@/lib/printbooks";
import PrintButton from "./PrintButton";
import { useWorkspaceDispatch } from "./WorkspaceContext";

/**
 * All Search: one query across the canon, the shipped library, and the
 * user's own collections, the Logos Everything shape held to what
 * genuinely indexes locally. The Scripture group asks /api/pane/search, so
 * the precise grammar answers there (src/lib/query.ts); the Books group
 * asks /api/pane/books-search, so the same grammar answers over the
 * commentary shelf and the topical works (src/lib/booksearch.ts); the
 * Documents group runs the docs search (src/lib/docsearch.ts) over the
 * device-local collections live, keeping its documented substring
 * matching. Each group lists its first hits and hands off to its dedicated
 * pane for the rest: Scripture into the full search tab with its four
 * views, Books into the Books Search pane, Documents into the Docs Search
 * pane. Result rows deep-link exactly as those panes do. The store stays
 * out: nothing of it indexes locally.
 */

/** Hits listed per group before the group's "see all" handoff. */
const TOP = 5;

interface VerseHit {
  book: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

type ScriptureState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "invalid"; message: string }
  | { status: "ready"; hits: VerseHit[]; total: number };

interface BookCommentaryHit {
  work: string;
  workLabel: string;
  book: string;
  bookName: string;
  chapter: number;
  verses: string;
  snippet: string;
}

interface BookTopicHit {
  work: string;
  workLabel: string;
  topicId: string;
  title: string;
  snippet: string;
}

type BooksState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "invalid"; message: string }
  | {
      status: "ready";
      commentary: BookCommentaryHit[];
      commentaryTotal: number;
      topics: BookTopicHit[];
      topicsTotal: number;
    };

export default function AllSearchPane({ q }: { q: string }) {
  const { dispatch } = useWorkspaceDispatch();
  const notes = useCollection(marginNotes);
  const marks = useCollection(highlightCollection);
  const customStyles = useCollection(highlightStyles);
  const docs = useCollection(documents);
  const lists = useCollection(listDocuments);
  const books = useCollection(personalbooks);
  const printShelf = useCollection(printbooks);
  const prayers = useCollection(prayerLists);
  const [scripture, setScripture] = useState<ScriptureState>({ status: "loading" });
  const [shelf, setShelf] = useState<BooksState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setScripture({ status: "loading" });
    fetch(`/api/pane/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hits: VerseHit[]; total: number; error?: string };
        if (data.error) setScripture({ status: "invalid", message: data.error });
        else setScripture({ status: "ready", hits: data.hits, total: data.total });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setScripture({ status: "error" });
      });
    return () => controller.abort();
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    setShelf({ status: "loading" });
    fetch(`/api/pane/books-search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          commentary: BookCommentaryHit[];
          commentaryTotal: number;
          topics: BookTopicHit[];
          topicsTotal: number;
          error?: string;
        };
        if (data.error) setShelf({ status: "invalid", message: data.error });
        else setShelf({ status: "ready", ...data });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setShelf({ status: "error" });
      });
    return () => controller.abort();
  }, [q]);

  /* A highlight answers by its verse's reference and its style's name. */
  const highlightRows = useMemo(() => {
    const styles = listStyles(customStyles);
    const rows: HighlightRow[] = [];
    for (const h of marks) {
      const style = resolveStyle(h, styles);
      if (!style) continue;
      rows.push({
        highlight: h,
        reference: `${getBook(h.book)?.name ?? h.book} ${h.chapter}:${h.verse}`,
        style: style.name,
      });
    }
    return rows;
  }, [marks, customStyles]);

  const docResults = useMemo(
    () =>
      searchDocs(q, {
        notes,
        highlights: highlightRows,
        documents: docs,
        lists,
        personalBooks: books,
        printBooks: printShelf,
        prayers,
      }),
    [q, notes, highlightRows, docs, lists, books, printShelf, prayers]
  );

  /* A verse row carries the pane to its passage and selects the verse, the
   * ride an anchored note gets from the Docs Search pane. */
  const openVerse = (h: VerseHit) => {
    dispatch({ type: "openRef", book: h.book, chapter: h.chapter });
    dispatch({ type: "selectVerse", book: h.book, chapter: h.chapter, verse: h.verse });
  };

  const openNote = (n: AnchoredNote) => {
    dispatch({ type: "openRef", book: n.book, chapter: n.chapter });
    dispatch({ type: "selectVerse", book: n.book, chapter: n.chapter, verse: n.verse });
  };

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col" data-print-root>
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          “{q}”
          <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">Everything</span>
        </h2>
        <button
          type="button"
          title="Run this query against the canon alone"
          onClick={() => dispatch({ type: "openSearch", q })}
          className="no-print ml-auto text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Bible only
        </button>
        <button
          type="button"
          title="Run this query against your documents alone"
          onClick={() => dispatch({ type: "openDocSearch", q })}
          className="no-print ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Docs only
        </button>
        <button
          type="button"
          title="Run this query against the library alone"
          onClick={() => dispatch({ type: "openBooksSearch", q })}
          className="no-print ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Books only
        </button>
        <PrintButton className="ml-3" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-prose px-6 py-4">
          <ScriptureGroup q={q} state={scripture} onOpenVerse={openVerse} />
          <BooksGroup q={q} state={shelf} />
          <DocumentsGroup q={q} results={docResults} onOpenNote={openNote} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Scripture: the precise concordance, first hits ---------- */

function ScriptureGroup({
  q,
  state,
  onOpenVerse,
}: {
  q: string;
  state: ScriptureState;
  onOpenVerse: (h: VerseHit) => void;
}) {
  const { dispatch } = useWorkspaceDispatch();
  const shown = state.status === "ready" ? state.hits.slice(0, TOP) : [];

  return (
    <section className="mb-6">
      <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
        Scripture
        {state.status === "ready" && state.total > 0 && <> · {state.total.toLocaleString()}</>}
      </p>
      {state.status === "loading" && (
        <p className="py-4 text-xs text-muted">Searching the canon…</p>
      )}
      {state.status === "error" && (
        <p className="py-4 text-xs text-muted">The search could not be run.</p>
      )}
      {state.status === "invalid" && <p className="py-4 text-xs text-muted">{state.message}</p>}
      {state.status === "ready" && state.total === 0 && (
        <p className="py-4 text-xs text-muted">No verse in the canon answers to “{q}”.</p>
      )}
      {shown.length > 0 && (
        <>
          <ul className="fx-stagger">
            {shown.map((h, i) => (
              <li
                key={`${h.book}-${h.chapter}-${h.verse}`}
                className="border-b border-rule/60"
                style={{ "--i": i } as CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => onOpenVerse(h)}
                  title={`Open ${h.bookName} ${h.chapter}:${h.verse}`}
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
          {state.status === "ready" && state.total > shown.length && (
            <button
              type="button"
              title="Open the full concordance pane for this query"
              onClick={() => dispatch({ type: "openSearch", q })}
              className="no-print mt-2 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              See all {state.total.toLocaleString()} verses
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- Books: the commentary shelf and topical works, first hits ---------- */

function BooksGroup({ q, state }: { q: string; state: BooksState }) {
  const { dispatch } = useWorkspaceDispatch();
  const total = state.status === "ready" ? state.commentaryTotal + state.topicsTotal : 0;

  /* One flattened row across the two server groups, shelf hits first. */
  const rows: { key: string; heading: string; sub: string; snippet: string; open: () => void; title: string }[] = [];
  if (state.status === "ready") {
    for (const h of state.commentary) {
      rows.push({
        key: `c-${h.work}-${h.book}-${h.chapter}-${h.verses}`,
        heading: `${h.bookName} ${h.chapter}${h.verses ? `:${h.verses}` : ""}`,
        sub: h.workLabel,
        snippet: h.snippet,
        open: () => {
          const verse = Number(h.verses.match(/\d+/)?.[0] ?? 1);
          dispatch({ type: "openRef", book: h.book, chapter: h.chapter });
          dispatch({ type: "selectVerse", book: h.book, chapter: h.chapter, verse });
          dispatch({ type: "setDockTab", tab: "commentary" });
        },
        title: `Open the commentary wall at ${h.bookName} ${h.chapter}${h.verses ? `:${h.verses}` : ""}`,
      });
    }
    for (const h of state.topics) {
      rows.push({
        key: `t-${h.work}-${h.topicId}`,
        heading: h.title,
        sub: h.workLabel,
        snippet: h.snippet,
        open: () =>
          dispatch({ type: "openTopicGuide", work: h.work, topicId: h.topicId, title: h.title }),
        title: `Open ${h.title} in the topic guide`,
      });
    }
  }
  const shown = rows.slice(0, TOP);

  return (
    <section className="mb-6">
      <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
        Books{total > 0 && <> · {total.toLocaleString()}</>}
      </p>
      {state.status === "loading" && <p className="py-4 text-xs text-muted">Searching the library…</p>}
      {state.status === "error" && <p className="py-4 text-xs text-muted">The search could not be run.</p>}
      {state.status === "invalid" && <p className="py-4 text-xs text-muted">{state.message}</p>}
      {state.status === "ready" && total === 0 && (
        <p className="py-4 text-xs text-muted">Nothing in the library answers to “{q}”.</p>
      )}
      {shown.length > 0 && (
        <>
          <ul className="fx-stagger">
            {shown.map((r, i) => (
              <li key={r.key} className="border-b border-rule/60" style={{ "--i": i } as CSSProperties}>
                <button
                  type="button"
                  onClick={r.open}
                  title={r.title}
                  className="block w-full py-3 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  <span className="small-caps text-sm font-medium text-sapphire">
                    {r.heading}
                    <span className="ml-2 text-[0.62rem] font-normal text-muted">{r.sub}</span>
                  </span>
                  <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                    {r.snippet}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {total > shown.length && (
            <button
              type="button"
              title="Open the Books Search pane for this query"
              onClick={() => dispatch({ type: "openBooksSearch", q })}
              className="no-print mt-2 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              See all {total.toLocaleString()} book hits
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- Documents: the user's own collections, first hits ---------- */

/** One flattened row across the seven collections, in the Docs pane's order. */
interface DocRow {
  key: string;
  kindLabel: string;
  heading: string;
  snippet: string;
  /** The Docs pane's own deep link for the row's kind; a print book has
   * none, its copy being paper, and the row renders without a target. */
  open?: () => void;
  title: string;
}

function DocumentsGroup({
  q,
  results,
  onOpenNote,
}: {
  q: string;
  results: DocResults;
  onOpenNote: (n: AnchoredNote) => void;
}) {
  const { dispatch } = useWorkspaceDispatch();
  const total = resultCount(results);

  const rows: DocRow[] = [];
  for (const h of results.notes) {
    const n = h.note;
    if (!isAnchored(n)) {
      rows.push({
        key: n.id,
        kindLabel: "Journal",
        heading: n.date ? new Date(`${n.date}T00:00:00`).toLocaleDateString() : "Journal entry",
        snippet: h.snippet,
        open: () => dispatch({ type: "openJournal" }),
        title: "Open this entry in the journal",
      });
    } else {
      const reference = `${getBook(n.book)?.name ?? n.book} ${n.chapter}:${n.verse}`;
      rows.push({
        key: n.id,
        kindLabel: "Note",
        heading: reference,
        snippet: h.snippet,
        open: () => onOpenNote(n),
        title: `Open ${reference}`,
      });
    }
  }
  for (const h of results.highlights) {
    const mark = h.row.highlight;
    rows.push({
      key: mark.id,
      kindLabel: "Highlight",
      heading: h.row.reference,
      snippet: h.snippet,
      open: () => {
        dispatch({ type: "openRef", book: mark.book, chapter: mark.chapter });
        dispatch({
          type: "selectVerse",
          book: mark.book,
          chapter: mark.chapter,
          verse: mark.verse,
        });
      },
      title: `Open ${h.row.reference}`,
    });
  }
  for (const h of results.manuscripts) {
    rows.push({
      key: h.doc.id,
      kindLabel: "Manuscript",
      heading: h.doc.title || "Untitled",
      snippet: h.snippet,
      open: () =>
        dispatch({ type: "openManuscript", docId: h.doc.id, title: h.doc.title }),
      title: `Open ${h.doc.title || "Untitled"} for editing`,
    });
  }
  for (const h of results.lists) {
    rows.push({
      key: h.doc.id,
      kindLabel: listKindLabel(h.doc.kind),
      heading: h.doc.title || "Untitled list",
      snippet: h.snippet,
      open: () => dispatch({ type: "openListDoc", docId: h.doc.id, title: h.doc.title }),
      title: `Open ${h.doc.title || "Untitled list"}`,
    });
  }
  for (const h of results.personalBooks) {
    rows.push({
      key: h.book.id,
      kindLabel: "Personal book",
      heading: h.book.title,
      snippet: h.snippet,
      open: () =>
        dispatch({ type: "openPersonalBook", bookId: h.book.id, title: h.book.title }),
      title: `Open ${h.book.title}`,
    });
  }
  for (const h of results.printBooks) {
    /* No open: the copy is paper, so the row names the book and its shelf
     * note and stays a row. */
    rows.push({
      key: h.book.id,
      kindLabel: h.book.location ? `Print book · ${h.book.location}` : "Print book",
      heading: h.book.title,
      snippet: h.snippet,
      title: h.book.location ? `On the shelf: ${h.book.location}` : "A print book on your shelf",
    });
  }
  for (const h of results.prayers) {
    rows.push({
      key: h.request.id,
      kindLabel: "Prayer",
      heading: h.request.title,
      snippet: h.snippet,
      open: () => dispatch({ type: "openPrayers" }),
      title: `Open the ${h.list.title} list in the prayers pane`,
    });
  }
  const shown = rows.slice(0, TOP);

  return (
    <section className="mb-6">
      <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
        Your documents{total > 0 && <> · {total.toLocaleString()}</>}
      </p>
      {total === 0 ? (
        <p className="py-4 text-xs text-muted">Nothing of yours answers to “{q}”.</p>
      ) : (
        <>
          <ul className="fx-stagger">
            {shown.map((r, i) => {
              const inner = (
                <>
                  <span className="small-caps text-sm font-medium text-sapphire">
                    {r.heading}
                    <span className="ml-2 text-[0.62rem] font-normal text-muted">
                      {r.kindLabel}
                    </span>
                  </span>
                  <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                    {r.snippet}
                  </span>
                </>
              );
              return (
                <li key={r.key} className="border-b border-rule/60" style={{ "--i": i } as CSSProperties}>
                  {r.open ? (
                    <button
                      type="button"
                      onClick={r.open}
                      title={r.title}
                      className="block w-full py-3 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="py-3" title={r.title}>
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {total > shown.length && (
            <button
              type="button"
              title="Open the Docs Search pane for this query"
              onClick={() => dispatch({ type: "openDocSearch", q })}
              className="no-print mt-2 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              See all {total.toLocaleString()} documents
            </button>
          )}
        </>
      )}
    </section>
  );
}
