"use client";

import { useEffect, useState } from "react";
import { getBook } from "@/lib/canon";
import { useWorkspace } from "./WorkspaceContext";

interface CrossRef {
  ref: string;
  slug: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  votes: number;
}

interface VerseRefs {
  verse: number;
  refs: CrossRef[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; furnished: boolean; verses: VerseRefs[] };

/**
 * The dock's cross-references: the treasury opens at the chapter in focus,
 * listed per verse. A verse selection narrows the list to that verse,
 * under a "following" header; Reset lets the selection go. Every reference
 * dispatches berean:open-ref, so a click carries the pane in focus to the
 * linked passage.
 */
export default function CrossRefsDock() {
  const { state, activeRef, dispatch } = useWorkspace();
  const sel = state.selection?.kind === "verse" ? state.selection : null;
  const book = sel?.book ?? activeRef?.book ?? null;
  const chapter = sel?.chapter ?? activeRef?.chapter ?? null;
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (book === null || chapter === null) return;
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/crossrefs?book=${encodeURIComponent(book)}&chapter=${chapter}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { furnished: boolean; verses: VerseRefs[] };
        setLoad({ status: "ready", furnished: data.furnished, verses: data.verses });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter]);

  const following = sel ? `${getBook(sel.book)?.name ?? sel.book} ${sel.chapter}:${sel.verse}` : null;
  const header = following ? (
    <div className="mb-4 flex items-baseline justify-between border-b border-rule pb-2">
      <p className="small-caps text-xs font-semibold text-amber">Following {following}</p>
      <button
        type="button"
        onClick={() => dispatch({ type: "clearSelection" })}
        className="text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Reset
      </button>
    </div>
  ) : null;

  if (book === null || chapter === null) {
    return <p className="text-xs text-muted">Open a passage and its references gather here.</p>;
  }
  if (load.status === "loading") {
    return (
      <>
        {header}
        <p className="text-xs text-muted">Opening the treasury…</p>
      </>
    );
  }
  if (load.status === "error") {
    return (
      <>
        {header}
        <p className="text-xs text-muted">Cross-references could not be reached.</p>
      </>
    );
  }
  if (!load.furnished) {
    return (
      <>
        {header}
        <p className="text-xs text-muted">
          The cross-reference engine is not yet furnished on this installation.
        </p>
      </>
    );
  }
  const verses = sel ? load.verses.filter((v) => v.verse === sel.verse) : load.verses;
  if (verses.length === 0) {
    return (
      <>
        {header}
        <p className="text-xs text-muted">
          {sel
            ? "No cross-references recorded for this verse."
            : "No cross-references recorded for this chapter."}
        </p>
      </>
    );
  }
  return (
    <div>
      {header}
      <div className="space-y-4">
        {verses.map((v) => (
          <div key={v.verse}>
            <p className="small-caps mb-1 text-xs font-semibold text-muted">Verse {v.verse}</p>
            <ul className="flex flex-wrap gap-1.5">
              {v.refs.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    title={`Open ${r.ref}`}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("berean:open-ref", {
                          detail: {
                            book: r.slug,
                            chapter: r.chapter,
                            verse: r.verse,
                            verseEnd: r.endVerse,
                          },
                        })
                      )
                    }
                    className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    {r.ref}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
          Cross-references: Treasury of Scripture Knowledge (public domain).
        </p>
      </div>
    </div>
  );
}
