"use client";

/**
 * Private marginalia, stored on this device only.
 *
 * There is no server persistence yet by design: identity and the Neon
 * database boundary are open decisions (see docs/adr/0001). The visibility
 * field exists from day one so notes carry an explicit scope when sync
 * arrives; nothing here ever leaves the device today.
 */

export type Visibility = "private" | "personal" | "church" | "public";

export interface MarginNote {
  id: string;
  book: string; // canon slug
  chapter: number;
  verse: number;
  text: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
}

const KEY = "berean.marginalia.v1";

function read(): MarginNote[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as MarginNote[];
  } catch {
    return [];
  }
}

function write(notes: MarginNote[]) {
  window.localStorage.setItem(KEY, JSON.stringify(notes));
}

export function listNotes(book?: string, chapter?: number): MarginNote[] {
  return read().filter(
    (n) => (!book || n.book === book) && (chapter === undefined || n.chapter === chapter)
  );
}

export function allNotes(): MarginNote[] {
  return read();
}

export function saveNote(
  note: Omit<MarginNote, "id" | "createdAt" | "updatedAt" | "visibility"> & { id?: string }
): MarginNote {
  const notes = read();
  const now = new Date().toISOString();
  if (note.id) {
    const existing = notes.find((n) => n.id === note.id);
    if (existing) {
      existing.text = note.text;
      existing.updatedAt = now;
      write(notes);
      return existing;
    }
  }
  const created: MarginNote = {
    id: crypto.randomUUID(),
    book: note.book,
    chapter: note.chapter,
    verse: note.verse,
    text: note.text,
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  };
  notes.push(created);
  write(notes);
  return created;
}

export function deleteNote(id: string) {
  write(read().filter((n) => n.id !== id));
}

export function deleteAllNotes() {
  write([]);
}

export function exportNotesJson(): string {
  return JSON.stringify(read(), null, 2);
}

export function exportNotesMarkdown(bookName: (slug: string) => string): string {
  const notes = read().sort(
    (a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse
  );
  const lines = ["# Marginalia", ""];
  for (const n of notes) {
    lines.push(`## ${bookName(n.book)} ${n.chapter}:${n.verse}`);
    lines.push("");
    lines.push(n.text);
    lines.push("");
    lines.push(`_${new Date(n.updatedAt).toLocaleDateString()}_`);
    lines.push("");
  }
  return lines.join("\n");
}
