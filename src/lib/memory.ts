"use client";

import { collection, type Record_ } from "./store";

/**
 * Memory work — passages scheduled for review until they hold. The
 * schedule is plain spaced repetition with widening intervals. There are
 * no streaks, scores, or badges; the record simply says what is due.
 */

export interface MemoryReview {
  date: string; // ISO
  result: "held" | "shaky";
}

export interface MemoryPassage extends Record_ {
  book: string; // slug
  chapter: number;
  from: number;
  to: number;
  reviews: MemoryReview[];
}

export const memoryPassages = collection<MemoryPassage>("berean.memory.v1");

/** Review intervals in days; a shaky review steps back one interval. */
const INTERVALS = [1, 3, 7, 14, 30, 60, 120, 240];

export function intervalIndex(p: MemoryPassage): number {
  let i = 0;
  for (const r of p.reviews) {
    if (r.result === "held") i = Math.min(i + 1, INTERVALS.length - 1);
    else i = Math.max(i - 1, 0);
  }
  return i;
}

export function nextDue(p: MemoryPassage): Date {
  const last = p.reviews.length > 0 ? p.reviews[p.reviews.length - 1].date : p.createdAt;
  const idx = p.reviews.length === 0 ? 0 : intervalIndex(p);
  const days = p.reviews.length === 0 ? 0 : INTERVALS[idx];
  const d = new Date(last);
  d.setDate(d.getDate() + days);
  return d;
}

export function isDue(p: MemoryPassage, today = new Date()): boolean {
  return nextDue(p).getTime() <= today.getTime();
}

export function recordReview(id: string, result: "held" | "shaky") {
  const p = memoryPassages.get(id);
  if (!p) return;
  memoryPassages.update(id, {
    reviews: [...p.reviews, { date: new Date().toISOString(), result }],
  });
}
