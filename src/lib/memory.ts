"use client";

import { todayISO } from "./almanac";
import { collection, type Record_ } from "./store";

/**
 * Memory work — passages scheduled for review until they hold. The
 * schedule is plain spaced repetition with widening intervals, derived
 * from the review history alone; there are no streaks, scores, or badges.
 * The record simply says what is due. Due dates are calendar days, the
 * same derivation the prayer lists use: a passage reviewed today is never
 * due again today. Older records carry only held and shaky reviews and
 * load unchanged.
 */

export interface MemoryReview {
  date: string; // ISO
  /** held steps the interval up, shaky steps it back one, again returns
   *  to the first interval. */
  result: "held" | "shaky" | "again";
}

export interface MemoryPassage extends Record_ {
  book: string; // slug
  chapter: number;
  from: number;
  to: number;
  reviews: MemoryReview[];
}

export const memoryPassages = collection<MemoryPassage>("berean.memory.v1");

/** Review intervals in days; a shaky review steps back one interval, an
 *  again review returns to the start. */
const INTERVALS = [1, 3, 7, 14, 30, 60, 120, 240];

export function intervalIndex(p: MemoryPassage): number {
  let i = 0;
  for (const r of p.reviews) {
    if (r.result === "held") i = Math.min(i + 1, INTERVALS.length - 1);
    else if (r.result === "shaky") i = Math.max(i - 1, 0);
    else i = 0;
  }
  return i;
}

/** Local-midnight date arithmetic on a yyyy-mm-dd string. */
function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The calendar day the passage next stands due. */
export function dueDateISO(p: MemoryPassage): string {
  const last = p.reviews.length > 0 ? p.reviews[p.reviews.length - 1].date : p.createdAt;
  const days = p.reviews.length === 0 ? 0 : INTERVALS[intervalIndex(p)];
  return addDays(last.slice(0, 10), days);
}

export function nextDue(p: MemoryPassage): Date {
  return new Date(dueDateISO(p) + "T00:00:00");
}

export function isDue(p: MemoryPassage, today = todayISO()): boolean {
  return dueDateISO(p) <= today;
}

export function recordReview(id: string, result: MemoryReview["result"]) {
  const p = memoryPassages.get(id);
  if (!p) return;
  memoryPassages.update(id, {
    reviews: [...p.reviews, { date: new Date().toISOString(), result }],
  });
}

/**
 * Takes a passage up into memory work, the write behind both the memory
 * page's form and the reader's Memorize row. A passage already in keeping
 * is returned unchanged rather than duplicated.
 */
export function takeUp(book: string, chapter: number, from: number, to: number): MemoryPassage {
  const existing = memoryPassages
    .list()
    .find((p) => p.book === book && p.chapter === chapter && p.from === from && p.to === to);
  if (existing) return existing;
  return memoryPassages.create({ book, chapter, from, to, reviews: [] });
}

/* ---------- Drill helpers: pure functions over the verse's real text ---------- */

export type DrillMode = "letters" | "blanks" | "recall";

/**
 * The first-letter prompt: every word reduced to its initial, punctuation
 * and verse shape preserved, so the eye walks the passage and the memory
 * supplies the words.
 */
export function firstLetters(text: string): string {
  return text.replace(/[A-Za-z0-9]+/g, (w) => w[0]);
}

/**
 * How many words the blanking drill withholds at a mastery level: a
 * quarter of the words at the first interval, rising with the ladder
 * until the whole passage is asked for.
 */
export function blankCount(wordCount: number, level: number): number {
  const fraction = Math.min((level + 1) / 4, 1);
  return Math.min(wordCount, Math.max(1, Math.round(wordCount * fraction)));
}

/**
 * Which word positions stand blank, chosen at random each drill so the
 * gaps do not settle into a pattern the eye memorizes instead of the text.
 */
export function blankIndexes(wordCount: number, level: number, rand: () => number = Math.random): number[] {
  const count = blankCount(wordCount, level);
  const positions = Array.from({ length: wordCount }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, count).sort((a, b) => a - b);
}
