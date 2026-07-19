"use client";

import { todayISO } from "./almanac";
import { collection, type Record_ } from "./store";

/**
 * Prayer lists: the requests a man carries before God, kept in named lists
 * with a plain record of faithfulness and answers. Tags and a free-form
 * category (family, church, the lost) sort the requests; there are no custom
 * field schemas, because a request is a sentence, not a form. An optional
 * passage binds a request to the text it prays, by reference, never by copy.
 * The record says plainly what is due and what was answered; nothing is
 * streaked or scored. Device-local like everything else, with the sync
 * envelope riding along from day one as everywhere.
 */

export type PrayerFrequency = "daily" | "weekly" | "as-it-comes";

export const PRAYER_FREQUENCIES: { key: PrayerFrequency; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "as-it-comes", label: "As it comes" },
];

export interface PrayerAnswer {
  /** ISO date (yyyy-mm-dd) the answer was recorded. */
  date: string;
  note?: string;
}

export interface PrayerRequest {
  id: string;
  title: string;
  details?: string;
  tags: string[];
  /** Free-form, the way a series or topic is elsewhere. */
  category?: string;
  /** The passage as written, e.g. "Colossians 1:9-12"; links when it parses. */
  passage?: string;
  frequency: PrayerFrequency;
  /** ISO timestamp of the last time this request was prayed. */
  lastPrayedAt?: string;
  /** Present once the request is answered; the request leaves the active list. */
  answered?: PrayerAnswer;
}

export interface PrayerList extends Record_ {
  title: string;
  requests: PrayerRequest[];
}

export const prayerLists = collection<PrayerList>("berean.prayers.v1");

export function frequencyLabel(f: PrayerFrequency): string {
  return PRAYER_FREQUENCIES.find((x) => x.key === f)?.label ?? f;
}

/** The active requests of a list; answered ones rest in the history. */
export function activeRequests(list: PrayerList): PrayerRequest[] {
  return list.requests.filter((r) => !r.answered);
}

export function answeredRequests(list: PrayerList): PrayerRequest[] {
  return list.requests
    .filter((r) => r.answered)
    .sort((a, b) => b.answered!.date.localeCompare(a.answered!.date));
}

/**
 * Whether a request stands due today. Daily requests are due again once the
 * calendar turns past the day they were last prayed; weekly requests come
 * due seven days after; as-it-comes requests wait on the moment and are
 * never scheduled. A request never prayed is due at once, and an answered
 * one is never due.
 */
export function isRequestDue(r: PrayerRequest, today = todayISO()): boolean {
  if (r.answered || r.frequency === "as-it-comes") return false;
  if (!r.lastPrayedAt) return true;
  const last = r.lastPrayedAt.slice(0, 10);
  if (r.frequency === "daily") return last < today;
  const ms = new Date(today + "T00:00:00").getTime() - new Date(last + "T00:00:00").getTime();
  return ms >= 7 * 86400000;
}

/** Every due request across every list, list attached for display. */
export function dueRequests(lists: PrayerList[], today = todayISO()): { list: PrayerList; request: PrayerRequest }[] {
  const out: { list: PrayerList; request: PrayerRequest }[] = [];
  for (const list of lists) {
    for (const request of activeRequests(list)) {
      if (isRequestDue(request, today)) out.push({ list, request });
    }
  }
  return out;
}

/* ---------- Request operations: each rewrites its owning list ---------- */

function rewrite(listId: string, fn: (requests: PrayerRequest[]) => PrayerRequest[]) {
  const list = prayerLists.get(listId);
  if (!list) return;
  prayerLists.update(listId, { requests: fn(list.requests) });
}

export function addRequest(
  listId: string,
  data: Omit<PrayerRequest, "id" | "lastPrayedAt" | "answered">
): PrayerRequest | undefined {
  const request: PrayerRequest = { ...data, id: crypto.randomUUID() };
  rewrite(listId, (rs) => [...rs, request]);
  return request;
}

export function updateRequest(listId: string, requestId: string, patch: Partial<Omit<PrayerRequest, "id">>) {
  rewrite(listId, (rs) => rs.map((r) => (r.id === requestId ? { ...r, ...patch } : r)));
}

export function removeRequest(listId: string, requestId: string) {
  rewrite(listId, (rs) => rs.filter((r) => r.id !== requestId));
}

/** The pray-now mark: the request was carried before God this moment. */
export function markPrayed(listId: string, requestId: string) {
  updateRequest(listId, requestId, { lastPrayedAt: new Date().toISOString() });
}

/** Records the answer and rests the request in the list's history. */
export function markAnswered(listId: string, requestId: string, note?: string) {
  updateRequest(listId, requestId, {
    answered: { date: todayISO(), ...(note ? { note } : {}) },
  });
}

/** Returns an answered request to the active list, its answer note spent. */
export function restoreRequest(listId: string, requestId: string) {
  rewrite(listId, (rs) =>
    rs.map((r) => {
      if (r.id !== requestId) return r;
      const { answered: _answered, ...rest } = r;
      return rest;
    })
  );
}
