"use client";

import { useState } from "react";
import { getBook } from "@/lib/canon";
import { useCollection } from "@/lib/hooks";
import {
  deleteNote,
  isAnchored,
  notes as marginNotes,
  saveNote,
  type MarginNote,
} from "@/lib/marginalia";
import PrintButton from "@/components/shell/PrintButton";

/** Today's date as YYYY-MM-DD, in the reader's own zone. */
function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** A YYYY-MM-DD key read as a local day, never as midnight UTC. */
function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Opens the passage in the workspace, the way every pane asks. */
function openRef(book: string, chapter: number, verse?: number) {
  window.dispatchEvent(new CustomEvent("berean:open-ref", { detail: { book, chapter, verse } }));
}

/**
 * The Journal pane: date-anchored notes read as a diary, moved from the
 * retired /journal page. An entry is a note in the same marginalia
 * collection as everything else (src/lib/marginalia.ts); the date on the
 * record makes it a journal entry, and it may carry a verse anchor too
 * when it was written against a text. Entries answer in Docs Search and
 * file into notebooks like any note. Newest days lead.
 */
export default function JournalPane() {
  const entries = useCollection(marginNotes, (n) => n.date !== undefined)
    .slice()
    .sort((a, b) => b.date!.localeCompare(a.date!) || b.createdAt.localeCompare(a.createdAt));
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState(today);
  /** The entry loaded for editing, when one is. */
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !date) return;
    saveNote({ id: editingId ?? undefined, text: draft.trim(), date });
    setDraft("");
    setDate(today());
    setEditingId(null);
  };

  const edit = (n: MarginNote) => {
    setDraft(n.text);
    setDate(n.date ?? today());
    setEditingId(n.id);
  };

  /* Grouped by day, the order the sort already walks. */
  const days: { date: string; entries: MarginNote[] }[] = [];
  for (const n of entries) {
    const last = days[days.length - 1];
    if (last && last.date === n.date) last.entries.push(n);
    else days.push({ date: n.date!, entries: [n] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8" data-print-root>
      <header className="border-b border-rule pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="small-caps text-xs font-semibold text-amber">Journal</p>
          {entries.length > 0 && <PrintButton />}
        </div>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">Gathered by day</h2>
        <p className="no-print mt-0.5 text-[0.68rem] text-muted">
          What you write here is a note like any other · it answers in Docs Search, and a note
          written on a verse in the reader can carry a date and appear here too · nothing leaves
          this device
        </p>
      </header>

      <form
        onSubmit={save}
        className="no-print rounded-[4px] border border-rule bg-surface p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <input
            type="date"
            value={date}
            aria-label="Entry date"
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
          />
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setDate(today());
                setEditingId(null);
              }}
              className="text-xs text-muted hover:text-ink"
            >
              Set it down without saving
            </button>
          )}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="What this day held…"
          aria-label="Journal entry"
          className="w-full rounded-[4px] border border-rule bg-paper p-3 text-sm leading-relaxed focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="mt-2 rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {editingId ? "Update the entry" : "Write it down"}
        </button>
      </form>

      {days.length === 0 ? (
        <p className="text-sm text-muted">Nothing written yet.</p>
      ) : (
        days.map((day) => (
          <section key={day.date}>
            <h3 className="small-caps mb-2 border-b border-rule pb-1 text-sm text-muted">
              {dayLabel(day.date)}
            </h3>
            <ul className="space-y-3">
              {day.entries.map((n) => (
                <li key={n.id} className="rounded-[4px] border border-rule bg-surface p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{n.text}</p>
                  <div className="no-print mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {isAnchored(n) && (
                      <button
                        type="button"
                        onClick={() => openRef(n.book, n.chapter, n.verse)}
                        className="text-sapphire hover:underline"
                      >
                        {getBook(n.book)?.name ?? n.book} {n.chapter}:{n.verse}
                      </button>
                    )}
                    {n.notebook && <span className="small-caps text-muted">{n.notebook}</span>}
                    <button
                      type="button"
                      onClick={() => edit(n)}
                      className="text-muted hover:text-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(n.id)}
                      className="text-ruby hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
