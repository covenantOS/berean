"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";
import GuideSection from "./GuideSection";

interface FactbookRelation {
  name: string;
  id: string | null;
}

interface FactbookLocator {
  viewBox: string;
  paths: string[];
  x: number;
  y: number;
}

interface FactbookTimelineEvent {
  id: string;
  label: string;
  years: string;
}

interface FactbookBookRefs {
  slug: string;
  bookName: string;
  refs: { chapter: number; verse: number }[];
}

interface FactbookPayload {
  id: string;
  name: string;
  kind: "person" | "place" | "other";
  type: string;
  tag: string;
  description: string;
  brief: string;
  short: string;
  article: string;
  aliases: string[];
  tribe: string;
  area: string;
  geo: { lat: number; lng: number } | null;
  locator: FactbookLocator | null;
  relations: {
    parents: FactbookRelation[];
    siblings: FactbookRelation[];
    partners: FactbookRelation[];
    offspring: FactbookRelation[];
  };
  timeline: FactbookTimelineEvent[];
  refsByBook: FactbookBookRefs[];
  refCount: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; report: FactbookPayload };

const RELATION_LABELS: [keyof FactbookPayload["relations"], string][] = [
  ["parents", "Parents"],
  ["siblings", "Siblings"],
  ["partners", "Married to"],
  ["offspring", "Children"],
];

/**
 * The Factbook pane: one TIPNR entity's report, pinned at open time. Every
 * section renders data the dataset genuinely carries: identity and prose up
 * top, the atlas locator for geocoded places, the family lists, the timeline
 * join, and the verse mentions as chips that open the reader. Relations with
 * an id open a new Factbook tab; sections with nothing to say stay out of
 * the report.
 */
export default function Factbook({ entityId }: { entityId: string }) {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/factbook?id=${encodeURIComponent(entityId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) {
          setLoad({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", report: (await res.json()) as FactbookPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [entityId]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Composing the factbook…</p>;
  }
  if (load.status === "missing") {
    return <p className="text-xs text-muted">No such entity in the factbook.</p>;
  }
  const r = load.report;

  const openEntity = (rel: FactbookRelation) => {
    if (rel.id) dispatch({ type: "openFactbook", entityId: rel.id, title: rel.name });
  };

  const hasRelations = RELATION_LABELS.some(([key]) => r.relations[key].length > 0);
  const overview = r.brief || (r.short && r.short !== r.brief) || r.article;

  return (
    <div className="space-y-6">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Factbook</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">{r.name}</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {r.kind === "place" ? "Place" : r.type || "Name"}
          {r.description ? ` · ${r.description}` : ""}
          {r.tribe ? ` · ${r.tribe}` : ""}
          {r.tag ? ` · first at ${r.tag}` : ""}
        </p>
        {r.aliases.length > 0 && (
          <p className="mt-0.5 text-[0.68rem] text-muted">Also known as {r.aliases.join(", ")}</p>
        )}
      </header>

      {overview && (
        <GuideSection title="Overview" hint="the dataset's own prose">
          {r.brief && <p className="font-editorial text-sm leading-relaxed">{r.brief}</p>}
          {r.short && r.short !== r.brief && (
            <p className="mt-2 text-xs leading-relaxed">{r.short}</p>
          )}
          {r.article && (
            <div className="mt-2">
              {r.article.split(/\n\n+/).map((para, i) => (
                <p key={i} className="mb-2 text-xs leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          )}
        </GuideSection>
      )}

      {r.locator && r.geo && (
        <GuideSection title="Location" hint={`${r.geo.lat.toFixed(5)}, ${r.geo.lng.toFixed(5)}${r.area ? ` · ${r.area}` : ""}`}>
          <div className="w-full max-w-xs">
            <button
              type="button"
              onClick={() => dispatch({ type: "openAtlas", place: r.id, title: r.name })}
              title={`${r.name} in the Atlas`}
              className="block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              <svg
                viewBox={r.locator.viewBox}
                role="img"
                aria-label={`Locator map for ${r.name}`}
                className="w-full rounded-[4px] border border-rule bg-white hover:border-sapphire"
              >
                <g fill="var(--surface)" stroke="var(--rule)" strokeWidth={0.12}>
                  {r.locator.paths.map((d, i) => (
                    <path key={i} d={d} fillRule="evenodd" />
                  ))}
                </g>
                <circle
                  cx={r.locator.x}
                  cy={r.locator.y}
                  r={0.55}
                  fill="var(--stained-ruby)"
                  stroke="white"
                  strokeWidth={0.12}
                />
                <text
                  x={r.locator.x + 0.9}
                  y={r.locator.y + 0.5}
                  fontSize={1.6}
                  fontFamily="var(--font-editorial, Georgia, serif)"
                  fill="var(--ink, #221d15)"
                  stroke="white"
                  strokeWidth={0.4}
                  paintOrder="stroke"
                >
                  {r.name}
                </text>
              </svg>
            </button>
            <p className="mt-1 text-[0.68rem] text-muted">
              <button
                type="button"
                onClick={() => dispatch({ type: "openAtlas", place: r.id, title: r.name })}
                className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Open in the Atlas
              </button>{" "}
              · modern coastline (Natural Earth, public domain)
            </p>
          </div>
        </GuideSection>
      )}

      {hasRelations && (
        <GuideSection title="Family" hint="the record's relationship lists">
          <div className="space-y-1.5">
            {RELATION_LABELS.map(([key, label]) =>
              r.relations[key].length === 0 ? null : (
                <p key={key} className="text-xs">
                  <span className="small-caps text-[0.68rem] text-muted">{label}: </span>
                  {r.relations[key].map((rel, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      {rel.id ? (
                        <button
                          type="button"
                          title={`Open the factbook for ${rel.name}`}
                          onClick={() => openEntity(rel)}
                          className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                        >
                          {rel.name}
                        </button>
                      ) : (
                        rel.name
                      )}
                    </span>
                  ))}
                </p>
              )
            )}
          </div>
        </GuideSection>
      )}

      {r.timeline.length > 0 && (
        <GuideSection title="On the Timeline" hint="dated events linked to this entity">
          <ul className="space-y-1">
            {r.timeline.map((e) => (
              <li key={e.id} className="text-xs">
                <button
                  type="button"
                  title={`Open ${e.label} on the Timeline`}
                  onClick={() => dispatch({ type: "openTimeline", event: e.id, title: e.label })}
                  className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {e.label}
                </button>{" "}
                <span className="text-[0.68rem] text-muted">{e.years}</span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {r.refCount > 0 && (
        <GuideSection
          title="Every Reference"
          hint={`${r.refCount.toLocaleString()} ${r.refCount === 1 ? "verse" : "verses"}`}
        >
          <div className="space-y-3">
            {r.refsByBook.map((b) => (
              <div key={b.slug}>
                <p className="mb-1 text-xs font-medium">{b.bookName}</p>
                <p className="flex flex-wrap items-center gap-1">
                  {b.refs.map((ref, i) => (
                    <button
                      key={i}
                      type="button"
                      title={`Open ${b.bookName} ${ref.chapter}:${ref.verse} in the reader`}
                      onClick={() =>
                        dispatch({ type: "openRef", book: b.slug, chapter: ref.chapter })
                      }
                      className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      {ref.chapter}:{ref.verse}
                    </button>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </GuideSection>
      )}

      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        People and places: TIPNR, data created by www.STEPBible.org based on
        work at Tyndale House Cambridge (CC BY 4.0).
      </p>
    </div>
  );
}
