"use client";

import { useEffect, useState } from "react";
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
 * listed per verse. Every reference dispatches berean:open-ref, so a click
 * carries the pane in focus to the linked passage.
 */
export default function CrossRefsDock() {
  const { activeRef } = useWorkspace();
  const book = activeRef?.book ?? null;
  const chapter = activeRef?.chapter ?? null;
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

  if (book === null || chapter === null) {
    return <p className="text-xs text-muted">Open a passage and its references gather here.</p>;
  }
  if (load.status === "loading") {
    return <p className="text-xs text-muted">Opening the treasury…</p>;
  }
  if (load.status === "error") {
    return <p className="text-xs text-muted">Cross-references could not be reached.</p>;
  }
  if (!load.furnished) {
    return (
      <p className="text-xs text-muted">
        The cross-reference engine is not yet furnished on this installation.
      </p>
    );
  }
  if (load.verses.length === 0) {
    return <p className="text-xs text-muted">No cross-references recorded for this chapter.</p>;
  }
  return (
    <div className="space-y-4">
      {load.verses.map((v) => (
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
  );
}
