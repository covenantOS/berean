"use client";

import { collection, type Record_ } from "./store";

/**
 * Personal books: the reader's own texts imported as read-only library
 * resources, kept apart from the rights registry (src/lib/rights.ts), which
 * records what Berean may ship and never what the reader brought. Import is
 * paste or a .md/.txt file read on the device; a DOCX converts through Word
 * or Google Docs first, the same road Logos sends its PDFs down, and the
 * note in the Library pane says so. The body stores exactly as given, plain
 * text or Markdown; Scripture references link at render time (src/lib/
 * refscan.ts), so the stored words are never rewritten. The sync envelope
 * rides along from day one as everywhere.
 */

export interface PersonalBook extends Record_ {
  title: string;
  author?: string;
  /** The imported body: plain text or Markdown, stored verbatim. */
  body: string;
  /** ISO timestamp of the import, or of the last body replacement. */
  importedAt: string;
}

export const personalbooks = collection<PersonalBook>("berean.personalbooks.v1");

/** Creates a book from an import; the title falls back the way the desk's
 * untitled manuscripts do. */
export function importBook(input: { title: string; author?: string; body: string }): PersonalBook {
  return personalbooks.create({
    title: input.title.trim() || "Untitled book",
    ...(input.author?.trim() ? { author: input.author.trim() } : {}),
    body: input.body,
    importedAt: new Date().toISOString(),
  });
}
