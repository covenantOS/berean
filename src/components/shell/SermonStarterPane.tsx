"use client";

import { useEffect, useState } from "react";
import { useCollection } from "@/lib/hooks";
import { createProject, priorHandlings, projects } from "@/lib/projects";
import { useWorkspace } from "./WorkspaceContext";
import GuideSection from "./GuideSection";
import PrintButton from "./PrintButton";

interface StarterTheme {
  work: "naves" | "torreys";
  id: string;
  title: string;
  verses: number;
}

interface StarterKeyPassage {
  ref: string;
  slug: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  votes: number;
  /** How many of the chapter's verses cite this text. */
  senders: number;
  /** A preaching theme's entry also cites this text. */
  topicCited: boolean;
}

interface StarterWord {
  strongs: string;
  count: number;
  lemma: string | null;
  xlit: string | null;
  gloss: string | null;
}

interface StarterParallel {
  /** The verse in the report's own chapter the row hangs on. */
  verse: number;
  endVerse?: number;
  /** "quotes": the chapter quotes the row's OT text; "quotedBy": the row's
   * NT passage quotes the chapter. */
  direction: "quotes" | "quotedBy";
  kind: "quotation" | "allusion";
  formula?: "written" | "fulfilled";
  note?: string;
  ref: string;
  slug: string;
  chapter: number;
  fromVerse: number;
  toVerse: number;
}

interface StarterPlace {
  id: string;
  name: string;
  brief: string;
  verses: number;
}

interface StarterPayload {
  book: string;
  bookName: string;
  chapter: number;
  themes: StarterTheme[];
  keyPassages: StarterKeyPassage[];
  keyVerse: number;
  notableWords: StarterWord[];
  parallels: StarterParallel[];
  places: StarterPlace[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; starter: StarterPayload };

/**
 * The Sermon Starter pane: one chapter composed into a preaching report,
 * pinned at open time. The themes are the topical works' entries citing the
 * chapter (the theme layer; no Preaching Themes dataset ships), the key
 * passages rank the chapter's cross-references against the themes' key
 * verses, Out of the Text carries the exegetical hooks, and the media
 * section hands off to the verse card studio and the atlas. The Sermons
 * section reads the device: it lists the projects already standing on this
 * passage and starts a new sermon pinned to it. No illustration bank ships,
 * so the report offers none. Every row deep-links its source.
 */
export default function SermonStarterPane({ book, chapter }: { book: string; chapter: number }) {
  const { dispatch, reportHoverRef } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  /* The Sermons section reads the projects collection live, so a project
   * started here lists at once and edits land without a refetch. */
  useCollection(projects);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/sermonstarter?book=${encodeURIComponent(book)}&chapter=${chapter}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", starter: (await res.json()) as StarterPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Composing the sermon starter…</p>;
  }
  if (load.status === "error") {
    return <p className="text-xs text-muted">The sermon starter could not be composed.</p>;
  }
  const s = load.starter;
  const reference = `${s.bookName} ${s.chapter}`;
  const prior = priorHandlings(s.book, s.chapter);

  /* Start the sermon: a sermon project pinned to this passage, opened
   * straight into its pipeline, the pulpit form's own path. */
  const startSermon = () => {
    const p = createProject(reference, s.book, s.chapter, "sermon");
    dispatch({ type: "openProject", projectId: p.id, title: p.title });
  };

