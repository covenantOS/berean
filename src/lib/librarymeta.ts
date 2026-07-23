"use client";

import { collection, type Record_ } from "./store";

/**
 * Personal library metadata: the reader's own tags, star ratings, and shelf
 * orderings, kept apart from the rights registry (src/lib/rights.ts), which
 * records what Berean may ship and never what the reader thinks of it. One
 * record per registry id carries tags and a 1–5 rating; one record per
 * prioritized shelf (resourceId "shelf:commentary") carries the work order
 * the commentary wall answers. The sync envelope rides along from day one
 * as everywhere.
 */

export interface LibraryMeta extends Record_ {
  /** Rights registry id, or "shelf:commentary" for the shelf-order record. */
  resourceId: string;
  tags: string[];
  /** 1–5 stars; null means unrated. */
  rating: number | null;
  /** Shelf-order records only: wall work ids in the user's order. */
  order?: string[];
}

export const COMMENTARY_SHELF = "shelf:commentary";

const librarymeta = collection<LibraryMeta>("berean.librarymeta.v1");
export { librarymeta };

/* The commentary wall's work ids and their registry ids mirror
 * COMMENTARY_WORKS in src/lib/commentary.ts, repeated here because that
 * module is fs-backed and server-only. Wall order is Henry first. */
export const COMMENTARY_WALL: { workId: string; rightsId: string }[] = [
  { workId: "mhenry", rightsId: "matthew-henry-full" },
  { workId: "mhc", rightsId: "matthew-henry" },
  { workId: "calvin", rightsId: "calvin" },
  { workId: "jfb", rightsId: "jfb" },
  { workId: "clarke", rightsId: "clarke" },
  { workId: "barnes", rightsId: "barnes" },
  { workId: "wesley", rightsId: "wesley" },
  { workId: "tdavid", rightsId: "tdavid" },
  { workId: "scofield", rightsId: "scofield" },
  { workId: "catena", rightsId: "catena" },
  { workId: "pnt", rightsId: "pnt" },
  { workId: "burkitt", rightsId: "burkitt" },
];

export function metaFor(resourceId: string): LibraryMeta | undefined {
  return librarymeta.list().find((r) => r.resourceId === resourceId);
}

/** Creates the record on first touch; later touches update it. */
function ensure(resourceId: string): LibraryMeta {
  return metaFor(resourceId) ?? librarymeta.create({ resourceId, tags: [], rating: null });
}

export function setRating(resourceId: string, rating: number | null) {
  const row = ensure(resourceId);
  librarymeta.update(row.id, { rating });
}

export function addTag(resourceId: string, tag: string) {
  const clean = tag.trim().toLowerCase();
  if (!clean) return;
  const row = ensure(resourceId);
  if (row.tags.includes(clean)) return;
  librarymeta.update(row.id, { tags: [...row.tags, clean] });
}

export function removeTag(resourceId: string, tag: string) {
  const row = metaFor(resourceId);
  if (!row) return;
  librarymeta.update(row.id, { tags: row.tags.filter((t) => t !== tag) });
}

/** The commentary priority record; undefined until the user reorders. */
export function commentaryPriority(): LibraryMeta | undefined {
  return metaFor(COMMENTARY_SHELF);
}

/** The shelf order: the user's when set, the wall's default otherwise. */
export function commentaryOrder(): string[] {
  return commentaryPriority()?.order ?? COMMENTARY_WALL.map((w) => w.workId);
}

/** Moves one work a step up or down the shelf, creating the record from the
 * default order on the first move. */
export function moveCommentaryWork(workId: string, delta: -1 | 1) {
  const order = commentaryOrder();
  const i = order.indexOf(workId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  const existing = commentaryPriority();
  if (existing) librarymeta.update(existing.id, { order: next });
  else librarymeta.create({ resourceId: COMMENTARY_SHELF, tags: [], rating: null, order: next });
}

/** Orders fetched wall works by the user's priority; works absent from the
 * list keep their default relative order behind the prioritized ones. With
 * no priority record the input order returns untouched. */
export function orderByPriority<T extends { id: string }>(works: T[], priority?: string[]): T[] {
  if (!priority) return works;
  const rank = new Map(priority.map((id, i) => [id, i]));
  return works
    .map((w, i) => ({ w, i }))
    .sort((a, b) => {
      const ra = rank.get(a.w.id) ?? priority.length;
      const rb = rank.get(b.w.id) ?? priority.length;
      return ra - rb || a.i - b.i;
    })
    .map((x) => x.w);
}
