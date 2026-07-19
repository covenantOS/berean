"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import { useCollection } from "@/lib/hooks";
import {
  blankIndexes,
  firstLetters,
  intervalIndex,
  isDue,
  memoryPassages,
  nextDue,
  recordReview,
  takeUp,
  type DrillMode,
  type MemoryPassage,
  type MemoryReview,
} from "@/lib/memory";

export default function MemoryPage() {
  const rows = useCollection(memoryPassages);
  const [book, setBook] = useState("psalms");
  const [chapter, setChapter] = useState(1);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");
  /** The passage standing in the drill, when one is open. */
  const [drillId, setDrillId] = useState<string | null>(null);
  const selectedBook = getBook(book);

  /* A deep link (?drill=<id>) opens the drill directly, the way the Almanac
   * rail hands a due passage over. */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("drill");
    if (id && memoryPassages.get(id)) setDrillId(id);
  }, []);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const f = Number(from);
    const t = Number(to || from);
    if (!Number.isInteger(f) || f < 1 || t < f) return;
    takeUp(book, chapter, f, t);
  }

  const due = rows.filter((p) => isDue(p));
  const held = rows.filter((p) => !isDue(p));
  const drill = drillId ? rows.find((p) => p.id === drillId) : undefined;

  /* Grading writes the review and walks to the next due passage, so a
   * sitting moves through the day's portion without returning to the list. */
  const grade = (result: MemoryReview["result"]) => {
    if (!drill) return;
    recordReview(drill.id, result);
    const next = due.find((p) => p.id !== drill.id);
    setDrillId(next?.id ?? null);
  };

  if (drill) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Drill key={drill.id} passage={drill} onGrade={grade} onClose={() => setDrillId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Memory Work</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        Passages scheduled for review until they hold, at widening intervals. Drill a passage by its
        first letters, by missing words, or from memory; your grading sets the next review. Nothing
        is scored, streaked, or celebrated.
      </p>

      <form
        onSubmit={add}
        className="mb-10 flex flex-wrap items-center gap-2 rounded-[4px] border border-rule bg-surface p-4"
      >
        <select
          value={book}
          onChange={(e) => {
            setBook(e.target.value);
            setChapter(1);
          }}
          aria-label="Book"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          {CANON.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={chapter}
          onChange={(e) => setChapter(Number(e.target.value))}
          aria-label="Chapter"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          {Array.from({ length: selectedBook?.chapters ?? 1 }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="from v."
          aria-label="From verse"
          className="w-20 rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        />
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="to v."
          aria-label="To verse"
          className="w-20 rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Take it up
        </button>
      </form>

      {due.length > 0 && (
        <section className="mb-8">
          <h2 className="small-caps mb-2 text-sm text-muted">Due for review</h2>
          <ul className="space-y-3">
            {due.map((p) => {
              const b = getBook(p.book);
              return (
                <li key={p.id} className="rounded-[4px] border border-rule bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/read/${p.book}/${p.chapter}#v${p.from}`}
                      className="font-editorial text-lg font-bold text-ink no-underline hover:text-sapphire"
                    >
                      {b?.name} {p.chapter}:{p.from}
                      {p.to !== p.from ? `–${p.to}` : ""}
                    </Link>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDrillId(p.id)}
                        className="rounded-[4px] border border-sapphire px-3 py-1.5 text-xs font-medium text-sapphire hover:bg-paper"
                      >
                        Drill
                      </button>
                      <button
                        onClick={() => recordReview(p.id, "held")}
                        className="rounded-[4px] border border-emerald px-3 py-1.5 text-xs font-medium text-emerald hover:bg-paper"
                      >
                        It held
                      </button>
                      <button
                        onClick={() => recordReview(p.id, "shaky")}
                        className="rounded-[4px] border border-amber px-3 py-1.5 text-xs font-medium text-amber hover:bg-paper"
                      >
                        Still shaky
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Recite it from memory, then open the text to check yourself.
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="small-caps mb-2 text-sm text-muted">In keeping</h2>
        {held.length === 0 && due.length === 0 ? (
          <p className="text-sm text-muted">Nothing taken up yet.</p>
        ) : held.length === 0 ? (
          <p className="text-sm text-muted">Everything is due above.</p>
        ) : (
          <ul className="space-y-2">
            {held.map((p) => {
              const b = getBook(p.book);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-surface px-4 py-2.5 text-sm"
                >
                  <div>
                    <Link
                      href={`/read/${p.book}/${p.chapter}#v${p.from}`}
                      className="font-medium text-ink no-underline hover:text-sapphire"
                    >
                      {b?.name} {p.chapter}:{p.from}
                      {p.to !== p.from ? `–${p.to}` : ""}
                    </Link>
                    <span className="small-caps ml-2 text-xs text-muted">
                      next review {nextDue(p).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => memoryPassages.remove(p.id)}
                    className="text-xs text-ruby hover:underline"
                  >
                    Lay aside
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------- The drill: three ways of asking for the text ---------- */

const MODES: { key: DrillMode; label: string }[] = [
  { key: "letters", label: "First letters" },
  { key: "blanks", label: "Missing words" },
  { key: "recall", label: "From memory" },
];

interface DrillVerse {
  verse: number;
  text: string;
  label?: string;
}

/**
 * One passage under drill. The text comes from the same API the editors
 * use, never from a stored copy, so the drill always answers the real
 * words. The mode is the reader's choice, not a lock; the grading is the
 * honest self-report that drives the schedule.
 */
function Drill({
  passage,
  onGrade,
  onClose,
}: {
  passage: MemoryPassage;
  onGrade: (result: MemoryReview["result"]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<DrillMode>("letters");
  const [verses, setVerses] = useState<DrillVerse[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** True once the full text stands revealed for checking. */
  const [revealed, setRevealed] = useState(false);
  /** Blank positions per verse, fixed for the sitting. */
  const [blanks, setBlanks] = useState<number[][]>([]);
  /** Blanked words the reader has turned over one at a time. */
  const [turned, setTurned] = useState<Set<string>>(new Set());
  const level = intervalIndex(passage);
  const b = getBook(passage.book);
  const reference = `${b?.name} ${passage.chapter}:${passage.from}${
    passage.to !== passage.from ? `–${passage.to}` : ""
  }`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/passage?book=${passage.book}&chapter=${passage.chapter}&from=${passage.from}&to=${passage.to}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { verses: DrillVerse[] };
        setVerses(data.verses);
        setBlanks(
          data.verses.map((v) => blankIndexes(v.text.split(/\s+/).filter(Boolean).length, level))
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage.id]);

  const turnWord = (key: string) =>
    setTurned((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-editorial text-2xl font-bold">{reference}</h1>
        <button onClick={onClose} className="text-xs text-muted hover:text-ink">
          Back to the list
        </button>
      </div>

      <div className="mb-6 flex gap-1" role="tablist" aria-label="Drill mode">
        {MODES.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={mode === m.key}
            onClick={() => setMode(m.key)}
            className={`rounded-[4px] border px-3 py-1.5 text-xs font-medium ${
              mode === m.key
                ? "border-ink bg-ink text-white"
                : "border-rule bg-surface text-ink hover:bg-paper"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-[4px] border border-rule bg-surface p-5">
        {failed ? (
          <p className="text-sm text-muted">The text could not be read. Open the passage in the reader instead.</p>
        ) : verses === null ? (
          <p className="text-sm text-muted">Opening the text…</p>
        ) : mode === "recall" && !revealed ? (
          <RecallPrompt />
        ) : (
          <div className="font-editorial space-y-2 text-base leading-relaxed">
            {verses.map((v, vi) => {
              const words = v.text.split(/\s+/).filter(Boolean);
              return (
                <p key={v.verse}>
                  <sup className="mr-1 text-xs text-muted">{v.label ?? v.verse}</sup>
                  {mode === "letters" && !revealed ? (
                    <span className="font-mono tracking-wide">{firstLetters(v.text)}</span>
                  ) : mode === "blanks" && !revealed ? (
                    words.map((w, wi) => {
                      const key = `${vi}:${wi}`;
                      const blank = blanks[vi]?.includes(wi) && !turned.has(key);
                      return (
                        <span key={key}>
                          {blank ? (
                            <button
                              onClick={() => turnWord(key)}
                              title="Turn this word over"
                              className="border-b border-dashed border-muted text-transparent select-none hover:border-sapphire"
                            >
                              {w}
                            </button>
                          ) : (
                            <span>{w}</span>
                          )}{" "}
                        </span>
                      );
                    })
                  ) : (
                    v.text
                  )}
                </p>
              );
            })}
          </div>
        )}
        {verses !== null && !failed && (
          <div className="mt-4">
            <button
              onClick={() => setRevealed((r) => !r)}
              className="text-xs text-sapphire hover:underline"
            >
              {revealed ? "Hide the text" : mode === "recall" ? "Set the text beside you" : "Reveal the text"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="small-caps mr-1 text-xs text-muted">How did it go?</span>
        <button
          onClick={() => onGrade("again")}
          className="rounded-[4px] border border-ruby px-3 py-1.5 text-xs font-medium text-ruby hover:bg-surface"
        >
          Begin again
        </button>
        <button
          onClick={() => onGrade("shaky")}
          className="rounded-[4px] border border-amber px-3 py-1.5 text-xs font-medium text-amber hover:bg-surface"
        >
          Still shaky
        </button>
        <button
          onClick={() => onGrade("held")}
          className="rounded-[4px] border border-emerald px-3 py-1.5 text-xs font-medium text-emerald hover:bg-surface"
        >
          It held
        </button>
      </div>
    </div>
  );
}

/** Full recall: the text stays hidden while the reader writes or recites. */
function RecallPrompt() {
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Write it out or recite it aloud, then set the text beside you and grade yourself honestly.
      </p>
      <textarea
        rows={4}
        aria-label="Your recall"
        placeholder="The passage, as you carry it…"
        className="w-full rounded-[4px] border border-rule bg-paper p-3 text-sm leading-relaxed focus:outline focus:outline-2 focus:outline-sapphire"
      />
    </div>
  );
}
