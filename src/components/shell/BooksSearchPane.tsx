"use client";

import { useEffect, useMemo, useState } from "react";
import { searchDocs } from "@/lib/docsearch";
import { useCollection } from "@/lib/hooks";
import { personalbooks, type PersonalBook } from "@/lib/personalbooks";
import PrintButton from "./PrintButton";
import { useWorkspaceDispatch } from "./WorkspaceContext";

/**
 * The Books Search pane: the concordance turned on the library. Where the
 * Docs Search pane reads the device-local collections live, this one asks
 * /api/pane/books-search, which scans the commentary shelf's sections and
 * the topical works' entries server-side (src/lib/booksearch.ts), so the
 * precise grammar answers here the way it does in the Search pane. The
 * field toggle scopes the query where the data carries the distinction:
 * topical entries answer by heading (the title) or body text (the outline
 * labels), and commentary sections carry one prose field, so a
 * heading-scoped query answers from the topical works alone. Personal
 * books merge in on the device with their documented substring matching
 * (src/lib/docsearch.ts), whatever the field. Each hit opens its target: a
 * commentary hit carries the workspace to the passage and selects the
 * section's first verse, so the commentary wall rises on the sections
 * treating it; a topical hit opens its topic guide; a personal book opens
 * its reader. The header handoff runs the same query against the canon.
 */

type Field = "all" | "heading" | "text";

const FIELDS: { id: Field; label: string; title: string }[] = [
  { id: "all", label: "All text", title: "Search headings and body text" },
  { id: "heading", label: "Headings", title: "Search entry titles alone" },
  { id: "text", label: "Body text", title: "Search section and outline text alone" },
];

interface CommentaryHit {
  work: string;
  workLabel: string;
  book: string;
  bookName: string;
  chapter: number;
  verses: string;
  snippet: string;
}

interface TopicHit {
  work: string;
  workLabel: string;
  topicId: string;
  title: string;
  field: "heading" | "text";
  snippet: string;
}

type ServerState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "invalid"; message: string }
  | {
      status: "ready";
      commentary: CommentaryHit[];
      commentaryTotal: number;
      topics: TopicHit[];
      topicsTotal: number;
    };

