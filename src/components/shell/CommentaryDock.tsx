"use client";

import { useEffect, useState } from "react";
import { getBook } from "@/lib/canon";
import {
  activeCollection,
  collections,
  getActiveCollectionId,
  scopedWallWorkIds,
  setActiveCollection,
} from "@/lib/collections";
import type { CommentaryWorkMeta } from "@/lib/commentary";
import {
  DEFAULT_FACETS,
  filterWall,
  sortWall,
  type CommentaryFacets,
} from "@/lib/commentaryFacets";
import { useCollection } from "@/lib/hooks";
import { COMMENTARY_SHELF, librarymeta } from "@/lib/librarymeta";
import { sectionsForVerse } from "@/lib/sections";
import ClippingsPicker from "./ClippingsPicker";
import CommentaryFacetBar from "./CommentaryFacetBar";
import { useWorkspace } from "./WorkspaceContext";

interface CommentarySection {
  verses: string;
  text: string;
}

interface CommentaryWork {
  id: string;
  label: string;
  meta: CommentaryWorkMeta;
  sections: CommentarySection[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; works: CommentaryWork[] };

/** Sections collapse at roughly a paragraph; the rest waits behind "Read on". */
const EXCERPT = 320;

/**
 * The dock's commentary wall: every shipped work on the shelf answers the
 * passage in focus, in wall order. A verse selection narrows the wall to
 * the sections that treat that verse, under a "following" header; Reset
 * lets the selection go and returns the wall to the whole chapter. The
 * user's shelf priority (set in the Library pane, held in localStorage)
 * reorders the wall here after the fetch: the route is server-side and
 * cannot see device data, so it answers in the default order and the dock
 * applies the preference. A workspace-active collection scopes the wall the
 * same way, client-side by work id: the wall answers from the collection's
 * members and says so. Facet controls order the wall by priority, author,
 * or era and narrow it by tradition and type (src/lib/commentaryFacets.ts),
 * client-side over the metadata the route returns with each work.
 */
export default function CommentaryDock() {
  const { state, activeRef, dispatch } = useWorkspace();
  const metaRows = useCollection(librarymeta);
  const savedCollections = useCollection(collections);
  useCollection(activeCollection);
  const priority = metaRows.find((r) => r.resourceId === COMMENTARY_SHELF)?.order;
  const sel = state.selection?.kind === "verse" ? state.selection : null;
  const book = sel?.book ?? activeRef?.book ?? null;
  const chapter = sel?.chapter ?? activeRef?.chapter ?? null;
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  /** Ordering and narrowing of the wall; the priority order is the default. */
  const [facets, setFacets] = useState<CommentaryFacets>(DEFAULT_FACETS);

  /* The workspace-active collection scopes which works answer; the metaRows
   * subscription above keeps membership live as tags and ratings change. */
  const scope = savedCollections.find((c) => c.id === getActiveCollectionId()) ?? null;
  const scopeIds = scope ? scopedWallWorkIds(scope.rules) : null;

  useEffect(() => {
    if (book === null || chapter === null) return;
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/commentary?book=${encodeURIComponent(book)}&chapter=${chapter}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { works: CommentaryWork[] };
        setLoad({ status: "ready", works: data.works });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter]);

  const following = sel ? `${getBook(sel.book)?.name ?? sel.book} ${sel.chapter}:${sel.verse}` : null;
  const header = following ? (
    <div className="mb-4 flex items-baseline justify-between border-b border-rule pb-2">
      <p className="small-caps text-xs font-semibold text-amber">Following {following}</p>
      <button
        type="button"
        onClick={() => dispatch({ type: "clearSelection" })}
        className="text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Reset
      </button>
    </div>
  ) : null;

  /* The scoping handoff, honest about which works answer: with collections
   * on the device the wall names its source, the whole shelf or one
   * collection, and the choice persists as the workspace's active
   * collection. No collections, no row. */
  const scopeRow =
    savedCollections.length > 0 ? (
      <div className="mb-4 flex items-center gap-2 border-b border-rule pb-2">
        <label className="flex items-center gap-1 text-[0.68rem] text-muted">
          <span className="small-caps font-semibold">Answering from</span>
          <select
            value={scope?.id ?? ""}
            onChange={(e) => setActiveCollection(e.target.value || null)}
            aria-label="Choose the collection the commentary wall answers from"
            className="border border-rule bg-paper px-1 py-1 text-xs text-ink focus:border-sapphire focus:outline-none"
          >
            <option value="">The whole shelf</option>
            {savedCollections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    ) : null;

  if (book === null || chapter === null) {
    return <p className="text-xs text-muted">Open a passage and the shelf gathers here.</p>;
  }
  if (load.status === "loading") {
    return (
      <>
        {scopeRow}
        {header}
        <p className="text-xs text-muted">Taking the volumes down…</p>
      </>
    );
  }
  if (load.status === "error") {
    return (
      <>
        {scopeRow}
        {header}
        <p className="text-xs text-muted">The commentary shelf could not be reached.</p>
      </>
    );
  }
  const pooled = scopeIds ? load.works.filter((w) => scopeIds.has(w.id)) : load.works;
  const narrowed = sel
    ? pooled
        .map((w) => ({ ...w, sections: sectionsForVerse(w.sections, sel.verse) }))
        .filter((w) => w.sections.length > 0)
    : pooled;
  /* Facets narrow by tradition and type, then order: priority (the reader's
   * shelf order), author, or era. The route answers wall order, so ordering
   * applies here after the fetch, the same handoff as the priority record. */
  const works = sortWall(filterWall(narrowed, facets), facets.sort, priority);
  const facetBar = <CommentaryFacetBar works={pooled} facets={facets} onChange={setFacets} />;
  if (works.length === 0) {
    return (
      <>
        {scopeRow}
        {header}
        {facetBar}
        <p className="text-xs text-muted">
          {narrowed.length > 0
            ? "No work on the shelf matches those facets."
            : scope
              ? `No work in ${scope.name} treats this ${sel ? "verse" : "chapter"}.`
              : sel
                ? "No volume on the shelf treats this verse directly."
                : "The commentary shelf holds no volume for this chapter yet."}
        </p>
      </>
    );
  }
  return (
    <div>
      {scopeRow}
      {header}
      {facetBar}
      <div className="space-y-6">
        {works.map((w) => (
          <section key={w.id}>
            <p className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <span className="small-caps text-xs font-semibold text-muted">{w.label}</span>
              <span className="text-[0.68rem] text-muted">
                {w.meta.years} · {w.meta.tradition}
              </span>
            </p>
            <div className="space-y-4">
              {w.sections.map((s, i) => (
                <WallSection
                  key={i}
                  section={s}
                  workLabel={w.label}
                  bookName={getBook(book)?.name ?? book}
                  chapter={chapter}
                />
              ))}
            </div>
          </section>
        ))}
        <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
          Public domain. The volumes are on the shelf; take any of them down
          yourself at any point of disagreement.
        </p>
      </div>
    </div>
  );
}

function WallSection({
  section,
  workLabel,
  bookName,
  chapter,
}: {
  section: CommentarySection;
  workLabel: string;
  bookName: string;
  chapter: number;
}) {
  const [open, setOpen] = useState(false);
  /** True once "Clip" opens the clippings chooser beneath the section. */
  const [clipping, setClipping] = useState(false);
  const long = section.text.length > EXCERPT;
  const shown =
    open || !long ? section.text : section.text.slice(0, EXCERPT).replace(/\s+\S*$/, "") + " …";
  /* The clip's citation: the work and the section's verses, generated here;
   * the excerpt is the whole section, never the truncation. */
  const citation = section.verses
    ? `${workLabel}, ${bookName} ${chapter}:${section.verses}`
    : `${workLabel}, ${bookName} ${chapter}`;
  return (
    <div>
      {section.verses && (
        <p className="mb-1 text-xs font-semibold text-sapphire">Verses {section.verses}</p>
      )}
      {shown.split(/\n\n+/).map((para, j) => (
        <p key={j} className="mb-2 font-reader text-[0.86rem] leading-relaxed">
          {para}
        </p>
      ))}
      <span className="flex items-center gap-3">
        {long && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            {open ? "Put back" : "Read on"}
          </button>
        )}
        <button
          type="button"
          title="Keep this section's text and citation in a clippings document"
          onClick={() => setClipping(!clipping)}
          className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Clip
        </button>
      </span>
      {clipping && (
        <ClippingsPicker
          item={{ text: section.text, citation }}
          newTitle={`Clippings from ${workLabel}`}
          heading="Clip this section into"
          onDone={() => setClipping(false)}
        />
      )}
    </div>
  );
}
