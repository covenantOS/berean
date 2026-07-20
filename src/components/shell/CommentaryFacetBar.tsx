"use client";

import type { CommentaryWorkMeta } from "@/lib/commentary";
import {
  TYPE_LABELS,
  facetOptions,
  type CommentaryFacets,
  type CommentarySort,
} from "@/lib/commentaryFacets";

/**
 * The commentary facet controls: a quiet row of selects ordering the wall by
 * priority, author, or era and narrowing it by tradition and type. Options
 * come from the works on hand, so a scoped wall offers only the facets its
 * members carry. Shared by the dock's wall and the Passage Guide's
 * commentaries section.
 */
export default function CommentaryFacetBar({
  works,
  facets,
  onChange,
}: {
  works: { meta: CommentaryWorkMeta }[];
  facets: CommentaryFacets;
  onChange: (next: CommentaryFacets) => void;
}) {
  const { traditions, types } = facetOptions(works);
  const set = (patch: Partial<CommentaryFacets>) => onChange({ ...facets, ...patch });
  const select =
    "border border-rule bg-paper px-1 py-1 text-xs text-ink focus:border-sapphire focus:outline-none";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule pb-2">
      <label className="flex items-center gap-1 text-[0.68rem] text-muted">
        <span className="small-caps font-semibold">Order</span>
        <select
          value={facets.sort}
          onChange={(e) => set({ sort: e.target.value as CommentarySort })}
          aria-label="Order the commentary wall"
          className={select}
        >
          <option value="priority">Priority</option>
          <option value="author">Author</option>
          <option value="era">Era</option>
        </select>
      </label>
      <label className="flex items-center gap-1 text-[0.68rem] text-muted">
        <span className="small-caps font-semibold">Tradition</span>
        <select
          value={facets.tradition}
          onChange={(e) => set({ tradition: e.target.value })}
          aria-label="Filter the commentary wall by tradition"
          className={select}
        >
          <option value="">All</option>
          {traditions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-[0.68rem] text-muted">
        <span className="small-caps font-semibold">Type</span>
        <select
          value={facets.type}
          onChange={(e) => set({ type: e.target.value })}
          aria-label="Filter the commentary wall by coverage"
          className={select}
        >
          <option value="">All</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
