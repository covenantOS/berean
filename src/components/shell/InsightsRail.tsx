"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useWorkspaceDispatch } from "./WorkspaceContext";

interface InsightCommentary {
  id: string;
  label: string;
  sections: number;
  excerpt: { verses: string; text: string };
}

interface InsightCrossRef {
  sourceVerse: number;
  ref: string;
  slug: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  votes: number;
}

interface InsightMention {
  id: string;
  name: string;
  kind: "person" | "place" | "other";
  type: string;
  brief: string;
  verses: number;
}

interface InsightTopic {
  work: string;
  id: string;
  title: string;
  verses: number;
}

interface InsightWord {
  strongs: string;
  count: number;
  lemma: string | null;
  xlit: string | null;
  gloss: string | null;
}

interface InsightsPayload {
  book: string;
  bookName: string;
  chapter: number;
  commentary: InsightCommentary[];
  crossRefs: InsightCrossRef[];
  crossRefsTotal: number;
  people: InsightMention[];
  places: InsightMention[];
  others: InsightMention[];
  topics: InsightTopic[];
  notableWords: InsightWord[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; guide: InsightsPayload };

/** Card excerpts hold to two lines; the guide carries the full passage. */
function trimCard(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const last = cut.lastIndexOf(" ");
  return `${cut.slice(0, last > 0 ? last : max).trimEnd()} …`;
}

const CHIP =
  "inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire hover:border-sapphire glass-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

/**
 * The insights rail: the chapter's resources as compact cards at the head of
 * the reader, answering the passage in focus without opening a guide tab. It
 * rides the same /api/pane/guide composition as the Passage Guide, stays
 * chapter-scoped (the payload carries no cheaper per-verse cut), and every
 * card hands off to the full guide. Cards with nothing to say stay out.
 */
export default function InsightsRail({
  paneId,
  book,
  chapter,
}: {
  paneId: string;
  book: string;
  chapter: number;
}) {
  const { dispatch, reportHoverRef } = useWorkspaceDispatch();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  // One composition per chapter, aborted when the passage moves on. The rail
  // mounts only while its toggle is on, so the text always paints first.
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/guide?book=${encodeURIComponent(book)}&chapter=${chapter}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", guide: (await res.json()) as InsightsPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter]);

  const openGuide = () => dispatch({ type: "openGuide", book, chapter, paneId });

  const card = (i: number, title: string, hint: string, children: ReactNode) => (
    <section
      key={title}
      style={{ "--i": i } as CSSProperties}
      className="glass glass-hover rounded-[4px] px-3 py-2"
    >
      <p className="flex items-baseline gap-2">
        <span className="small-caps text-[0.68rem] font-semibold text-muted">{title}</span>
        <span className="text-[0.68rem] text-muted">{hint}</span>
        <button
          type="button"
          onClick={openGuide}
          className="ml-auto text-[0.68rem] text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Open guide
        </button>
      </p>
      <div className="mt-1.5">{children}</div>
    </section>
  );

  let body: ReactNode;
  if (load.status === "loading") {
    body = <p className="text-xs text-muted">Gathering insights…</p>;
  } else if (load.status === "error") {
    body = <p className="text-xs text-muted">The insights could not be gathered.</p>;
  } else {
    const g = load.guide;
    const cards: ReactNode[] = [];

    if (g.commentary.length > 0) {
      const top = g.commentary[0];
      cards.push(
        card(
          cards.length,
          "Commentaries",
          `${g.commentary.length} ${g.commentary.length === 1 ? "work" : "works"} on the shelf`,
          <>
            <p className="text-xs">
              <span className="small-caps font-semibold text-muted">{top.label}</span>{" "}
              <span className="text-muted">Verses {top.excerpt.verses}</span>
            </p>
            <p className="mt-1 font-reader text-[0.8rem] leading-relaxed text-muted">
              {trimCard(top.excerpt.text)}
            </p>
          </>
        )
      );
    }

    if (g.crossRefs.length > 0) {
      cards.push(
        card(
          cards.length,
          "Cross References",
          `${g.crossRefsTotal} in the chapter, top by votes`,
          <p className="flex flex-wrap gap-1.5">
            {g.crossRefs.slice(0, 4).map((r, i) => (
              <button
                key={i}
                type="button"
                title={`Open ${r.ref}`}
                onMouseEnter={() =>
                  reportHoverRef({
                    book: r.slug,
                    chapter: r.chapter,
                    fromVerse: r.verse,
                    toVerse: r.endVerse ?? r.verse,
                  })
                }
                onMouseLeave={() => reportHoverRef(null)}
                onClick={() => dispatch({ type: "openRef", book: r.slug, chapter: r.chapter })}
                className={CHIP}
              >
                {r.ref}
              </button>
            ))}
          </p>
        )
      );
    }

    if (g.people.length > 0 || g.places.length > 0) {
      const mentioned = [
        ...g.people.map((m) => ({ ...m, role: "person" as const })),
        ...g.places.map((m) => ({ ...m, role: "place" as const })),
      ];
      cards.push(
        card(
          cards.length,
          "People & Places",
          `${g.people.length + g.places.length} mentioned`,
          <p className="flex flex-wrap gap-1.5">
            {mentioned.slice(0, 8).map((m) => (
              <button
                key={m.id}
                type="button"
                title={`Open the factbook for ${m.name}`}
                onClick={() =>
                  dispatch({ type: "openFactbook", entityId: m.id, title: m.name, paneId })
                }
                className={CHIP}
              >
                {m.name}
              </button>
            ))}
          </p>
        )
      );
    }

    if (g.topics.length > 0) {
      cards.push(
        card(
          cards.length,
          "Topics",
          "Nave's and Torrey's citing this chapter",
          <p className="flex flex-wrap gap-1.5">
            {g.topics.slice(0, 6).map((t) => (
              <button
                key={`${t.work}:${t.id}`}
                type="button"
                title={`Open the topic guide for ${t.title}`}
                onClick={() =>
                  dispatch({
                    type: "openTopicGuide",
                    work: t.work,
                    topicId: t.id,
                    title: t.title,
                    paneId,
                  })
                }
                className={CHIP}
              >
                {t.title}
              </button>
            ))}
          </p>
        )
      );
    }

    if (g.notableWords.length > 0) {
      cards.push(
        card(
          cards.length,
          "Notable Words",
          "most frequent in the chapter's tagging",
          <p className="flex flex-wrap gap-1.5">
            {g.notableWords.map((w) => (
              <button
                key={w.strongs}
                type="button"
                title={`Open ${w.strongs} in the lexicon`}
                onClick={() => dispatch({ type: "openLexicon", id: w.strongs })}
                className={CHIP}
              >
                {w.gloss ?? w.strongs}
              </button>
            ))}
          </p>
        )
      );
    }

    body =
      cards.length > 0 ? (
        <div className="fx-stagger space-y-2">{cards}</div>
      ) : (
        <p className="text-xs text-muted">Nothing gathered for this chapter yet.</p>
      );
  }

  return (
    <div dir="ltr" className="mx-auto max-w-prose px-6">
      <div className="glass mt-4 space-y-2 rounded-[4px] px-3 py-2 font-[family-name:var(--font-interface)] print:bg-none print:bg-transparent print:shadow-none">
        <p className="small-caps text-xs font-semibold text-amber">Insights</p>
        {body}
      </div>
    </div>
  );
}
