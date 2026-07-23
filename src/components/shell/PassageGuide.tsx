"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  activeCollection,
  collections,
  getActiveCollectionId,
  scopedWallWorkIds,
} from "@/lib/collections";
import type { CommentaryWorkMeta } from "@/lib/commentary";
import {
  DEFAULT_FACETS,
  filterWall,
  sortWall,
  type CommentaryFacets,
} from "@/lib/commentaryFacets";
import { GUIDE_SECTIONS, type GuideSectionKey } from "@/lib/guides";
import { useCollection } from "@/lib/hooks";
import { commentaryPriority, librarymeta } from "@/lib/librarymeta";
import { copyReferences } from "@/lib/powerLookup";
import { playSound } from "@/lib/sound";
import { useWorkspaceDispatch } from "./WorkspaceContext";
import CommentaryFacetBar from "./CommentaryFacetBar";
import GuideSection from "./GuideSection";
import PrintButton from "./PrintButton";

interface GuideCommentary {
  id: string;
  label: string;
  meta: CommentaryWorkMeta;
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

interface GuideParallel {
  /** The verse in the guide's own chapter the row hangs on. */
  verse: number;
  endVerse?: number;
  /** "quotes": the chapter quotes the row's OT text; "quotedBy": the row's
   * NT passage quotes the chapter. */
  direction: "quotes" | "quotedBy";
  kind: "quotation" | "allusion";
  formula?: "written" | "fulfilled";
  note?: string;
  /** The other side of the parallel. */
  ref: string;
  slug: string;
  chapter: number;
  fromVerse: number;
  toVerse: number;
}

interface GuideGospelParallel {
  chapter: number;
  verse: number;
  heading: string;
  /** Display names of the other gospels carrying a parallel account. */
  gospels: string[];
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

interface GuideConfession {
  work: string;
  workLabel: string;
  kind: "creed" | "catechism" | "confession";
  sectionId: string;
  label: string;
  title: string;
  /** Display labels of the article's references inside this chapter, capped. */
  refs: string[];
  moreRefs: number;
  citations: number;
}

interface GuideSermon {
  slug: string;
  title: string;
  /** Canonical sermon number where the archive records one. */
  number: string | null;
  year: number | null;
  /** The appointed text as printed. */
  ref: string | null;
  volume: string | null;
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

interface GuideCompareRow {
  verse: number;
  /** The abbreviations of the texts that differ from the base at this verse. */
  translations: string[];
  /** The word-level differences counted across those texts. */
  words: number;
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
  /** Null only where the book's metadata is missing, which the canon never is. */
  questions: { label: string; questions: string[] } | null;
  /** Null when the base or a second text is missing, or every text agrees. */
  compareVersions: { base: string; rows: GuideCompareRow[] } | null;
  parallels: GuideParallel[];
  gospelParallels: GuideGospelParallel[];
  confessions: GuideConfession[];
  sermons: GuideSermon[];
  /** The archive's full count for the chapter when the payload caps the rows. */
  sermonsTotal: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; guide: GuidePayload };

/**
 * The Passage Guide pane: the chapter's datasets composed into one report,
 * pinned at open time. Every section deep-links back into the workspace: a
 * commentary's verses and a cross-reference open the passage, a person or
 * place opens its factbook, a notable word opens the lexicon. Sections
 * with nothing to say stay out of the report. Two sections are composed
 * rather than stocked and always answer: Media, and Questions to Ask,
 * whose inductive set keys on the genre of the book the chapter sits in
 * (src/lib/studyquestions.ts).
 *
 * A custom guide (src/lib/guides.ts) runs through this same pane: it passes
 * its section keys in its own order and its name, and the report renders
 * only those sections, in that order, under that name.
 *
 * The Commentaries section honors collection scoping (src/lib/collections.ts):
 * a custom guide's pinned collection wins, the workspace's active collection
 * applies otherwise, and with neither the whole shelf answers. The route is
 * server-side and cannot see device data, so the filter applies here by
 * work id after the fetch, the same handoff as the dock's wall. The section
 * also carries the facet controls (src/lib/commentaryFacets.ts): ordering by
 * priority, author, or era and narrowing by tradition and type, over the
 * metadata the route returns with each work.
 */
export default function PassageGuide({
  book,
  chapter,
  sections,
  guideName,
  commentaryCollectionId,
}: {
  book: string;
  chapter: number;
  /** A custom guide's section keys in its order; absent renders every section. */
  sections?: GuideSectionKey[];
  /** A custom guide's name, worn in the header in place of "Passage Guide". */
  guideName?: string;
  /** A custom guide's commentaries scope: a collection id, null for the
   * whole shelf, absent to follow the workspace's active collection. */
  commentaryCollectionId?: string | null;
}) {
  const { dispatch, reportHoverRef } = useWorkspaceDispatch();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  /** Quiet confirmation for the copy actions; clears itself. */
  const [copied, setCopied] = useState<"texts" | "link" | null>(null);
  /** Ordering and narrowing of the commentaries section. */
  const [facets, setFacets] = useState<CommentaryFacets>(DEFAULT_FACETS);
  const savedCollections = useCollection(collections);
  useCollection(activeCollection);
  /* Membership reads librarymeta live; subscribing keeps the scope honest
   * as tags and ratings change. */
  useCollection(librarymeta);

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

  /* A guide's pinned collection wins over the workspace's active one; null
   * from a guide means the whole shelf, whatever the workspace says. */
  const scopeId =
    commentaryCollectionId === undefined ? getActiveCollectionId() : commentaryCollectionId;
  const scope = savedCollections.find((c) => c.id === scopeId) ?? null;
  const scopeIds = scope ? scopedWallWorkIds(scope.rules) : null;
  const scopedCommentary = scopeIds
    ? g.commentary.filter((w) => scopeIds.has(w.id))
    : g.commentary;
  /* Facets narrow by tradition and type, then order by priority (the
   * reader's shelf order), author, or era; applied client-side after the
   * fetch, the same handoff as the dock's wall. */
  const commentary = sortWall(
    filterWall(scopedCommentary, facets),
    facets.sort,
    commentaryPriority()?.order
  );

  const confirm = (what: "texts" | "link") => {
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1500);
  };

