"use client";

import { listDocuments, type PassageItem } from "./documents";
import { notes } from "./marginalia";

/**
 * First-run welcome. A device is new when it holds no workspace session
 * (berean.workspace.v1, read by the shell's provider before its first save)
 * and no onboarded mark; the overlay shows once, and finishing it writes the
 * mark so it never returns. The seeded starters below give a new device
 * something honest to open: one passage list and one note, each explaining
 * itself in a line. Seeding fills only empty collections and never
 * overwrites, so re-running the welcome from Settings harms nothing.
 */

export const ONBOARDED_KEY = "berean.onboarded.v1";

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDED_KEY) !== null;
}

export function markOnboarded() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDED_KEY, new Date().toISOString());
  } catch {
    // A blocked localStorage must never break the workspace.
  }
}

/** The anchoring passages the seeded list carries; the first explains lists. */
const STARTER_PASSAGES: PassageItem[] = [
  {
    book: "genesis",
    chapter: 1,
    verse: 1,
    note: "A passage list keeps the references you mean to return to. This one came with the app.",
  },
  { book: "psalms", chapter: 23, verse: 1 },
  { book: "isaiah", chapter: 53, verse: 5 },
  { book: "john", chapter: 1, verse: 1 },
  { book: "romans", chapter: 8, verse: 1 },
];

/**
 * Seeds the starter documents on a new device: a "Welcome" passage list and
 * one note demonstrating marginalia. Each half seeds only when its
 * collection is empty, so a device that already holds work keeps it.
 */
export function seedStarterDocuments() {
  if (listDocuments.list().length === 0) {
    listDocuments.create({ title: "Welcome", kind: "passage-list", items: STARTER_PASSAGES });
  }
  if (notes.list().length === 0) {
    notes.create({
      book: "john",
      chapter: 1,
      verse: 1,
      text: "Notes live in the margin of the text: select a verse in any reader, write what you see, and it stays anchored here.",
    });
  }
}
