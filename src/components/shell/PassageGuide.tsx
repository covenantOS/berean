"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";
import GuideSection from "./GuideSection";

interface GuideCommentary {
  id: string;
  label: string;
  sections: number;
  excerpt: { verses: string; text: string };
}

interface GuideCrossRef {
  sourceVerse: number;
  ref: string;
  slug: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  votes: number;
}

interface GuideMention {
  id: string;
  name: string;
  kind: "person" | "place" | "other";
  type: string;
  brief: string;
  verses: number;
}

interface GuideTopic {
  work: string;
  id: string;
  title: string;
  verses: number;
}

interface GuideTimelineEvent {
  id: string;
  label: string;
  years: string;
  refs: { label: string; slug: string; chapter: number; verse: number | null }[];
}

interface GuideWord {
  strongs: string;
  count: number;
  lemma: string | null;
  xlit: string | null;
  gloss: string | null;
}

interface GuidePayload {
  book: string;
  bookName: string;
  chapter: number;
  commentary: GuideCommentary[];
  crossRefs: GuideCrossRef[];
  people: GuideMention[];
  places: GuideMention[];
  others: GuideMention[];
  topics: GuideTopic[];
  timeline: GuideTimelineEvent[];
  notableWords: GuideWord[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; guide: GuidePayload };

/**
 * The Passage Guide pane: the chapter's datasets composed into one report,
 * pinned at open time. Every section deep-links back into the workspace: a
 * commentary's verses and a cross-reference open the passage, a person or
 * place opens its entity page, a notable word opens the lexicon. Sections
 * with nothing to say stay out of the report.
 */
export default function PassageGuide({ book, chapter }: { book: string; chapter: number }) {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/guide?book=${encodeURIComponent(book)}&chapter=${chapter}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", guide: (await res.json()) as GuidePayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Composing the guide…</p>;
  }
  if (load.status === "error") {
    return <p className="text-xs text-muted">The guide could not be composed.</p>;
  }
  const g = load.guide;
  const reference = `${g.bookName} ${g.chapter}`;

  const mentionRow = (m: GuideMention) => (
    <li key={m.id}>
      <Link
        href={`/library/entity/${m.id}`}
        className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        {m.name}
      </Link>{" "}
      <span className="text-xs text-muted">
        {m.type.toLowerCase()}
        {m.brief ? ` · ${m.brief}` : ""} · {m.verses} {m.verses === 1 ? "verse" : "verses"}
      </span>
    </li>
  );

  return (
    <div className="space-y-6">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Passage Guide</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">{reference}</h2>
      </header>

      {g.commentary.length > 0 && (
        <GuideSection
          title="Commentaries"
          hint={`${g.commentary.length} ${g.commentary.length === 1 ? "work" : "works"} on the shelf`}
        >
          <div className="space-y-4">
            {g.commentary.map((w) => (
              <div key={w.id}>
                <p className="flex items-baseline gap-2">
                  <span className="small-caps text-xs font-semibold text-muted">{w.label}</span>
                  <button
                    type="button"
                    title={`Open ${reference} in the reader`}
                    onClick={() => dispatch({ type: "openRef", book: g.book, chapter: g.chapter })}
                    className="text-xs font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    Verses {w.excerpt.verses}
                  </button>
                  <span className="ml-auto text-[0.68rem] text-muted">
                    {w.sections} {w.sections === 1 ? "section" : "sections"}
                  </span>
                </p>
                <p className="mt-1 font-reader text-[0.84rem] leading-relaxed text-muted">
                  {w.excerpt.text}
                </p>
              </div>
            ))}
          </div>
        </GuideSection>
      )}

      {g.crossRefs.length > 0 && (
        <GuideSection title="Cross References" hint="Treasury of Scripture Knowledge, top by votes">
          <ul className="space-y-1.5">
            {g.crossRefs.map((r, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="w-8 shrink-0 text-[0.68rem] text-muted">v{r.sourceVerse}</span>
                <button
                  type="button"
                  title={`Open ${r.ref}`}
                  onClick={() => dispatch({ type: "openRef", book: r.slug, chapter: r.chapter })}
                  className="small-caps text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {r.ref}
                </button>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {g.people.length > 0 && (
        <GuideSection title="People" hint={`${g.people.length} mentioned`}>
          <ul className="space-y-1.5">{g.people.map(mentionRow)}</ul>
        </GuideSection>
      )}

      {g.places.length > 0 && (
        <GuideSection title="Places" hint={`${g.places.length} mentioned`}>
          <ul className="space-y-1.5">{g.places.map(mentionRow)}</ul>
        </GuideSection>
      )}

      {g.others.length > 0 && (
        <GuideSection title="Things" hint={`${g.others.length} mentioned`} defaultOpen={false}>
          <ul className="space-y-1.5">{g.others.map(mentionRow)}</ul>
        </GuideSection>
      )}

      {g.topics.length > 0 && (
        <GuideSection title="Topics" hint="Nave's and Torrey's citing this chapter">
          <ul className="space-y-1.5">
            {g.topics.map((t) => (
              <li key={`${t.work}:${t.id}`}>
                <button
                  type="button"
                  title={`Open the topic guide for ${t.title}`}
                  onClick={() =>
                    dispatch({ type: "openTopicGuide", work: t.work, topicId: t.id, title: t.title })
                  }
                  className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {t.title}
                </button>{" "}
                <span className="text-xs text-muted">
                  {t.work === "naves" ? "Nave's" : "Torrey's"} · {t.verses}{" "}
                  {t.verses === 1 ? "verse" : "verses"}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {g.timeline.length > 0 && (
        <GuideSection title="Timeline" hint="events touching this chapter">
          <ul className="space-y-2">
            {g.timeline.map((e) => (
              <li key={e.id}>
                <p className="text-xs">
                  <span className="font-medium">{e.label}</span>{" "}
                  <span className="text-muted">{e.years}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap gap-1.5">
                  {e.refs.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      title={`Open ${r.label}`}
                      onClick={() => dispatch({ type: "openRef", book: r.slug, chapter: r.chapter })}
                      className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      {r.label}
                    </button>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {g.notableWords.length > 0 && (
        <GuideSection title="Notable Words" hint="most frequent in the chapter's tagging">
          <ul className="space-y-1.5">
            {g.notableWords.map((w) => (
              <li key={w.strongs} className="flex items-baseline gap-2">
                <button
                  type="button"
                  title={`Open ${w.strongs} in the lexicon`}
                  onClick={() => dispatch({ type: "openLexicon", id: w.strongs })}
                  className="shrink-0 text-xs font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {w.strongs}
                </button>
                {w.lemma && (
                  <span className={w.strongs.startsWith("H") ? "lang-hebrew" : "lang-greek"}>
                    {w.lemma}
                  </span>
                )}
                {w.xlit && <span className="text-xs italic text-muted">{w.xlit}</span>}
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{w.gloss}</span>
                <span className="shrink-0 text-[0.68rem] text-muted">×{w.count}</span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Composed from the datasets shipped on this installation; every section
        opens its source.
      </p>
    </div>
  );
}