export default function BooksSearchPane({ q }: { q: string }) {
  const { dispatch } = useWorkspaceDispatch();
  const books = useCollection(personalbooks);
  const [field, setField] = useState<Field>("all");
  const [server, setServer] = useState<ServerState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setServer({ status: "loading" });
    fetch(`/api/pane/books-search?q=${encodeURIComponent(q)}&field=${field}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          commentary: CommentaryHit[];
          commentaryTotal: number;
          topics: TopicHit[];
          topicsTotal: number;
          error?: string;
        };
        if (data.error) setServer({ status: "invalid", message: data.error });
        else setServer({ status: "ready", ...data });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setServer({ status: "error" });
      });
    return () => controller.abort();
  }, [q, field]);

  /* Personal books answer on the device with the docs search's plain
   * substring, title, author, and body, under every field scope. */
  const personalHits = useMemo(
    () =>
      searchDocs(q, {
        notes: [],
        highlights: [],
        documents: [],
        lists: [],
        personalBooks: books,
        // Print books carry no body on the device; nothing to full-text.
        printBooks: [],
        prayers: [],
      }).personalBooks,
    [q, books]
  );

  /* A commentary hit lands the wall on the section itself: the workspace
   * opens the passage and selects the section's first verse, and the dock
   * rises on the sections treating it. */
  const openCommentary = (h: CommentaryHit) => {
    const verse = Number(h.verses.match(/\d+/)?.[0] ?? 1);
    dispatch({ type: "openRef", book: h.book, chapter: h.chapter });
    dispatch({ type: "selectVerse", book: h.book, chapter: h.chapter, verse });
    dispatch({ type: "setDockTab", tab: "commentary" });
  };

  const openTopic = (h: TopicHit) =>
    dispatch({ type: "openTopicGuide", work: h.work, topicId: h.topicId, title: h.title });

  const openBook = (b: PersonalBook) =>
    dispatch({ type: "openPersonalBook", bookId: b.id, title: b.title });

  const commentary = server.status === "ready" ? server.commentary : [];
  const topics = server.status === "ready" ? server.topics : [];

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col" data-print-root>
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          “{q}”
          <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">Books</span>
        </h2>
        <span className="seg no-print ml-4" role="group" aria-label="Field scope">
          {FIELDS.map((f) => (
            <button
              key={f.id}
              type="button"
              title={f.title}
              aria-pressed={field === f.id}
              onClick={() => setField(f.id)}
            >
              {f.label}
            </button>
          ))}
        </span>
        <button
          type="button"
          title="Search the canon for the same words"
          onClick={() => dispatch({ type: "openSearch", q })}
          className="no-print ml-auto text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Search the Bible
        </button>
        <PrintButton className="ml-3" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-prose px-6 py-4">
          {server.status === "loading" && (
            <p className="py-4 text-xs text-muted">Searching the library…</p>
          )}
          {server.status === "error" && (
            <p className="py-4 text-xs text-muted">The search could not be run.</p>
          )}
          {server.status === "invalid" && <p className="py-4 text-xs text-muted">{server.message}</p>}
          {server.status === "ready" && (
            <div className="fx-fade">
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Commentary shelf
                  {server.commentaryTotal > 0 && <> · {server.commentaryTotal.toLocaleString()}</>}
                </p>
                {commentary.length === 0 ? (
                  <p className="py-3 text-xs text-muted">
                    {field === "heading"
                      ? "Commentary sections carry no headings of their own."
                      : `No commentary section answers to “${q}”.`}
                  </p>
                ) : (
                  <ul>
                    {commentary.map((h, i) => (
                      <li key={`${h.work}-${h.book}-${h.chapter}-${h.verses}-${i}`} className="border-b border-rule/60">
                        <button
                          type="button"
                          onClick={() => openCommentary(h)}
                          title={`Open the commentary wall at ${h.bookName} ${h.chapter}${h.verses ? `:${h.verses}` : ""}`}
                          className="block w-full py-3 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                        >
                          <span className="small-caps text-sm font-medium text-sapphire">
                            {h.bookName} {h.chapter}
                            {h.verses ? `:${h.verses}` : ""}
                            <span className="ml-2 text-[0.62rem] font-normal text-muted">
                              {h.workLabel}
                            </span>
                          </span>
                          <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                            {h.snippet}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {server.commentaryTotal > commentary.length && (
                  <p className="mt-2 text-xs text-muted">
                    The first {commentary.length.toLocaleString()} of{" "}
                    {server.commentaryTotal.toLocaleString()} sections.
                  </p>
                )}
              </section>
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Topical works
                  {server.topicsTotal > 0 && <> · {server.topicsTotal.toLocaleString()}</>}
                </p>
                {topics.length === 0 ? (
                  <p className="py-3 text-xs text-muted">No topical entry answers to “{q}”.</p>
                ) : (
                  <ul>
                    {topics.map((h) => (
                      <li key={`${h.work}-${h.topicId}`} className="border-b border-rule/60">
                        <button
                          type="button"
                          onClick={() => openTopic(h)}
                          title={`Open ${h.title} in the topic guide`}
                          className="block w-full py-3 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                        >
                          <span className="small-caps text-sm font-medium text-sapphire">
                            {h.title}
                            <span className="ml-2 text-[0.62rem] font-normal text-muted">
                              {h.workLabel} · {h.field === "heading" ? "heading" : "text"}
                            </span>
                          </span>
                          <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                            {h.snippet}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {server.topicsTotal > topics.length && (
                  <p className="mt-2 text-xs text-muted">
                    The first {topics.length.toLocaleString()} of {server.topicsTotal.toLocaleString()}{" "}
                    entries.
                  </p>
                )}
              </section>
            </div>
          )}
          {personalHits.length > 0 && (
            <section className="fx-fade mb-5">
              <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                Personal books · {personalHits.length}
              </p>
              <ul>
                {personalHits.map((h) => (
                  <li key={h.book.id} className="border-b border-rule/60">
                    <button
                      type="button"
                      onClick={() => openBook(h.book)}
                      title={`Open ${h.book.title}`}
                      className="block w-full py-3 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      <span className="small-caps text-sm font-medium text-sapphire">
                        {h.book.title}
                        {h.book.author && (
                          <span className="ml-2 text-[0.62rem] font-normal text-muted">
                            {h.book.author}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                        {h.snippet}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
