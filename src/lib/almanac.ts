"use client";

import { collection, type Record_ } from "./store";

/**
 * The Almanac — the room that governs time. Preaching/teaching calendar
 * entries bind dates to projects and series; the rule of life is a plain
 * record of appointed disciplines and whether they were kept. No streak
 * mechanics: the Almanac says plainly what is appointed and what was done.
 */

export type CalendarEntryType = "sermon" | "teaching" | "service" | "note";

export interface CalendarEntry extends Record_ {
  date: string; // ISO date
  type: CalendarEntryType;
  title: string;
  series?: string;
  /** Link into the knowledge graph, never a copy. */
  projectId?: string;
  liturgyId?: string;
}

export const calendar = collection<CalendarEntry>("berean.calendar.v1");

export type RuleCadence = "daily" | "weekly" | "lordsday";

export interface RuleItem extends Record_ {
  title: string;
  cadence: RuleCadence;
  note?: string;
  /** ISO dates on which this discipline was kept. */
  kept: string[];
}

export const rule = collection<RuleItem>("berean.rule.v1");

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toggleKept(item: RuleItem, date: string) {
  const set = new Set(item.kept);
  if (set.has(date)) set.delete(date);
  else set.add(date);
  rule.update(item.id, { kept: [...set].sort() });
}
