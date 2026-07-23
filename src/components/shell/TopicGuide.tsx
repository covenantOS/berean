"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useWorkspace } from "./WorkspaceContext";
import GuideSection from "./GuideSection";
import PrintButton from "./PrintButton";

interface TopicGuideRef {
  label: string;
  slug: string;
  chapter: number;
  verse: number | null;
  verseEnd?: number;
}

interface TopicGuideNode {
  label: string;
  refs: TopicGuideRef[];
  moreRefs: number;
  children: TopicGuideNode[];
}

interface RelatedTopic {
  work: string;
  id: string;
  title: string;
}

interface TopicGuideEntity {
  id: string;
  name: string;
  kind: "person" | "place" | "other";
  type: string;
  brief: string;
}

interface TopicGuidePayload {
  work: "naves" | "torreys";
  workLabel: string;
  id: string;
  title: string;
  refs: number;
  sections: TopicGuideNode[];
  related: RelatedTopic[];
  relatedUnresolved: string[];
  otherWork: RelatedTopic | null;
  entities: TopicGuideEntity[];
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; report: TopicGuidePayload };

/** Titles ship lowercase; the header and links capitalize them. */
function capitalize(title: string): string {
  return title.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The Topic Guide pane: one entry of Nave's or Torrey's as a report, pinned
 * at open time. Key Passages walks the entry's section tree with verse
 * chips that open the reader; Related Topics opens the entry's
 * cross-references as new topic guides; People and Places opens the
 * factbook for the entities the title exactly matches. Sections with
 * nothing to say stay out of the report.
 */
export default function TopicGuide({
  work,
  topicId,
}: {
  work: "naves" | "torreys";
  topicId: string;
}) {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/topicguide?work=${encodeURIComponent(work)}&id=${encodeURIComponent(topicId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) {
          setLoad({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", report: (await res.json()) as TopicGuidePayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [work, topicId]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Composing the topic guide…</p>;
  }
  if (load.status === "missing") {
    return <p className="text-xs text-muted">No such topic in this work.</p>;
  }
  const r = load.report;

  const openTopic = (t: RelatedTopic) =>
    dispatch({ type: "openTopicGuide", work: t.work, topicId: t.id, title: t.title });

  const nodeView = (node: TopicGuideNode, depth: number, key: number) => (
    <div key={key} className={depth > 0 ? "ml-4 border-l border-rule pl-4" : ""}>
      {node.label &&
        (depth === 0 ? (
          <p className="small-caps mb-1.5 text-xs text-muted">{node.label}</p>
        ) : (
          <p className="mt-2 mb-1 text-xs font-medium">{node.label}</p>
        ))}
      {node.refs.length > 0 && (
        <p className="flex flex-wrap items-center gap-1">
          {node.refs.map((ref, i) => (
            <button
              key={i}
              type="button"
              title={`Open ${ref.label} in the reader`}
              onClick={() => dispatch({ type: "openRef", book: ref.slug, chapter: ref.chapter })}
              className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire hover:border-sapphire glass-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {ref.label}
            </button>
          ))}
          {node.moreRefs > 0 && (
            <span className="text-[0.68rem] text-muted">and {node.moreRefs} more</span>
          )}
        </p>
      )}
      {node.children.length > 0 && (
        <div className="mt-2 space-y-3">{node.children.map((c, i) => nodeView(c, depth + 1, i))}</div>
      )}
    </div>
  );

  return (
    <div className="fx-stagger space-y-6" data-print-root>
      <header className="glass rounded-[4px] px-3 py-2 print:rounded-none print:border-x-0 print:border-t-0 print:bg-none print:bg-transparent print:shadow-none print:px-0 print:pb-2 print:pt-0">
        <p className="small-caps text-xs font-semibold text-amber">Topic Guide</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold capitalize">{r.title}</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {r.workLabel} · {r.refs.toLocaleString()} {r.refs === 1 ? "reference" : "references"}
        </p>
        <p className="no-print mt-1">
          <PrintButton />
        </p>
      </header>

      {r.sections.length > 0 && (
        <GuideSection stagger={1} title="Key Passages" hint="the entry's own section tree">
          <div className="space-y-4">{r.sections.map((n, i) => nodeView(n, 0, i))}</div>
        </GuideSection>
      )}

      {(r.related.length > 0 || r.otherWork) && (
        <GuideSection stagger={2} title="Related Topics" hint="cross-references inside the topical works">
          <ul className="space-y-1.5">
            {r.related.map((t) => (
              <li key={`${t.work}:${t.id}`}>
                <button
                  type="button"
                  title={`Open the topic guide for ${capitalize(t.title)}`}
                  onClick={() => openTopic(t)}
                  className="text-xs font-medium capitalize text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {t.title}
                </button>
              </li>
            ))}
            {r.otherWork && (
              <li>
                <button
                  type="button"
                  title={`Open the topic guide in ${r.otherWork.work === "naves" ? "Nave's" : "Torrey's"}`}
                  onClick={() => openTopic(r.otherWork!)}
                  className="text-xs font-medium capitalize text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {r.otherWork.title}
                </button>{" "}
                <span className="text-xs text-muted">
                  in {r.otherWork.work === "naves" ? "Nave's" : "Torrey's"}
                </span>
              </li>
            )}
          </ul>
          {r.relatedUnresolved.length > 0 && (
            <p className="mt-2 text-[0.68rem] text-muted">
              Also cross-referenced: {r.relatedUnresolved.join("; ")}.
            </p>
          )}
        </GuideSection>
      )}

      {r.entities.length > 0 && (
        <GuideSection stagger={3} title="People and Places" hint="entity index entries matching this title">
          <ul className="space-y-1.5">
            {r.entities.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  title={`Open the factbook for ${e.name}`}
                  onClick={() => dispatch({ type: "openFactbook", entityId: e.id, title: e.name })}
                  className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {e.name}
                </button>{" "}
                <span className="text-xs text-muted">
                  {e.type.toLowerCase()}
                  {e.brief ? ` · ${e.brief}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      <p
        style={{ "--i": 4 } as CSSProperties}
        className="border-t border-rule pt-2 text-[0.68rem] text-muted"
      >
        {r.workLabel}, a public-domain work, digitized by CCEL and distributed
        through the CrossWire SWORD project.
      </p>
    </div>
  );
}
