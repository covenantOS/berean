"use client";

import { useEffect, useState } from "react";

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
  | { status: "ready"; hits: Hit[]; total: number };

/**
 * The concordance pane: opened by the omnibox's berean:search event. It asks
 * /api/omnibox for the English text hits and lists them in the reader face;
 * every hit dispatches berean:open-ref, carrying the pane to the passage.
 */
export default function SearchPane({ q }: { q: string }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/omnibox?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hits: Hit[]; total: number };
        setLoad({ status: "ready", hits: data.hits, total: data.total });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [q]);

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col">
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          “{q}”
          <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">Concordance</span>
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {load.status === "loading" && (
          <p className="px-6 py-8 text-center text-xs text-muted">Searching the canon…</p>
        )}
        {load.status === "error" && (
          <p className="px-6 py-8 text-center text-xs text-muted">The search could not be run.</p>
        )}
        {load.status === "ready" && load.total === 0 && (
          <p className="px-6 py-8 text-center text-xs text-muted">
            No verse in the canon answers to “{q}”.
          </p>
        )}
        {load.status === "ready" && load.total > 0 && (
          <div className="mx-auto max-w-prose px-6 py-4">
            <p className="mb-3 text-xs text-muted">
              {load.total.toLocaleString()} {load.total === 1 ? "verse answers" : "verses answer"}
              {load.total > load.hits.length ? `; the first ${load.hits.length} are listed` : ""}.
            </p>
            <ul>
              {load.hits.map((h) => (
                <li key={`${h.book}-${h.chapter}-${h.verse}`} className="border-b border-rule/60">
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("berean:open-ref", {
                          detail: { book: h.book, chapter: h.chapter, verse: h.verse },
                        })
                      )
                    }
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
        )}
      </div>
    </div>
  );
}
