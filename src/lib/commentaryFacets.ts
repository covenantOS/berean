import type { CommentaryWorkMeta } from "./commentary";
import { orderByPriority } from "./librarymeta";

/**
 * Faceting over the commentary wall: an ordering (priority, author, era) plus
 * tradition and type filters, shared by the dock's wall and the Passage
 * Guide's commentaries section. The metadata itself lives on COMMENTARY_WORKS
 * in src/lib/commentary.ts (fs-backed, server-only) and reaches the client in
 * the route payloads; this module holds only pure helpers over it, so client
 * code never imports the server module at runtime.
 */

export type CommentarySort = "priority" | "author" | "era";

/** The facet state both surfaces hold; "" means no filter. */
export interface CommentaryFacets {
  sort: CommentarySort;
  tradition: string;
  type: string;
}

export const DEFAULT_FACETS: CommentaryFacets = { sort: "priority", tradition: "", type: "" };

export const TYPE_LABELS: Record<CommentaryWorkMeta["type"], string> = {
  "whole-bible": "Whole Bible",
  "new-testament": "New Testament",
  selective: "Selective",
};

type MetaWork = { meta: CommentaryWorkMeta };

/** The tradition and type values present in a set of works, for filter options. */
export function facetOptions<T extends MetaWork>(
  works: T[]
): { traditions: string[]; types: CommentaryWorkMeta["type"][] } {
  return {
    traditions: [...new Set(works.map((w) => w.meta.tradition))].sort(),
    types: [...new Set(works.map((w) => w.meta.type))],
  };
}

/** The works matching the facet's tradition and type filters. */
export function filterWall<T extends MetaWork>(works: T[], facets: CommentaryFacets): T[] {
  return works.filter(
    (w) =>
      (facets.tradition === "" || w.meta.tradition === facets.tradition) &&
      (facets.type === "" || w.meta.type === facets.type)
  );
}

/**
 * The wall in the facet's order. Priority is the reader's shelf order when a
 * priority record exists and the wall's default order otherwise: the routes
 * answer wall order, and orderByPriority passes the input through untouched
 * when no record is set. Author sorts alphabetically; era sorts by first
 * publication year.
 */
export function sortWall<T extends { id: string } & MetaWork>(
  works: T[],
  sort: CommentarySort,
  priority?: string[]
): T[] {
  if (sort === "author") {
    return [...works].sort((a, b) => a.meta.author.localeCompare(b.meta.author));
  }
  if (sort === "era") {
    return [...works].sort((a, b) => a.meta.from - b.meta.from);
  }
  return orderByPriority(works, priority);
}
