"use client";

import { useEffect, useState } from "react";
import { adjacentChapter } from "@/lib/canon";
import { useWorkspace } from "./WorkspaceContext";

interface ChapterPayload {
  book: string;
  bookName: string;
  chapter: number;
  chapters: number;
  poetry: boolean;
  translation: string;
  verses: { verse: number; text: string; label?: string }[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ChapterPayload };

/**
 * The reader: Phase 0's one real panel. It fetches the chapter from the
 * server (/api/pane/chapter) so the workspace never reloads the page, and
 * sets Scripture in the reader face on the reading surface.
 */
export default function ReaderPane({
  paneId,
  book,
  chapter,
}: {
  paneId: string;
  book: string;
  chapter: number;
}) {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/chapter?book=${encodeURIComponent(book)}&chapter=${chapter}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", data: (await res.json()) as ChapterPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter]);

  const go = (dir: -1 | 1) => {
    const next = adjacentChapter(book, chapter, dir);
    if (next) dispatch({ type: "openRef", book: next.book.slug, chapter: next.chapter, paneId });
  };

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-rule px-4">
        <button
          type="button"
          title="Previous chapter"
          aria-label="Previous chapter"
          disabled={!adjacentChapter(book, chapter, -1)}
          onClick={() => go(-1)}
          className="px-1.5 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          ‹
        </button>
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          {load.status === "ready" ? `${load.data.bookName} ${load.data.chapter}` : "\u00A0"}
          {load.status === "ready" && (
            <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">
              {load.data.translation}
            </span>
          )}
        </h2>
        <button
          type="button"
          title="Next chapter"
          aria-label="Next chapter"
          disabled={!adjacentChapter(book, chapter, 1)}
          onClick={() => go(1)}
          className="px-1.5 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          ›
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {load.status === "loading" && (
          <p className="px-6 py-8 text-center text-xs text-muted">Opening the chapter…</p>
        )}
        {load.status === "error" && (
          <p className="px-6 py-8 text-center text-xs text-muted">
            This chapter could not be loaded.
          </p>
        )}
        {load.status === "ready" &&
          (load.data.poetry ? (
            <div className="poetry-verses mx-auto max-w-prose px-6 py-6">
              {load.data.verses.map((v) => (
                <div key={v.verse} className="verse-line">
                  <span className="verse-num">{v.label ?? v.verse}</span>
                  {v.text}
                </div>
              ))}
            </div>
          ) : (
            <p className="prose-verses mx-auto max-w-prose px-6 py-6">
              {load.data.verses.map((v) => (
                <span key={v.verse}>
                  <span className="verse-num">{v.label ?? v.verse}</span>
                  {v.text}{" "}
                </span>
              ))}
            </p>
          ))}
      </div>
    </div>
  );
}
