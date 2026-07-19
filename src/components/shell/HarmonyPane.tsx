"use client";

import { useEffect, useMemo, useState } from "react";
import { GOSPEL_SLUGS, getBook, resolveBookName } from "@/lib/canon";
import { useWorkspace } from "./WorkspaceContext";

interface IndexPericope {
  chapter: number;
  verse: number;
  heading: string;
  /** The other gospels the pericope's parallels name, in canon order. */
  gospels: string[];
}

interface IndexBook {
  slug: string;
  name: string;
  pericopes: IndexPericope[];
}

interface HarmonyVerse {
  chapter: number;
  verse: number;
  text: string;
}

interface Account {
  book: string;
  bookName: string;
  ref: string;
  spanChapters: boolean;
  verses: HarmonyVerse[];
}

interface Report {
  anchor: { book: string; bookName: string; chapter: number; verse: number; heading: string };
  accounts: Account[];
  seeAlso: string[];
}

type IndexLoad =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; books: IndexBook[] };

type ReportLoad =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; report: Report };

const CTRL =
  "border border-rule bg-paper px-1.5 py-0.5 text-xs text-ink hover:border-sapphire disabled:opacity-40 disabled:hover:border-rule focus:border-sapphire focus:outline-none";

/** The index badges: each gospel's short mark, anchor first by canon order. */
const GOSPEL_MARKS: Record<string, string> = {
  matthew: "Mt",
  mark: "Mk",
  luke: "Lk",
  john: "Jn",
};

