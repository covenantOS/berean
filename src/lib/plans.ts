"use client";

import { todayISO } from "./almanac";
import { CANON, type Book } from "./canon";
import type { PersonalBook } from "./personalbooks";
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
  /**
   * Present when the plan paces a personal book. The track's chapters wear
   * the sessions, the book's record id in book and the 1-based session
   * number in chapter, so day-slicing, progress, and catch-up run over a
   * book the way they run over the canon. The labels record at creation;
   * the slices re-derive from the live body at read time (bookSessions).
   */
  book?: {
    bookId: string;
    /** The book's title, captured at creation the way a tab captures it. */
    title: string;
    /** Session labels in order: the heading's text, headings joined on a merge, or "Part N". */
    sessions: string[];
  };
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


/* ---------- Personal book sessions ---------- */

/**
 * A personal book divides into reading sessions two ways. A body carrying at
 * least two top-level Markdown sections (headings at the shallowest depth in
 * use) divides at those headings, one session per section, a stub section
 * merged into a neighbor so no sitting comes up empty-handed. A body without
 * the headings divides by word count into roughly equal sessions, every cut
 * at a block boundary, blocks split the way the renderer splits them, on
 * blank lines. The division is a pure function of the body and the session
 * count, so a plan re-derives its slices from the live text; a body replaced
 * mid-plan redivides at the recorded count, headings first when they answer
 * to the count, word count when they do not.
 */

export interface BookSession {
  /** The heading's text (headings joined on a merge), or "Part N" over a word division. */
  label: string;
  /** The session's slice of the body, blocks joined the way they split. */
  body: string;
  words: number;
}

/** A section under this many words is a stub and merges into a neighbor. */
const MIN_SESSION_WORDS = 120;

/** A sitting reads about this many words; the heading-poor book sizes its sessions on the measure. */
const SESSION_WORD_TARGET = 1500;

interface Section {
  label: string;
  blocks: string[];
}

/** Blocks split the way the renderer splits: on blank lines. */
function blocksOf(body: string): string[] {
  return body.split(/\n{2,}/).filter((b) => b.trim() !== "");
}

function wordsOf(text: string): number {
  return text.split(/\s+/).filter((w) => w !== "").length;
}

/** A block reads as a heading when it is one line opening with hashes, the renderer's rule. */
function headingDepth(block: string): number | null {
  if (block.includes("\n")) return null;
  const m = /^(#{1,6})\s+\S/.exec(block);
  return m ? m[1].length : null;
}

/**
 * One section per heading at the shallowest depth in use. The preamble folds
 * into the first section; a stub section merges into the one before it, or
 * forward when it leads. Null when the body carries fewer than two top-level
 * sections: the headings are not a division then.
 */
function headingSections(body: string): Section[] | null {
  const blocks = blocksOf(body);
  let top: number | null = null;
  for (const b of blocks) {
    const d = headingDepth(b);
    if (d !== null && (top === null || d < top)) top = d;
  }
  if (top === null) return null;
  const sections: Section[] = [];
  const preamble: string[] = [];
  for (const b of blocks) {
    if (headingDepth(b) === top) {
      sections.push({ label: b.replace(/^#{1,6}\s+/, "").trim(), blocks: [b] });
    } else if (sections.length === 0) {
      preamble.push(b);
    } else {
      sections[sections.length - 1].blocks.push(b);
    }
  }
  if (sections.length < 2) return null;
  sections[0].blocks = [...preamble, ...sections[0].blocks];
  const merged: Section[] = [];
  for (const s of sections) {
    if (wordsOf(s.blocks.join("\n\n")) < MIN_SESSION_WORDS && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.blocks.push(...s.blocks);
      prev.label = `${prev.label} · ${s.label}`;
    } else {
      merged.push({ label: s.label, blocks: [...s.blocks] });
    }
  }
  if (merged.length > 1 && wordsOf(merged[0].blocks.join("\n\n")) < MIN_SESSION_WORDS) {
    merged[1].blocks = [...merged[0].blocks, ...merged[1].blocks];
    merged[1].label = `${merged[0].label} · ${merged[1].label}`;
    merged.shift();
  }
  return merged.length >= 2 ? merged : null;
}

/**
 * Roughly equal sessions by word count, every cut at a block boundary. Each
 * session fills toward its share of the words that remain, and each keeps at
 * least one block: a book with fewer blocks than asked sessions yields its
 * blocks, one apiece.
 */
function wordSections(body: string, count: number): Section[] {
  const blocks = blocksOf(body);
  const n = Math.max(1, Math.min(count, blocks.length));
  const sections: Section[] = [];
  let i = 0;
  let left = blocks.reduce((sum, b) => sum + wordsOf(b), 0);
  for (let k = 0; k < n; k++) {
    const target = left / (n - k);
    const slice: string[] = [];
    let words = 0;
    while (i < blocks.length) {
      if (slice.length > 0 && (words >= target || blocks.length - i <= n - k - 1)) break;
      slice.push(blocks[i]);
      words += wordsOf(blocks[i]);
      left -= wordsOf(blocks[i]);
      i++;
    }
    sections.push({ label: n === 1 ? "The whole book" : `Part ${k + 1}`, blocks: slice });
  }
  return sections;
}

function toSession(s: Section): BookSession {
  const body = s.blocks.join("\n\n");
  return { label: s.label, body, words: wordsOf(body) };
}

/**
 * How a personal book divides for a plan. Headings divide a body that has
 * them, one session per top-level section; word count divides the rest, the
 * session count taken from the pace (a days pace reads a session a day; a
 * sessions-per-day pace sizes the sitting on SESSION_WORD_TARGET and spreads
 * the sittings across the days). An empty body divides into nothing and the
 * plan does not begin.
 */
export function divideBook(
  body: string,
  pace: { days: number } | { perDay: number }
): { sessions: BookSession[] } {
  if (blocksOf(body).length === 0) return { sessions: [] };
  const headed = headingSections(body);
  if (headed) return { sessions: headed.map(toSession) };
  const count = "days" in pace ? pace.days : Math.ceil(wordsOf(body) / SESSION_WORD_TARGET);
  return { sessions: wordSections(body, count).map(toSession) };
}

/**
 * A recorded plan's sessions re-derived from the live body at the recorded
 * count: the heading division when it still answers to the count, the word
 * division when the body changed under the plan.
 */
export function bookSessions(body: string, count: number): BookSession[] {
  if (count < 1 || blocksOf(body).length === 0) return [];
  const headed = headingSections(body);
  if (headed && headed.length === count) return headed.map(toSession);
  return wordSections(body, count).map(toSession);
}

/**
 * Begin a plan over a personal book at a chosen pace. Days clamp to the
 * session count so no day comes up empty, the canon plan's rule; a
 * sessions-per-day pace rounds up so the book finishes.
 */
export function beginBookPlan(
  book: PersonalBook,
  pace: { days: number } | { perDay: number }
): ReadingPlan | undefined {
  const { sessions } = divideBook(book.body, pace);
  if (sessions.length === 0) return undefined;
  const days =
    "days" in pace
      ? Math.max(1, Math.min(pace.days, sessions.length))
      : Math.ceil(sessions.length / Math.max(1, pace.perDay));
  return plans.create({
    generatorKey: "book",
    startDate: todayISO(),
    completedDays: [],
    custom: {
      name: book.title,
      days,
      tracks: [
        {
          label: "Reading",
          chapters: sessions.map((_, i) => ({ book: book.id, chapter: i + 1 })),
        },
      ],
    },
    book: { bookId: book.id, title: book.title, sessions: sessions.map((s) => s.label) },
  });
}
