"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getBook } from "@/lib/canon";
import { useWorkspaceDispatch } from "./WorkspaceContext";
import GuideSection from "./GuideSection";
import PrintButton from "./PrintButton";
import { confessionTab } from "./workspace-state";

interface ConfessionRef {
  slug: string;
  chapter: number;
  from?: number;
  to?: number;
}

interface ConfessionProof {
  mark: string;
  raw: string;
  refs: ConfessionRef[];
  note?: string;
}

interface ConfessionSection {
  id: string;
  label: string;
  title: string;
  paragraphs: string[];
  proofs: ConfessionProof[];
}

interface ConfessionMatter {
  heading: string;
  paragraphs: string[];
}

interface ConfessionDoc {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  years: string;
  kind: "creed" | "catechism" | "confession";
  tradition: string;
  blurb?: string;
  frontMatter: ConfessionMatter[];
  backMatter: ConfessionMatter[];
  sections: ConfessionSection[];
}

interface ConfessionWorkRow {
  id: string;
  label: string;
  title: string;
  years: string;
  kind: string;
  tradition: string;
  blurb: string;
  sections: number;
  proofs: number;
  refs: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; doc: ConfessionDoc };

const KIND_LABEL: Record<string, string> = {
  creed: "Creed",
  catechism: "Catechism",
  confession: "Confession",
};

/** Consecutive verses of one chapter join into a range for display; the
 * proof's raw string in the data keeps the source's own form. */
function collapseRefs(refs: ConfessionRef[]): ConfessionRef[] {
  const out: ConfessionRef[] = [];
  for (const r of refs) {
    const last = out[out.length - 1];
    if (
      last &&
      r.from !== undefined &&
      last.from !== undefined &&
      last.slug === r.slug &&
      last.chapter === r.chapter
    ) {
      const lastTo = last.to ?? last.from;
      if (r.from <= lastTo + 1) {
        last.to = Math.max(lastTo, r.to ?? r.from);
        continue;
      }
    }
    out.push({ ...r });
  }
  return out;
}

function formatRef(r: ConfessionRef): string {
  const name = getBook(r.slug)?.name ?? r.slug;
  if (r.from === undefined) return `${name} ${r.chapter}`;
  const to = r.to !== undefined && r.to !== r.from ? `-${r.to}` : "";
  return `${name} ${r.chapter}:${r.from}${to}`;
}

