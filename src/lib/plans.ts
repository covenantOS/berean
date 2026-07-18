"use client";

import { CANON, type Book } from "./canon";
import { collection, type Record_ } from "./store";

/**
 * Reading plans — generated algorithmically from the canon itself, so every
 * plan Berean offers is fully defined by data it legally ships. Named
 * historic tables (e.g. M'Cheyne's calendar) are registered as planned
 * resources in the rights registry and will arrive only from a verified
 * source text, never reconstructed from memory.
 */

export interface ChapterRef {
  book: string; // slug
  chapter: number;
}

function chaptersOf(books: Book[]): ChapterRef[] {
  const out: ChapterRef[] = [];
  for (const b of books) for (let c = 1; c <= b.chapters; c++) out.push({ book: b.slug, chapter: c });
  return out;
}

const OT = CANON.filter((b) => b.testament === "OT");
const NT = CANON.filter((b) => b.testament === "NT");
const PSALMS = CANON.filter((b) => b.slug === "psalms");
const GOSPELS = CANON.filter((b) => ["matthew", "mark", "luke", "john"].includes(b.slug));
const WISDOM = CANON.filter((b) => ["psalms", "proverbs", "ecclesiastes"].includes(b.slug));

export interface PlanGenerator {
  key: string;
  name: string;
  description: string;
  days: number;
  /** Reading tracks; each is a chapter sequence distributed across the days. */
  tracks: { label: string; chapters: ChapterRef[] }[];
}

export const GENERATORS: PlanGenerator[] = [
  {
    key: "canonical-year",
    name: "The Whole Bible, in Order",
    description: "Genesis to Revelation in one year, three to four chapters a day.",
    days: 365,
    tracks: [{ label: "Reading", chapters: chaptersOf(CANON) }],
  },
  {
    key: "two-track-year",
    name: "Morning and Evening",
    description:
      "The Old Testament in the morning; the New Testament with the Psalms in the evening, across one year.",
    days: 365,
    tracks: [
      { label: "Morning", chapters: chaptersOf(OT) },
      { label: "Evening", chapters: chaptersOf(NT).concat(chaptersOf(PSALMS)) },
    ],
  },
  {
    key: "nt-90",
    name: "The New Testament in Ninety Days",
    description: "Matthew to Revelation, three chapters a day.",
    days: 90,
    tracks: [{ label: "Reading", chapters: chaptersOf(NT) }],
  },
  {
    key: "gospels-month",
    name: "The Gospels in a Month",
    description: "The four witnesses to Christ in thirty days.",
    days: 30,
    tracks: [{ label: "Reading", chapters: chaptersOf(GOSPELS) }],
  },
  {
    key: "wisdom-quarter",
    name: "Psalms and Wisdom",
    description: "Psalms, Proverbs, and Ecclesiastes across a quarter.",
    days: 91,
    tracks: [{ label: "Reading", chapters: chaptersOf(WISDOM) }],
  },
];

/** Deterministic even distribution of a chapter sequence over N days. */
export function readingsForDay(gen: PlanGenerator, day: number): { label: string; chapters: ChapterRef[] }[] {
  return gen.tracks.map((track) => {
    const total = track.chapters.length;
    const start = Math.floor(((day - 1) * total) / gen.days);
    const end = Math.floor((day * total) / gen.days);
    return { label: track.label, chapters: track.chapters.slice(start, end) };
  });
}

export interface ReadingPlan extends Record_ {
  generatorKey: string;
  /** ISO date of day 1. */
  startDate: string;
  /** Day numbers (1-based) the reader has completed. */
  completedDays: number[];
}

export const plans = collection<ReadingPlan>("berean.plans.v1");

export function generatorFor(plan: ReadingPlan): PlanGenerator | undefined {
  return GENERATORS.find((g) => g.key === plan.generatorKey);
}

/** Which day of the plan today is (1-based; may exceed gen.days if overdue). */
export function currentDay(plan: ReadingPlan, today = new Date()): number {
  const start = new Date(plan.startDate + "T00:00:00");
  const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

export function toggleDay(plan: ReadingPlan, day: number) {
  const set = new Set(plan.completedDays);
  if (set.has(day)) set.delete(day);
  else set.add(day);
  plans.update(plan.id, { completedDays: [...set].sort((a, b) => a - b) });
}
