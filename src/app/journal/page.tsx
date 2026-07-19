"use client";

import Link from "next/link";
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

/**
 * The journal: date-anchored notes read as a diary. An entry is a note in
 * the same marginalia collection as everything else (src/lib/marginalia.ts);
 * the date on the record makes it a journal entry, and it may carry a verse
 * anchor too when it was written against a text. Entries answer in Docs
 * Search and file into notebooks like any note. Newest days lead.
 */
export default function JournalPage() {
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
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6" data-print-root>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h1 className="font-editorial text-2xl font-bold">Journal</h1>
        {entries.length > 0 && <PrintButton />}
      </div>
      <p className="no-print mb-8 max-w-2xl text-sm text-muted">
        Entries gathered by day. What you write here is a note like any other: it answers in Docs
        Search, and a note written on a verse in the reader can carry a date and appear here too.
        Nothing leaves this device.
      </p>

      <form
        onSubmit={save}
        className="no-print mb-10 rounded-[4px] border border-rule bg-surface p-4"
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
          <section key={day.date} className="mb-8">
            <h2 className="small-caps mb-2 border-b border-rule pb-1 text-sm text-muted">
              {dayLabel(day.date)}
            </h2>
            <ul className="space-y-3">
              {day.entries.map((n) => (
                <li key={n.id} className="rounded-[4px] border border-rule bg-surface p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{n.text}</p>
                  <div className="no-print mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {isAnchored(n) && (
                      <Link
                        href={`/read/${n.book}/${n.chapter}#v${n.verse}`}
                        className="text-sapphire no-underline hover:underline"
                      >
                        {getBook(n.book)?.name ?? n.book} {n.chapter}:{n.verse}
                      </Link>
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
