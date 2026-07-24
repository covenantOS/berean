"use client";

import { useEffect, useState } from "react";
import { useWorkspaceDispatch } from "./WorkspaceContext";
import PrintButton from "./PrintButton";

interface HymnDoc {
  id: string;
  title: string;
  altTitles: string[];
  author: string | null;
  translator: string | null;
  meter: string;
  credit: string;
  tunes: { name: string; composer: string | null }[];
  lyricSources: string[];
  firstLine: string;
  verses: string[][];
  refrain: string[] | null;
  refs: { book: string; chapter: number; verse: number; endVerse?: number }[];
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; hymn: HymnDoc };

/**
 * The hymn reader: one hymn in full with quiet chrome, the sermon reader's
 * pattern. The header carries author, meter, and tunes; verses number down
 * the page with the refrain where the score prints one; scripture
 * references open the passage in the reader. The Chapel's hymnbook section
 * and the service builder both land here.
 */
export default function HymnsPane({ hymn }: { paneId: string; tabId: string; hymn: string }) {
  const { dispatch } = useWorkspaceDispatch();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/hymns?id=${encodeURIComponent(hymn)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setLoad({ status: "missing" });
          return;
        }
        setLoad({ status: "ready", hymn: (await res.json()) as HymnDoc });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [hymn]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Laying the hymnbook open…</p>;
  }
  if (load.status === "missing") {
    return <p className="text-xs text-muted">This hymn is not in the hymnbook.</p>;
  }
  const doc = load.hymn;
  return (
    <div data-print-root className="mx-auto max-w-prose">
      <header className="mb-4 flex items-baseline justify-between border-b border-rule pb-3">
        <div>
          <h2 className="font-reader text-lg font-semibold text-ink">{doc.title}</h2>
          <p className="mt-1 text-xs text-muted">
            {[doc.author, doc.meter, doc.tunes.map((t) => t.name).join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {doc.credit ? <p className="mt-0.5 text-xs text-muted">{doc.credit}</p> : null}
        </div>
        <PrintButton />
      </header>
      <div className="font-reader text-[0.95rem] leading-relaxed text-ink">
        {doc.verses.map((verse, i) => (
          <div key={i}>
            <p className="mb-1">
              <span className="mr-2 text-xs font-semibold text-sapphire">{i + 1}</span>
              {verse.map((line, j) => (
                <span key={j} className="block pl-6">{line}</span>
              ))}
            </p>
            {doc.refrain && i === 0 ? (
              <p className="mb-1 italic">
                <span className="mr-2 text-xs font-semibold text-muted">Ref</span>
                {doc.refrain.map((line, j) => (
                  <span key={j} className="block pl-6">{line}</span>
                ))}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {doc.refs.length > 0 ? (
        <footer className="mt-4 border-t border-rule pt-3">
          <p className="small-caps text-xs font-semibold text-muted">Scripture</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {doc.refs.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "openRef", book: r.book, chapter: r.chapter })
                  }
                  className="text-xs text-sapphire hover:underline"
                >
                  {r.book} {r.chapter}:{r.verse}
                  {r.endVerse ? `-${r.endVerse}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </div>
  );
}
