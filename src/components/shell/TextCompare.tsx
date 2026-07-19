"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";

type DiffMark = "same" | "added" | "omitted";

interface CompareSegment {
  text: string;
  mark: DiffMark;
}

interface CompareVerse {
  verse: number;
  missingVerse?: boolean;
  identical: boolean;
  segments: CompareSegment[];
}

interface CompareColumn {
  id: string;
  abbrev: string;
  name: string;
  /** The LXX numbering note where the Septuagint counts differently. */
  note: string | null;
  /** True when the text has no such chapter at all. */
  missing: boolean;
  /** One entry per base verse, in base order. */
  verses: CompareVerse[];
  onlyHere: { verse: number; label?: string; text: string }[];
}

interface ComparePayload {
  book: string;
  bookName: string;
  chapter: number;
  base: { id: string; abbrev: string };
  baseVerses: { verse: number; text: string }[];
  shelf: { id: string; abbrev: string; name: string }[];
  columns: CompareColumn[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; report: ComparePayload };

/**
 * The Text Comparison pane: one chapter, pinned at open time, with every
 * furnished translation for the book diffed against a switchable base. A
 * verse shows only the texts that differ; a chapter where every text agrees
 * says so once. Added words wear sapphire, base words a text lacks are
 * struck in ruby, and versification gaps are named rather than aligned away.
 */
export default function TextCompare({
  paneId,
  tabId,
  book,
  chapter,
  base,
}: {
  paneId: string;
  tabId: string;
  book: string;
  chapter: number;
  base: string;
}) {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    const q = new URLSearchParams({ book, chapter: String(chapter), base });
    fetch(`/api/pane/compare?${q}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", report: (await res.json()) as ComparePayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter, base]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Composing the comparison…</p>;
  }
  if (load.status === "error") {
    return <p className="text-xs text-muted">This chapter could not be compared.</p>;
  }
  const r = load.report;
  const columns = r.columns.filter((c) => !c.missing);
  const absent = r.columns.filter((c) => c.missing);
  const noted = r.columns.filter((c) => c.note);

  return (
    <div className="mx-auto max-w-prose space-y-6">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Text comparison</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">
          {r.bookName} {r.chapter}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.68rem] text-muted">
          <label htmlFor={`compare-base-${tabId}`} className="small-caps font-semibold">
            Base text
          </label>
          <select
            id={`compare-base-${tabId}`}
            value={r.base.id}
            onChange={(e) =>
              dispatch({ type: "setCompareBase", paneId, tabId, base: e.target.value })
            }
            className="border border-rule bg-paper px-1.5 py-0.5 text-xs text-ink focus:border-sapphire focus:outline-none"
          >
            {r.shelf.map((t) => (
              <option key={t.id} value={t.id}>
                {t.abbrev} · {t.name}
              </option>
            ))}
          </select>
        </p>
        <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted">
          Words a text adds wear sapphire; words the {r.base.abbrev} has that a text lacks are
          struck through. Verses where every text agrees are folded away.
        </p>
        {noted.map((c) => (
          <p key={c.id} className="mt-1 text-[0.68rem] leading-relaxed text-muted">
            {c.abbrev}: {c.note}
          </p>
        ))}
        {absent.map((c) => (
          <p key={c.id} className="mt-1 text-[0.68rem] leading-relaxed text-muted">
            {c.abbrev} has no {r.bookName} {r.chapter} under its own numbering.
          </p>
        ))}
      </header>

      {r.baseVerses.map((bv, vi) => {
        const changed = columns.filter((c) => !c.verses[vi].identical);
        return (
          <section key={bv.verse} aria-label={`Verse ${bv.verse}`}>
            <p className="font-editorial text-[0.95rem] leading-relaxed">
              <span className="small-caps mr-2 align-super text-[0.62rem] font-semibold text-sapphire">
                {bv.verse}
              </span>
              {bv.text}
            </p>
            {changed.length === 0 ? (
              <p className="mt-1 text-[0.68rem] text-muted">Every furnished text agrees.</p>
            ) : (
              changed.map((c) => {
                const cv = c.verses[vi];
                return (
                  <p key={c.id} className="mt-1 text-[0.8rem] leading-relaxed">
                    <span className="small-caps mr-2 text-[0.62rem] font-semibold text-sapphire">
                      {c.abbrev}
                    </span>
                    {cv.missingVerse ? (
                      <span className="text-muted">No verse {bv.verse} under this text’s numbering.</span>
                    ) : (
                      cv.segments.map((s, i) =>
                        s.mark === "same" ? (
                          <span key={i}>{s.text} </span>
                        ) : (
                          <span
                            key={i}
                            className={s.mark === "added" ? "diff-added" : "diff-omitted"}
                          >
                            {s.text}{" "}
                          </span>
                        )
                      )
                    )}
                  </p>
                );
              })
            )}
          </section>
        );
      })}

      {columns
        .filter((c) => c.onlyHere.length > 0)
        .map((c) => (
          <section key={c.id} aria-label={`Only in ${c.abbrev}`}>
            <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
              Only in {c.abbrev}
            </p>
            {c.onlyHere.map((v) => (
              <p key={v.label ?? v.verse} className="mt-1 text-[0.8rem] leading-relaxed text-muted">
                <span className="small-caps mr-2 text-[0.62rem] font-semibold">{v.label ?? v.verse}</span>
                {v.text}
              </p>
            ))}
          </section>
        ))}
    </div>
  );
}
