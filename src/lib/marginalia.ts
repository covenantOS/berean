"use client";

import { collection, type Record_, type Visibility } from "./store";

/**
 * Private marginalia — notes in the margins of the text itself, accumulated
 * across a lifetime. Device-local (see docs/adr/0001 §3); the visibility
 * field exists from day one so notes carry an explicit scope when sync
 * arrives. Nothing here ever leaves the device today.
 */

export type { Visibility };

export interface MarginNote extends Record_ {
  book: string; // canon slug
  chapter: number;
  verse: number;
  text: string;
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

export function saveNote(
  note: Pick<MarginNote, "book" | "chapter" | "verse" | "text"> & { id?: string }
): MarginNote {
  if (note.id) {
    const updated = notes.update(note.id, { text: note.text });
    if (updated) return updated;
  }
  return notes.create({ book: note.book, chapter: note.chapter, verse: note.verse, text: note.text });
}

export function deleteNote(id: string) {
  notes.remove(id);
}

export function deleteAllNotes() {
  notes.removeAll();
}

export function exportNotesJson(): string {
  return JSON.stringify(notes.list(), null, 2);
}

export function exportNotesMarkdown(bookName: (slug: string) => string): string {
  const sorted = notes
    .list()
    .sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse);
  const lines = ["# Marginalia", ""];
  for (const n of sorted) {
    lines.push(`## ${bookName(n.book)} ${n.chapter}:${n.verse}`);
    lines.push("");
    lines.push(n.text);
    lines.push("");
    lines.push(`_${new Date(n.updatedAt).toLocaleDateString()}_`);
    lines.push("");
  }
  return lines.join("\n");
}
