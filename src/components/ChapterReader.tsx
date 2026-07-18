"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MarginNote,
  deleteNote,
  listNotes,
  saveNote,
} from "@/lib/marginalia";

type Mode = "paper" | "warm" | "evening";
const MODE_KEY = "berean.readerMode.v1";

interface Verse {
  verse: number;
  text: string;
}

export default function ChapterReader({
  bookSlug,
  bookName,
  chapter,
  verses,
  poetry,
  heading,
}: {
  bookSlug: string;
  bookName: string;
  chapter: number;
  verses: Verse[];
  poetry: boolean;
  heading: string;
}) {
  const [mode, setMode] = useState<Mode>("paper");
  const [notes, setNotes] = useState<MarginNote[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(MODE_KEY) as Mode | null;
    if (stored === "warm" || stored === "evening") setMode(stored);
    setNotes(listNotes(bookSlug, chapter));
  }, [bookSlug, chapter]);

  function changeMode(m: Mode) {
    setMode(m);
    window.localStorage.setItem(MODE_KEY, m);
  }

  const notedVerses = useMemo(() => new Set(notes.map((n) => n.verse)), [notes]);

  function openVerse(v: number) {
    if (selectedVerse === v) {
      setSelectedVerse(null);
      return;
    }
    setSelectedVerse(v);
    const existing = notes.find((n) => n.verse === v);
    setDraft(existing?.text ?? "");
    setEditingId(existing?.id ?? null);
  }

  function submitNote() {
    if (!selectedVerse || !draft.trim()) return;
    saveNote({
      id: editingId ?? undefined,
      book: bookSlug,
      chapter,
      verse: selectedVerse,
      text: draft.trim(),
    });
    setNotes(listNotes(bookSlug, chapter));
    setSelectedVerse(null);
    setDraft("");
    setEditingId(null);
  }

  function removeNote(id: string) {
    deleteNote(id);
    setNotes(listNotes(bookSlug, chapter));
    setSelectedVerse(null);
    setEditingId(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <article
        className="reader-surface rounded-[4px] border border-rule px-5 py-8 sm:px-10 sm:py-10"
        data-mode={mode === "paper" ? undefined : mode}
      >
        <div className="no-print mb-6 flex items-center justify-between gap-3">
          <h1 className="font-editorial text-2xl font-bold sm:text-3xl">{heading}</h1>
          <div
            className="flex gap-1 rounded-[4px] border border-rule p-0.5 text-xs"
            role="group"
            aria-label="Reading mode"
          >
            {(
              [
                ["paper", "Paper"],
                ["warm", "Warm"],
                ["evening", "Evening"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                aria-pressed={mode === m}
                className={`rounded-[3px] px-2 py-1 font-[family-name:var(--font-interface)] ${
                  mode === m ? "bg-sapphire text-white" : "opacity-70 hover:opacity-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {poetry ? (
          <div className="poetry-verses">
            {verses.map((v) => (
              <p
                key={v.verse}
                id={`v${v.verse}`}
                className={`verse-line verse-target ${notedVerses.has(v.verse) ? "has-note" : ""} ${
                  selectedVerse === v.verse ? "verse-selected" : ""
                }`}
              >
                <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
                {v.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="prose-verses drop-cap">
            {verses.map((v) => (
              <span
                key={v.verse}
                id={`v${v.verse}`}
                className={`verse-target ${notedVerses.has(v.verse) ? "has-note" : ""} ${
                  selectedVerse === v.verse ? "verse-selected" : ""
                }`}
              >
                <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
                {v.text}{" "}
              </span>
            ))}
          </p>
        )}
      </article>

      <aside className="no-print">
        <div className="sticky top-6 rounded-[4px] border border-rule bg-surface p-4">
          <h2 className="small-caps mb-3 text-sm text-muted">Marginalia</h2>

          {selectedVerse !== null ? (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">
                {bookName} {chapter}:{selectedVerse}
              </p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                autoFocus
                placeholder="A note in the margin…"
                className="w-full rounded-[4px] border border-rule bg-paper p-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={submitNote}
                  disabled={!draft.trim()}
                  className="rounded-[4px] bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {editingId ? "Update note" : "Save note"}
                </button>
                {editingId && (
                  <button
                    onClick={() => removeNote(editingId)}
                    className="rounded-[4px] border border-rule px-3 py-1.5 text-xs font-medium text-ruby"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedVerse(null);
                    setEditingId(null);
                  }}
                  className="rounded-[4px] border border-rule px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-4 text-xs text-muted">
              Tap a verse number to write a note. Notes are private and stored
              only on this device.
            </p>
          )}

          {notes.length > 0 ? (
            <ul className="space-y-3 border-t border-rule pt-3">
              {notes
                .slice()
                .sort((a, b) => a.verse - b.verse)
                .map((n) => (
                  <li key={n.id} className="text-sm">
                    <button
                      onClick={() => openVerse(n.verse)}
                      className="font-medium text-sapphire hover:underline"
                    >
                      v. {n.verse}
                    </button>
                    <p className="mt-0.5 whitespace-pre-wrap text-[0.83rem] leading-relaxed text-ink">
                      {n.text}
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="border-t border-rule pt-3 text-xs text-muted">
              No notes on this chapter yet.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function VerseNum({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="verse-num"
      aria-label={`Verse ${n} — add or view note`}
      type="button"
    >
      {n}
    </button>
  );
}