  return (
    <div className="space-y-6" data-print-root>
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Sermon Starter</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">{reference}</h2>
        <p className="no-print mt-1 flex items-center gap-3">
          <PrintButton />
        </p>
      </header>

      {s.themes.length > 0 && (
        <GuideSection
          title="Themes"
          hint="the topical works as the theme layer · entries citing this chapter"
        >
          <ul className="space-y-1.5">
            {s.themes.map((t) => (
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

      {s.keyPassages.length > 0 && (
        <GuideSection
          title="Key Passages"
          hint="the texts the most verses of the chapter cite first; a theme citation breaks ties"
        >
          <ul className="space-y-1.5">
            {s.keyPassages.map((r) => (
              <li key={`${r.slug}:${r.chapter}:${r.verse}`} className="flex items-baseline gap-2">
                <button
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
                  className="small-caps text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {r.ref}
                </button>
                <span className="min-w-0 flex-1 truncate text-[0.68rem] text-muted">
                  {[
                    r.senders > 1
                      ? `${r.senders} verses of the chapter cite it`
                      : r.votes > 0
                        ? `${r.votes} ${r.votes === 1 ? "vote" : "votes"}`
                        : null,
                    r.topicCited ? "cited by a theme" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {(s.notableWords.length > 0 || s.parallels.length > 0) && (
        <GuideSection
          title="Out of the Text"
          hint="exegetical hooks from the chapter's tagging and quotations"
        >
          <div className="space-y-3">
            {s.notableWords.length > 0 && (
              <div>
                <p className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
                  Notable words
                </p>
                <ul className="space-y-1.5">
                  {s.notableWords.map((w) => (
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
              </div>
            )}
            {s.parallels.length > 0 && (
              <div>
                <p className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
                  Quotations and echoes
                </p>
                <ul className="space-y-1.5">
                  {s.parallels.map((r, i) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className="w-8 shrink-0 text-[0.68rem] text-muted">v{r.verse}</span>
                      <button
                        type="button"
                        title={`Open ${r.ref}`}
                        onMouseEnter={() =>
                          reportHoverRef({
                            book: r.slug,
                            chapter: r.chapter,
                            fromVerse: r.fromVerse,
                            toVerse: r.toVerse,
                          })
                        }
                        onMouseLeave={() => reportHoverRef(null)}
                        onClick={() =>
                          dispatch({ type: "openRef", book: r.slug, chapter: r.chapter })
                        }
                        className="small-caps text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        {r.ref}
                      </button>
                      <span className="min-w-0 flex-1 truncate text-[0.68rem] text-muted">
                        {[
                          r.direction === "quotedBy" ? "quoting this chapter" : null,
                          r.kind === "allusion" ? "allusion" : null,
                          r.formula === "written"
                            ? "it is written"
                            : r.formula === "fulfilled"
                              ? "that it might be fulfilled"
                              : null,
                          r.note ?? null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </GuideSection>
      )}

      {/* Media is composed, not stocked: the card link always answers, and
       * each place the chapter mentions hands off to the atlas. */}
      <GuideSection title="Media" hint="composed on this device">
        <ul className="space-y-1.5">
          <li>
            <button
              type="button"
              title={`Compose a verse card from ${reference}:${s.keyVerse}`}
              onClick={() =>
                dispatch({
                  type: "openMedia",
                  book: s.book,
                  chapter: s.chapter,
                  verse: s.keyVerse,
                })
              }
              className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Verse card
            </button>{" "}
            <span className="text-xs text-muted">
              compose a share card from {reference}:{s.keyVerse}, the chapter&apos;s key verse
            </span>
          </li>
          {s.places.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                title={`Open ${m.name} in the atlas`}
                onClick={() => dispatch({ type: "openAtlas", place: m.id, title: m.name })}
                className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Map: {m.name}
              </button>{" "}
              <span className="text-xs text-muted">
                {m.verses} {m.verses === 1 ? "verse" : "verses"} mention it
              </span>
            </li>
          ))}
        </ul>
      </GuideSection>

      {/* The pulpit handoff: start the sermon pinned to this passage, and
       * open the projects already standing on it. */}
      <GuideSection title="Sermons" hint="the pulpit takes it from here">
        <div className="space-y-3">
          <p className="no-print">
            <button
              type="button"
              title={`Start a sermon project on ${reference}`}
              onClick={startSermon}
              className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Start the sermon
            </button>
          </p>
          {prior.length > 0 && (
            <ul className="space-y-1.5">
              {prior.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    title={`Open ${p.title}`}
                    onClick={() =>
                      dispatch({ type: "openProject", projectId: p.id, title: p.title })
                    }
                    className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    {p.title}
                  </button>{" "}
                  <span className="text-xs text-muted">
                    {p.kind}
                    {p.series ? ` · ${p.series}` : ""}
                    {p.status !== "preparing" ? ` · ${p.status}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GuideSection>

      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Composed from the datasets shipped on this installation; every section
        opens its source.
      </p>
    </div>
  );
}
