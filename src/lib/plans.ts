"use client";

import { todayISO } from "./almanac";
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

/** A plan the reader built, or the shape a canned plan takes after an adjustment. */
export interface CustomPlan {
  name: string;
  days: number;
  tracks: { label: string; chapters: ChapterRef[] }[];
}

/** Every chapter from one reference to another, inclusive, in canon order. */
export function chaptersInRange(from: ChapterRef, to: ChapterRef): ChapterRef[] {
  const all = chaptersOf(CANON);
  const at = (c: ChapterRef) => all.findIndex((x) => x.book === c.book && x.chapter === c.chapter);
  const i = at(from);
  const j = at(to);
  if (i < 0 || j < 0) return [];
  return all.slice(Math.min(i, j), Math.max(i, j) + 1);
}

/**
 * Begin a plan over any range at a chosen pace. Days clamp to the chapter
 * count so no session comes up empty; a chapters-per-day pace rounds up so
 * the range finishes.
 */
export function beginCustomPlan(
  name: string,
  chapters: ChapterRef[],
  pace: { days: number } | { perDay: number }
): ReadingPlan | undefined {
  if (chapters.length === 0) return undefined;
  const days = "days" in pace ? pace.days : Math.ceil(chapters.length / Math.max(1, pace.perDay));
  return plans.create({
    generatorKey: "custom",
    startDate: todayISO(),
    completedDays: [],
    custom: {
      name,
      days: Math.max(1, Math.min(days, chapters.length)),
      tracks: [{ label: "Reading", chapters }],
    },
  });
}

export interface ReadingPlan extends Record_ {
  generatorKey: string;
  /** ISO date of day 1. */
  startDate: string;
  /** Day numbers (1-based) the reader has completed. */
  completedDays: number[];
  /** Present when the reader built the plan or an adjustment reshaped it. */
  custom?: CustomPlan;
}

export const plans = collection<ReadingPlan>("berean.plans.v1");

export function generatorFor(plan: ReadingPlan): PlanGenerator | undefined {
  if (plan.custom) {
    return {
      key: plan.generatorKey,
      name: plan.custom.name,
      description: "",
      days: plan.custom.days,
      tracks: plan.custom.tracks,
    };
  }
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

/** Chapters read against the whole, counted from the completed days' slices. */
export function planProgress(plan: ReadingPlan, gen: PlanGenerator): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const track of gen.tracks) {
    const t = track.chapters.length;
    total += t;
    for (const d of plan.completedDays) {
      if (d < 1 || d > gen.days) continue;
      done += Math.floor((d * t) / gen.days) - Math.floor(((d - 1) * t) / gen.days);
    }
  }
  return { done, total };
}

/** True when a day before today stands unread. */
export function isBehind(plan: ReadingPlan, gen: PlanGenerator): boolean {
  const done = new Set(plan.completedDays);
  const lastDue = Math.min(currentDay(plan) - 1, gen.days);
  for (let d = 1; d <= lastDue; d++) if (!done.has(d)) return true;
  return false;
}

/** The chapters no completed day covered, track by track. */
function unreadTracks(plan: ReadingPlan, gen: PlanGenerator) {
  const doneDays = plan.completedDays.filter((d) => d >= 1 && d <= gen.days);
  return gen.tracks.map((track) => {
    const t = track.chapters.length;
    const covered = new Set<number>();
    for (const d of doneDays) {
      for (let i = Math.floor(((d - 1) * t) / gen.days); i < Math.floor((d * t) / gen.days); i++) {
        covered.add(i);
      }
    }
    return { label: track.label, chapters: track.chapters.filter((_, i) => !covered.has(i)) };
  });
}

/**
 * Catch-up: redistribute the unread remainder over the days that remain and
 * restart the count today. Chapters already read stay read and drop out of
 * the schedule. When the end date has passed, the remainder keeps the pace
 * the plan originally ran at.
 */
export function adjustPlan(plan: ReadingPlan) {
  const gen = generatorFor(plan);
  if (!gen) return;
  const tracks = unreadTracks(plan, gen);
  const left = tracks.reduce((n, t) => n + t.chapters.length, 0);
  if (left === 0) return;
  const remaining = gen.days - currentDay(plan) + 1;
  let days: number;
  if (remaining >= 1) {
    days = Math.min(remaining, left);
  } else {
    const total = gen.tracks.reduce((n, t) => n + t.chapters.length, 0);
    const pace = Math.max(1, Math.round(total / gen.days));
    days = Math.ceil(left / pace);
  }
  plans.update(plan.id, {
    generatorKey: "custom",
    startDate: todayISO(),
    completedDays: [],
    custom: { name: gen.name, days, tracks },
  });
}
