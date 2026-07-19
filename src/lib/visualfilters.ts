"use client";

import type { HighlightColor } from "./highlights";
import { collection, type Record_ } from "./store";

/**
 * Visual filter sets: named, toggleable layers of verse marks worn over the
 * personal highlights, the Logos visual filter mechanic. A set gathers
 * references (usually a search's answer set) under one stained-glass color
 * and one switch; a visible set renders as an underline in the reader so it
 * never collides with a personal highlight's tint, and a verse can carry
 * both. Personal highlights stay in their own collection, untouched. The
 * sync envelope rides along from day one as everywhere.
 */

export interface VisualFilterItem {
  book: string; // canon slug
  chapter: number;
  verse: number;
}

export interface VisualFilterSet extends Record_ {
  name: string;
  color: HighlightColor;
  /** A hidden set keeps its marks but renders nothing. */
  visible: boolean;
  items: VisualFilterItem[];
  /** What produced the set (the search query), for the manager's reference. */
  source?: string;
}

const visualFilters = collection<VisualFilterSet>("berean.visualfilters.v1");
export { visualFilters };

/** Creates a set from a result list, deduplicated, visible from birth. */
export function createVisualFilter(
  name: string,
  color: HighlightColor,
  items: VisualFilterItem[],
  source?: string
): VisualFilterSet {
  const seen = new Set<string>();
  const unique = items.filter((it) => {
    const key = `${it.book}:${it.chapter}:${it.verse}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return visualFilters.create({
    name,
    color,
    visible: true,
    items: unique,
    ...(source ? { source } : {}),
  });
}

/** Removes one verse from a set; the set and its other marks stay. */
export function removeVerseFromSet(setId: string, book: string, chapter: number, verse: number) {
  const set = visualFilters.get(setId);
  if (!set) return;
  visualFilters.update(setId, {
    items: set.items.filter(
      (it) => !(it.book === book && it.chapter === chapter && it.verse === verse)
    ),
  });
}
