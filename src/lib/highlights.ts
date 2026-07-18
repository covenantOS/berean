"use client";

import { collection, type Record_ } from "./store";

/**
 * Verse highlights: a quiet stained-glass tint on the text, following the
 * marginalia pattern. Device-local and private by default (docs/adr/0001
 * §3); the sync envelope rides along from day one so ADR 0002 sync can
 * adopt the collection without a migration. One tint per verse.
 */

export type HighlightColor = "amber" | "sapphire" | "emerald" | "ruby";

export const HIGHLIGHT_COLORS: HighlightColor[] = ["amber", "sapphire", "emerald", "ruby"];

export interface VerseHighlight extends Record_ {
  book: string; // canon slug
  chapter: number;
  verse: number;
  color: HighlightColor;
}

const highlights = collection<VerseHighlight>("berean.highlights.v1");
export { highlights };

export function listHighlights(book?: string, chapter?: number): VerseHighlight[] {
  return highlights.list(
    (h) => (!book || h.book === book) && (chapter === undefined || h.chapter === chapter)
  );
}

export function highlightForVerse(
  book: string,
  chapter: number,
  verse: number
): VerseHighlight | undefined {
  return highlights.list((h) => h.book === book && h.chapter === chapter && h.verse === verse)[0];
}

/** Sets the verse's tint, replacing any existing mark. */
export function setHighlight(
  book: string,
  chapter: number,
  verse: number,
  color: HighlightColor
): VerseHighlight {
  const existing = highlightForVerse(book, chapter, verse);
  if (existing) {
    if (existing.color === color) return existing;
    return highlights.update(existing.id, { color }) ?? existing;
  }
  return highlights.create({ book, chapter, verse, color });
}

export function clearHighlight(book: string, chapter: number, verse: number) {
  const existing = highlightForVerse(book, chapter, verse);
  if (existing) highlights.remove(existing.id);
}
