"use client";

import { collection, type Record_, type Visibility } from "./store";

/**
 * Private marginalia — notes in the margins of the text itself, accumulated
 * across a lifetime. Device-local (see docs/adr/0001 §3); the visibility
 * field exists from day one so notes carry an explicit scope when sync
 * arrives. Nothing here ever leaves the device today.
 *
 * A note may carry a verse anchor, a date, or both. The anchor alone makes
 * it marginalia on a passage; the date alone makes it a journal entry; both
 * makes it a journal entry written against a text. Notebooks file notes
 * under a name the way favorites file under folders: the name lives on the
 * record, so a notebook is every note carrying it and old notes read as
 * unfiled without a migration. Deleting a notebook unfiles its notes; it
 * never deletes them.
 */

export type { Visibility };

export interface MarginNote extends Record_ {
  /** Verse anchor; absent on an entry written from the journal alone. */
  book?: string; // canon slug
  chapter?: number;
  verse?: number;
  /** The day the entry belongs to (YYYY-MM-DD); its presence makes it a journal entry. */
  date?: string;
  /** Notebook the note files under; "" or absent leaves it unfiled. */
  notebook?: string;
  text: string;
}

/** A note anchored to a verse; the rail and docs search open these in the reader. */
export type AnchoredNote = MarginNote & { book: string; chapter: number; verse: number };

export function isAnchored(n: MarginNote): n is AnchoredNote {
  return n.book !== undefined && n.chapter !== undefined && n.verse !== undefined;
}

const notes = collection<MarginNote>("berean.marginalia.v1");
export { notes };

export function listNotes(book?: string, chapter?: number): MarginNote[] {
  return notes.list(
    (n) => (!book || n.book === book) && (chapter === undefined || n.chapter === chapter)
  );
}

export function allNotes(): MarginNote[] {
  return notes.list();
}

/**
 * Writes a note. An id updates in place; fields the caller leaves out stay
 * as they were, so an editor that knows nothing of notebooks never unfiles
 * the note it touches.
 */
export function saveNote(note: {
  id?: string;
  text: string;
  book?: string;
  chapter?: number;
  verse?: number;
  date?: string;
  notebook?: string;
}): MarginNote {
  if (note.id) {
    const patch: { text: string; date?: string; notebook?: string } = { text: note.text };
    if (note.date !== undefined) patch.date = note.date;
    if (note.notebook !== undefined) patch.notebook = note.notebook;
    const updated = notes.update(note.id, patch);
    if (updated) return updated;
  }
  return notes.create({
    book: note.book,
    chapter: note.chapter,
    verse: note.verse,
    date: note.date,
    notebook: note.notebook,
    text: note.text,
  });
}

export function deleteNote(id: string) {
  notes.remove(id);
}

export function deleteAllNotes() {
  notes.removeAll();
}

/* ---------- Notebooks ---------- */

/** Every notebook name in use, unfiled ("") excluded, alphabetized. */
export function listNotebooks(): string[] {
  const names = new Set(
    notes.list().map((n) => n.notebook?.trim() ?? "").filter((name) => name !== "")
  );
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Renames a notebook across every note filed in it. */
export function renameNotebook(from: string, to: string) {
  const name = to.trim();
  if (!name || name === from) return;
  for (const n of notes.list((n) => n.notebook === from)) {
    notes.update(n.id, { notebook: name });
  }
}

/** Deletes a notebook; its notes stay, unfiled. */
export function deleteNotebook(name: string) {
  for (const n of notes.list((n) => n.notebook === name)) {
    notes.update(n.id, { notebook: "" });
  }
}

/* ---------- Export ---------- */

export function exportNotesJson(): string {
  return JSON.stringify(notes.list(), null, 2);
}

export function exportNotesMarkdown(bookName: (slug: string) => string): string {
  const all = notes.list();
  const anchored = all
    .filter(isAnchored)
    .sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse);
  const dated = all
    .filter((n) => !isAnchored(n) && n.date !== undefined)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const lines = ["# Marginalia", ""];
  for (const n of anchored) {
    lines.push(`## ${bookName(n.book)} ${n.chapter}:${n.verse}`);
    lines.push("");
    lines.push(n.text);
    lines.push("");
    lines.push(`_${new Date(n.updatedAt).toLocaleDateString()}_`);
    lines.push("");
  }
  if (dated.length > 0) {
    lines.push("# Journal", "");
    for (const n of dated) {
      lines.push(`## ${n.date}`);
      lines.push("");
      lines.push(n.text);
      lines.push("");
    }
  }
  return lines.join("\n");
}