/** The proof marks of the text ([1], [a]) rendered as quiet superscripts. */
function markedText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[([A-Za-z0-9]+)\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <sup key={m.index} className="text-[0.65em] font-semibold text-sapphire">
        {m[1]}
      </sup>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * The confessions reader: the historic creeds and confessions open for
 * reading. With no document pinned the pane is the corpus browser, the
 * works in historical order with their proof counts. A document renders in
 * the reading idiom: the articles verbatim, their proof marks as
 * superscripts, and the proofs beneath each article as reference links that
 * carry the pane in focus to the passage (the workspace's openRef). A
 * section pin from a guide row lands the scroll on the article and marks
 * it. The documents are confessional standards: they render as received,
 * and the digitization's own notes are named as such where they show.
 */
export default function ConfessionsPane({
  paneId,
  tabId,
  doc,
  section,
}: {
  paneId: string;
  tabId: string;
  doc?: string;
  section?: string;
}) {
  const { dispatch } = useWorkspaceDispatch();
  const [works, setWorks] = useState<ConfessionWorkRow[] | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  /* The corpus browser fetches the work list; a pinned document fetches
   * itself. The fetch key is the doc alone; the section pin only scrolls. */
  useEffect(() => {
    const controller = new AbortController();
    if (!doc) {
      setWorks(null);
      fetch("/api/pane/confession", { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          setWorks(((await res.json()) as { works: ConfessionWorkRow[] }).works);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setWorks([]);
        });
      return () => controller.abort();
    }
    setLoad({ status: "loading" });
    fetch(`/api/pane/confession?doc=${encodeURIComponent(doc)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setLoad({ status: "missing" });
          return;
        }
        setLoad({ status: "ready", doc: (await res.json()) as ConfessionDoc });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [doc]);

  /* The section pin lands the scroll once the document is ready. */
  useEffect(() => {
    if (!section || load.status !== "ready") return;
    const el = window.document.getElementById(`confession-${load.doc.id}-${section}`);
    el?.scrollIntoView({ block: "start" });
  }, [section, load]);

  if (!doc) {
    /* The corpus browser. */
    return (
      <div className="mx-auto max-w-2xl py-4" data-print-root>
        <header className="glass rounded-[4px] px-3 py-2">
          <p className="small-caps text-xs font-semibold text-amber">Confessions</p>
          <h2 className="font-editorial mt-0.5 text-lg font-semibold">Creeds and Confessions</h2>
          <p className="mt-0.5 text-[0.68rem] text-muted">
            The historic creeds and confessional standards with their scripture proof texts,
            each reference linked into the reader.
          </p>
        </header>
        {works === null ? (
          <p className="mt-4 text-xs text-muted">Opening the corpus…</p>
        ) : works.length === 0 ? (
          <p className="mt-4 text-xs text-muted">The corpus is not furnished on this installation.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {works.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  title={`Read ${w.title}`}
                  onClick={() =>
                    dispatch({
                      type: "replaceTab",
                      paneId,
                      tabId,
                      tab: confessionTab(w.id, undefined, w.label),
                    })
                  }
                  className="block w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-left hover:border-sapphire glass-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="small-caps text-[0.62rem] font-semibold text-muted">
                      {KIND_LABEL[w.kind] ?? w.kind}
                    </span>
                    <span className="text-[0.68rem] text-muted">
                      {w.years} · {w.tradition}
                    </span>
                    <span className="ml-auto text-[0.68rem] text-muted">
                      {w.proofs > 0
                        ? `${w.sections} ${w.sections === 1 ? "article" : "articles"} · ${w.proofs} proofs`
                        : `${w.sections} ${w.sections === 1 ? "article" : "articles"}`}
                    </span>
                  </span>
                  <span className="font-editorial mt-0.5 block text-sm font-semibold">{w.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{w.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Opening the document…</p>;
  }
  if (load.status === "missing") {
    return <p className="text-xs text-muted">This document is not in the corpus.</p>;
  }
  const d = load.doc;
  const proofs = d.sections.reduce((n, s) => n + s.proofs.length, 0);

  const refButton = (r: ConfessionRef, key: number) => (
    <button
      key={key}
      type="button"
      title={`Open ${formatRef(r)} in the reader`}
      onClick={() => dispatch({ type: "openRef", book: r.slug, chapter: r.chapter })}
      className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
    >
      {formatRef(r)}
    </button>
  );

  const matter = (m: ConfessionMatter, i: number) => (
    <GuideSection key={i} title={m.heading} defaultOpen={d.kind === "creed"}>
      <div className="font-reader space-y-3 text-[0.9rem] leading-relaxed">
        {m.paragraphs.map((p, j) => (
          <p key={j}>{markedText(p)}</p>
        ))}
      </div>
    </GuideSection>
  );

  return (
    <div className="mx-auto max-w-prose py-4" data-print-root>
      <header className="mb-6 border-b border-rule pb-4">
        <p className="small-caps text-xs font-semibold text-amber">
          {KIND_LABEL[d.kind] ?? d.kind}
        </p>
        <h2 className="font-editorial mt-0.5 text-xl font-semibold">{d.title}</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {d.subtitle} · {d.years} · {d.tradition}
          {proofs > 0 ? ` · ${proofs} proof ${proofs === 1 ? "text" : "texts"}` : ""}
        </p>
        {d.blurb && <p className="mt-1 text-xs text-muted">{d.blurb}</p>}
        <p className="no-print mt-2 flex items-center gap-3">
          <button
            type="button"
            title="Browse the whole corpus"
            onClick={() =>
              dispatch({ type: "replaceTab", paneId, tabId, tab: confessionTab() })
            }
            className="text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            All documents
          </button>
          <PrintButton />
        </p>
      </header>

      {d.frontMatter.length > 0 && (
        <div className="mb-6 space-y-4">{d.frontMatter.map(matter)}</div>
      )}

      <div className="space-y-8">
        {d.sections.map((s) => {
          const pinned = section === s.id;
          return (
            <section
              key={s.id}
              id={`confession-${d.id}-${s.id}`}
              className={`scroll-mt-4 rounded-[4px] ${pinned ? "bg-paper px-3 py-2 -mx-3 outline outline-1 outline-sapphire" : ""}`}
            >
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="small-caps text-xs font-semibold text-muted">{s.label}</span>
                {s.title && (
                  <span className="font-editorial text-[0.95rem] font-semibold">{s.title}</span>
                )}
              </p>
              <div className="font-reader mt-2 space-y-3 text-[0.9rem] leading-relaxed">
                {s.paragraphs.map((p, i) => (
                  <p key={i}>{markedText(p)}</p>
                ))}
              </div>
              {s.proofs.length > 0 && (
                <ul className="mt-2 space-y-1 border-l-2 border-rule pl-3">
                  {s.proofs.map((p) => (
                    <li key={p.mark} className="text-[0.72rem] leading-relaxed">
                      <span className="font-semibold text-muted">{p.mark}.</span>{" "}
                      {p.refs.length > 0
                        ? collapseRefs(p.refs).map((r, i) => (
                            <span key={i}>
                              {i > 0 ? ", " : ""}
                              {refButton(r, i)}
                            </span>
                          ))
                        : null}
                      {p.note && (
                        <span className="block text-[0.66rem] italic text-muted">
                          Digitization note: {p.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {d.backMatter.length > 0 && (
        <div className="mt-8 space-y-4 border-t border-rule pt-4">{d.backMatter.map(matter)}</div>
      )}

      <p className="mt-8 border-t border-rule pt-2 text-[0.68rem] text-muted">
        A public-domain text; its provenance and digitization are recorded at /sources.
      </p>
    </div>
  );
}