/** A see-also reference opens its chapter in the reader. */
function seeAlsoRef(raw: string): { book: string; chapter: number } | null {
  const m = raw.match(/^(.+?)\s+(\d{1,3})(?::|$)/);
  if (!m) return null;
  const book = resolveBookName(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  return { book: book.slug, chapter };
}

/**
 * The Parallel Gospel Reader: the pericope dataset's parallel references
 * read as a gospel harmony. Unpinned, the pane is the index: every gospel
 * pericope under its book, badges naming the gospels that carry the account.
 * Pinned, the pane lays the four gospels out in fixed columns, the anchor
 * and each parallel in its own column with an honest blank where a gospel
 * lacks the account. Verse numbers differ across the accounts, so the
 * columns are not row-aligned the way the multiview's are; each account
 * reads as its own text under a shared scroll. Column heads deep-link into
 * the reader, and the references outside the gospels answer as see-also
 * cross-references. The pin lives on the tab and moves in place.
 */
export default function HarmonyPane({
  paneId,
  tabId,
  book,
  chapter,
  verse,
}: {
  paneId: string;
  tabId: string;
  book?: string;
  chapter?: number;
  verse?: number;
}) {
  const { dispatch } = useWorkspace();
  const [index, setIndex] = useState<IndexLoad>({ status: "loading" });
  const [report, setReport] = useState<ReportLoad>({ status: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pane/harmony", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const payload = (await res.json()) as { books: IndexBook[] };
        setIndex({ status: "ready", books: payload.books });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setIndex({ status: "error" });
      });
    return () => controller.abort();
  }, []);

  const pinned = book !== undefined && chapter !== undefined && verse !== undefined;

  useEffect(() => {
    if (!pinned) {
      setReport({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setReport({ status: "loading" });
    const q = new URLSearchParams({
      book: book!,
      chapter: String(chapter),
      verse: String(verse),
    });
    fetch(`/api/pane/harmony?${q}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setReport({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setReport({ status: "ready", report: (await res.json()) as Report });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setReport({ status: "error" });
      });
    return () => controller.abort();
  }, [pinned, book, chapter, verse]);

  /* The anchor book's pericopes, for the previous and next controls. */
  const neighbors = useMemo((): { prev: IndexPericope | null; next: IndexPericope | null } => {
    if (!pinned || index.status !== "ready") return { prev: null, next: null };
    const rows = index.books.find((b) => b.slug === book)?.pericopes ?? [];
    const i = rows.findIndex((p) => p.chapter === chapter && p.verse === verse);
    if (i < 0) return { prev: null, next: null };
    return { prev: rows[i - 1] ?? null, next: rows[i + 1] ?? null };
  }, [pinned, index, book, chapter, verse]);

  const openPericope = (slug: string, p: IndexPericope) =>
    dispatch({ type: "setHarmonyRef", paneId, tabId, book: slug, chapter: p.chapter, verse: p.verse });

  const clearPin = () => dispatch({ type: "setHarmonyRef", paneId, tabId });

  const ready = report.status === "ready" ? report.report : null;
  const accountByGospel = new Map((ready?.accounts ?? []).map((a) => [a.book, a]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-rule px-4 py-2">
        <p className="small-caps text-xs font-semibold text-amber">Gospel Harmony</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">
          {ready ? ready.anchor.heading : "The Gospels in parallel"}
        </h2>
        {ready && (
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              title="Previous pericope"
              aria-label="Previous pericope"
              disabled={!neighbors.prev}
              onClick={() => neighbors.prev && openPericope(ready.anchor.book, neighbors.prev)}
              className={CTRL}
            >
              ‹
            </button>
            <button
              type="button"
              title="Next pericope"
              aria-label="Next pericope"
              disabled={!neighbors.next}
              onClick={() => neighbors.next && openPericope(ready.anchor.book, neighbors.next)}
              className={CTRL}
            >
              ›
            </button>
            <span className="small-caps text-[0.68rem] font-semibold text-muted">
              {ready.anchor.bookName} {ready.anchor.chapter}:{ready.anchor.verse}
            </span>
            <button type="button" onClick={clearPin} className={`${CTRL} ml-auto`}>
              All pericopes
            </button>
          </p>
        )}
        {ready && ready.seeAlso.length > 0 && (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.68rem] text-muted">
            <span className="small-caps font-semibold">Also</span>
            {ready.seeAlso.map((raw) => {
              const ref = seeAlsoRef(raw);
              return ref ? (
                <button
                  key={raw}
                  type="button"
                  title={`Open ${raw} in the reader`}
                  onClick={() => dispatch({ type: "openRef", book: ref.book, chapter: ref.chapter })}
                  className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {raw}
                </button>
              ) : (
                <span key={raw}>{raw}</span>
              );
            })}
          </p>
        )}
      </header>

      {report.status === "loading" && (
        <p className="p-4 text-xs text-muted">Laying out the accounts…</p>
      )}
      {report.status === "error" && (
        <p className="p-4 text-xs text-muted">This pericope could not be laid out.</p>
      )}
      {report.status === "missing" && (
        <p className="p-4 text-xs text-muted">
          No pericope begins at this verse. The index below names every pericope start.
        </p>
      )}

      {ready && (
        /* One scroll carries the four gospel columns; verse numbers differ
         * across the accounts, so the columns read as parallel texts rather
         * than aligned rows. */
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-4 divide-x divide-rule">
            {GOSPEL_SLUGS.map((slug) => {
              const acc = accountByGospel.get(slug);
              return (
                <div key={slug} className="min-w-0">
                  <div className="sticky top-0 border-b border-rule bg-surface px-3 py-2">
                    <p className="flex items-baseline gap-1.5">
                      <span className="small-caps text-xs font-semibold text-muted">
                        {getBook(slug)?.name ?? slug}
                      </span>
                      {acc && (
                        <button
                          type="button"
                          title={`Open ${acc.ref} in the reader`}
                          onClick={() =>
                            dispatch({
                              type: "openRef",
                              book: acc.book,
                              chapter: acc.verses[0]?.chapter ?? ready.anchor.chapter,
                            })
                          }
                          className="ml-auto text-[0.68rem] text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                        >
                          {acc.ref}
                        </button>
                      )}
                    </p>
                  </div>
                  {acc ? (
                    <div className="space-y-2 px-3 py-3">
                      {acc.verses.map((v) => (
                        <p
                          key={`${v.chapter}:${v.verse}`}
                          className="font-reader text-[0.84rem] leading-relaxed"
                        >
                          <span className="small-caps mr-2 align-super text-[0.62rem] font-semibold text-sapphire">
                            {acc.spanChapters ? `${v.chapter}:${v.verse}` : v.verse}
                          </span>
                          {v.text}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="px-3 py-3 text-[0.68rem] leading-relaxed text-muted">
                      No parallel account in {getBook(slug)?.name ?? slug}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!pinned && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {index.status === "loading" && (
            <p className="text-xs text-muted">Gathering the pericopes…</p>
          )}
          {index.status === "error" && (
            <p className="text-xs text-muted">The pericope index could not be read.</p>
          )}
          {index.status === "ready" && (
            <div className="space-y-4">
              <p className="text-[0.68rem] text-muted">
                {index.books.reduce((n, b) => n + b.pericopes.length, 0)} passages · parallel
                accounts from the Berean Study Bible's paratext · the text is the KJV
              </p>
              {index.books.map((b) => (
                <section key={b.slug}>
                  <div className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
                    {b.name} · {b.pericopes.length} passages
                  </div>
                  <ul className="divide-y divide-rule/50 border border-rule bg-surface">
                    {b.pericopes.map((p) => (
                      <li key={`${p.chapter}:${p.verse}`}>
                        <button
                          type="button"
                          onClick={() => openPericope(b.slug, p)}
                          className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                        >
                          <span className="small-caps w-12 shrink-0 text-[0.62rem] font-semibold text-sapphire">
                            {p.chapter}:{p.verse}
                          </span>
                          <span className="min-w-0 flex-1 text-[0.8rem] text-ink">{p.heading}</span>
                          <span className="shrink-0 text-[0.62rem] text-muted">
                            {[b.slug, ...p.gospels]
                              .map((g) => GOSPEL_MARKS[g])
                              .filter(Boolean)
                              .join(" ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