  /* Power Lookup copy: every cross-reference and dated timeline passage on
   * the page, expanded to its KJV text in one clipboard write. */
  const copyAllTexts = () => {
    const refs = [
      ...g.crossRefs.map((r) => ({ book: r.slug, chapter: r.chapter, from: r.verse, to: r.endVerse })),
      ...g.timeline.flatMap((e) =>
        e.refs
          .filter((r) => r.verse !== null)
          .map((r) => ({ book: r.slug, chapter: r.chapter, from: r.verse as number }))
      ),
    ];
    void copyReferences(refs).then((ok) => {
      if (ok) {
        confirm("texts");
        playSound("complete");
      }
    });
  };

  /* The chapter's stable reader URL, for citing the guide's subject. */
  const copyLink = () => {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/read/${g.book}/${g.chapter}`)
      .then(() => {
        confirm("link");
        playSound("complete");
      })
      .catch(() => {});
  };

  const ACTION =
    "text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

  const mentionRow = (m: GuideMention) => (
    <li key={m.id}>
      <button
        type="button"
        title={`Open the factbook for ${m.name}`}
        onClick={() => dispatch({ type: "openFactbook", entityId: m.id, title: m.name })}
        className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        {m.name}
      </button>{" "}
      <span className="text-xs text-muted">
        {m.type.toLowerCase()}
        {m.brief ? ` · ${m.brief}` : ""} · {m.verses} {m.verses === 1 ? "verse" : "verses"}
      </span>
    </li>
  );

  /* The section renderers, one per section the guide API composes. A custom
   * guide filters and orders this record; the full guide renders it in the
   * registry's order. A section with nothing to say stays null either way. */
  const sectionNodes: Record<GuideSectionKey, ReactNode> = {
    commentary:
      scopedCommentary.length > 0 ? (
        <GuideSection
          title="Commentaries"
          hint={
            scope
              ? `${scopedCommentary.length} ${scopedCommentary.length === 1 ? "work" : "works"} answering from ${scope.name}`
              : `${scopedCommentary.length} ${scopedCommentary.length === 1 ? "work" : "works"} on the shelf`
          }
        >
          <CommentaryFacetBar works={scopedCommentary} facets={facets} onChange={setFacets} />
          {commentary.length === 0 ? (
            <p className="text-xs text-muted">No work on the shelf matches those facets.</p>
          ) : (
          <div className="space-y-4">
            {commentary.map((w) => (
              <div key={w.id}>
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="small-caps text-xs font-semibold text-muted">{w.label}</span>
                  <span className="text-[0.68rem] text-muted">
                    {w.meta.years} · {w.meta.tradition}
                  </span>
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
          )}
        </GuideSection>
      ) : null,

    crossRefs:
      g.crossRefs.length > 0 ? (
        <GuideSection title="Cross References" hint="Treasury of Scripture Knowledge, top by votes">
          <ul className="space-y-1.5">
            {g.crossRefs.map((r, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="w-8 shrink-0 text-[0.68rem] text-muted">v{r.sourceVerse}</span>
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
              </li>
            ))}
          </ul>
        </GuideSection>
      ) : null,

    parallels:
      g.parallels.length > 0 || g.gospelParallels.length > 0 ? (
        <GuideSection
          title="Parallel Passages"
          hint={
            [
              g.parallels.filter((r) => r.direction === "quotes").length > 0
                ? `${g.parallels.filter((r) => r.direction === "quotes").length} quoted here`
                : null,
              g.parallels.filter((r) => r.direction === "quotedBy").length > 0
                ? `${g.parallels.filter((r) => r.direction === "quotedBy").length} quoting this chapter`
                : null,
              g.gospelParallels.length > 0
                ? `${g.gospelParallels.length} gospel ${g.gospelParallels.length === 1 ? "parallel" : "parallels"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        >
          <div className="space-y-3">
            {(["quotes", "quotedBy"] as const).map((dir) => {
              const rows = g.parallels.filter((r) => r.direction === dir);
              if (rows.length === 0) return null;
              return (
                <div key={dir}>
                  <p className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
                    {dir === "quotes" ? "Old Testament quoted here" : "Quoted in the New Testament"}
                  </p>
                  <ul className="space-y-1.5">
                    {rows.map((r, i) => (
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
              );
            })}
            {g.gospelParallels.length > 0 && (
              <div>
                <p className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
                  Gospel parallels
                </p>
                <ul className="space-y-1.5">
                  {g.gospelParallels.map((p) => (
                    <li key={`${p.chapter}:${p.verse}`} className="flex items-baseline gap-2">
                      <button
                        type="button"
                        title={`Open ${p.heading} in the harmony reader`}
                        onClick={() =>
                          dispatch({
                            type: "openHarmony",
                            book: g.book,
                            chapter: p.chapter,
                            verse: p.verse,
                          })
                        }
                        className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        {p.heading}
                      </button>
                      <span className="min-w-0 flex-1 truncate text-[0.68rem] text-muted">
                        {p.gospels.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </GuideSection>
      ) : null,

    confessions:
      g.confessions.length > 0 ? (
        <GuideSection
          title="Confessional Documents"
          hint="catechism and confession articles citing this chapter"
        >
          <ul className="space-y-1.5">
            {g.confessions.map((c) => (
              <li key={`${c.work}:${c.sectionId}`} className="flex items-baseline gap-2">
                <button
                  type="button"
                  title={`Open ${c.title || c.label} in ${c.workLabel}`}
                  onClick={() =>
                    dispatch({
                      type: "openConfession",
                      doc: c.work,
                      section: c.sectionId,
                      title: c.workLabel,
                    })
                  }
                  className="shrink-0 text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {c.workLabel} {c.label}
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {c.title ? `${c.title} · ` : ""}
                  {c.refs.join(", ")}
                  {c.moreRefs > 0 ? `, and ${c.moreRefs} more` : ""}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      ) : null,

    sermons:
      g.sermons.length > 0 ? (
        <GuideSection
          title="Sermons"
          hint={`Spurgeon's sermons on a text in this chapter${
            g.sermonsTotal > g.sermons.length
              ? ` · first ${g.sermons.length} of ${g.sermonsTotal}`
              : ""
          }`}
        >          <ul className="space-y-1.5">
            {g.sermons.map((s) => (
              <li key={s.slug} className="flex items-baseline gap-2">
                <button
                  type="button"
                  title={`Open "${s.title}" in the sermon reader`}
                  onClick={() => dispatch({ type: "openSermon", slug: s.slug, title: s.title })}
                  className="min-w-0 flex-1 truncate text-left text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {s.title}
                </button>
                <span className="shrink-0 text-[0.68rem] text-muted">
                  {[s.year, s.ref, s.number ? `No. ${s.number}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      ) : null,

    people:
      g.people.length > 0 ? (
        <GuideSection title="People" hint={`${g.people.length} mentioned`}>
          <ul className="space-y-1.5">{g.people.map(mentionRow)}</ul>
        </GuideSection>
      ) : null,

    places:
      g.places.length > 0 ? (
        <GuideSection title="Places" hint={`${g.places.length} mentioned`}>
          <ul className="space-y-1.5">{g.places.map(mentionRow)}</ul>
        </GuideSection>
      ) : null,

    others:
      g.others.length > 0 ? (
        <GuideSection title="Things" hint={`${g.others.length} mentioned`} defaultOpen={false}>
          <ul className="space-y-1.5">{g.others.map(mentionRow)}</ul>
        </GuideSection>
      ) : null,

    topics:
      g.topics.length > 0 ? (
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
      ) : null,

    timeline:
      g.timeline.length > 0 ? (
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
                      onMouseEnter={() => {
                        if (r.verse !== null) {
                          reportHoverRef({
                            book: r.slug,
                            chapter: r.chapter,
                            fromVerse: r.verse,
                            toVerse: r.verse,
                          });
                        }
                      }}
                      onMouseLeave={() => reportHoverRef(null)}
                      onClick={() => dispatch({ type: "openRef", book: r.slug, chapter: r.chapter })}
                      className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire hover:border-sapphire glass-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      {r.label}
                    </button>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </GuideSection>
      ) : null,

    notableWords:
      g.notableWords.length > 0 ? (
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
      ) : null,
    questions: g.questions ? (
      <GuideSection title="Questions to Ask" hint={`keyed to the book's genre: ${g.questions.label}`}>
        <ol className="list-decimal space-y-1.5 pl-4 marker:text-muted">
          {g.questions.questions.map((q, i) => (
            <li key={i} className="text-xs leading-relaxed">
              {q}
            </li>
          ))}
        </ol>
      </GuideSection>
    ) : null,

    compareVersions:
      g.compareVersions && g.compareVersions.rows.length > 0 ? (
        <GuideSection
          title="Compare Versions"
          hint={`word-level differences from the ${g.compareVersions.base}, widest first`}
        >
          <ul className="space-y-1.5">
            {g.compareVersions.rows.map((r) => (
              <li key={r.verse} className="flex items-baseline gap-2">
                <button
                  type="button"
                  title={`Open verse ${r.verse} in the Text Comparison`}
                  onClick={() =>
                    dispatch({ type: "openTextCompare", book: g.book, chapter: g.chapter })
                  }
                  className="shrink-0 text-xs font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  Verse {r.verse}
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {r.translations.join(", ")} {r.translations.length === 1 ? "differs" : "differ"}
                </span>
                <span className="shrink-0 text-[0.68rem] text-muted">
                  {r.words} {r.words === 1 ? "word" : "words"}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      ) : null,

    /* Media is composed, not stocked: the card link always answers, and each
     * place the chapter mentions hands off to the atlas. */
    media: (
      <GuideSection title="Media" hint="composed on this device">
        <ul className="space-y-1.5">
          <li>
            <button
              type="button"
              title={`Compose a verse card from a verse in ${reference}`}
              onClick={() => dispatch({ type: "openMedia", book: g.book, chapter: g.chapter })}
              className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Verse card
            </button>{" "}
            <span className="text-xs text-muted">compose a share card from a verse in this chapter</span>
          </li>
          {g.places.map((m) => (
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
    ),
  };

  /* The full guide wears the registry's order; a custom guide wears its own.
   * The copy action is honest about what the page shows: without the
   * cross-reference and timeline sections there are no referenced texts. */
  const order = sections ?? GUIDE_SECTIONS.map((s) => s.key);
  const showsReferences = order.includes("crossRefs") || order.includes("timeline");
  /* The sections with something to say, in the guide's own order: the
   * entrance cascade and its footer count only what renders. */
  const visible = order.filter((key) => sectionNodes[key]);

  return (
    <div className="fx-stagger space-y-6" data-print-root>
      <header className="glass rounded-[4px] px-3 py-2 print:rounded-none print:border-x-0 print:border-t-0 print:bg-none print:bg-transparent print:shadow-none print:px-0 print:pb-2 print:pt-0">
        <p className="small-caps text-xs font-semibold text-amber">{guideName ?? "Passage Guide"}</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">{reference}</h2>
        <p className="no-print mt-1 flex items-center gap-3">
          {showsReferences && g.crossRefs.length > 0 && (
            <button
              type="button"
              title="Copy the KJV text of every reference on this page"
              onClick={copyAllTexts}
              className={ACTION}
            >
              {copied === "texts" ? "Copied" : "Copy referenced texts"}
            </button>
          )}
          <button
            type="button"
            title={`Copy a link that reopens ${reference} in the reader`}
            onClick={copyLink}
            className={ACTION}
          >
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            title={`Open the Sermon Starter for ${reference}`}
            onClick={() =>
              dispatch({ type: "openSermonStarter", book: g.book, chapter: g.chapter })
            }
            className={ACTION}
          >
            Sermon prep
          </button>
          <PrintButton />
        </p>
      </header>

      {visible.map((key, i) => (
        <div key={key} style={{ "--i": i + 1 } as CSSProperties}>
          {sectionNodes[key]}
        </div>
      ))}

      <p
        style={{ "--i": visible.length + 1 } as CSSProperties}
        className="border-t border-rule pt-2 text-[0.68rem] text-muted"
      >
        Composed from the datasets shipped on this installation; every section
        opens its source.
      </p>
    </div>
  );
}
