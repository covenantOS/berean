"use client";

import Link from "next/link";
import { useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import { useCollection } from "@/lib/hooks";
import { isDue, memoryPassages, nextDue, recordReview } from "@/lib/memory";

export default function MemoryPage() {
  const rows = useCollection(memoryPassages);
  const [book, setBook] = useState("psalms");
  const [chapter, setChapter] = useState(1);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");
  const selectedBook = getBook(book);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const f = Number(from);
    const t = Number(to || from);
    if (!Number.isInteger(f) || f < 1 || t < f) return;
    memoryPassages.create({ book, chapter, from: f, to: t, reviews: [] });
  }

  const due = rows.filter((p) => isDue(p));
  const held = rows.filter((p) => !isDue(p));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Memory Work</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        Passages scheduled for review until they hold, at widening intervals. The record simply says
        what is due — nothing is scored, streaked, or celebrated.
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
