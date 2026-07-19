"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CANON, getBook } from "@/lib/canon";
import { useCollection } from "@/lib/hooks";
import {
  GENERATORS,
  adjustPlan,
  beginBookPlan,
  beginCustomPlan,
  chaptersInRange,
  currentDay,
  divideBook,
  generatorFor,
  isBehind,
  planProgress,
  plans,
  readingsForDay,
  toggleDay,
} from "@/lib/plans";
import { personalbooks } from "@/lib/personalbooks";
import { todayISO } from "@/lib/almanac";
import { useWorkspace } from "./WorkspaceContext";

/** Opens the passage in the workspace, the way every pane asks. */
function openRef(book: string, chapter: number, verse?: number) {
  window.dispatchEvent(new CustomEvent("berean:open-ref", { detail: { book, chapter, verse } }));
}

/**
 * The Plans pane: reading plans generated from the canon itself, paced
 * evenly across their days, moved from the retired /plans page. Progress
 * is a private record, not a score; a missed day simply waits.
 */
export default function PlansPane() {
  const { dispatch } = useWorkspace();
  const rows = useCollection(plans);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Reading plans</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">The canon, paced across days</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          Named historic calendars (M&apos;Cheyne among them) will join the shelf from verified
          source tables, see{" "}
          <Link href="/sources" className="text-sapphire no-underline hover:underline">
            Sources
          </Link>{" "}
          · progress is a private record, not a score · a missed day simply waits
        </p>
      </header>

      {rows.length > 0 && (
        <section className="space-y-4">
          <h3 className="small-caps text-sm text-muted">Your plans</h3>
          {rows.map((plan) => {
            const gen = generatorFor(plan);
            if (!gen) return null;
            const day = Math.min(currentDay(plan), gen.days);
            const readings = readingsForDay(gen, day);
            const done = plan.completedDays.includes(day);
            const completed = plan.completedDays.length;
            const progress = planProgress(plan, gen);
            const behind = isBehind(plan, gen) && progress.done < progress.total;
            return (
              <div key={plan.id} className="rounded-[4px] border border-rule bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-editorial text-lg font-bold">{gen.name}</h4>
                    <p className="small-caps text-xs text-muted">
                      Day {day} of {gen.days} · began {plan.startDate} · {completed} day
                      {completed === 1 ? "" : "s"} read
                      {behind && <span className="text-amber"> · behind the calendar</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {behind && (
                      <button
                        onClick={() => adjustPlan(plan)}
                        title="Redistribute the unread remainder over the days that remain, starting today"
                        className="rounded-[4px] border border-rule px-3 py-1.5 text-xs font-medium text-sapphire hover:bg-paper"
                      >
                        Catch up
                      </button>
                    )}
                    <button
                      onClick={() => toggleDay(plan, day)}
                      className={`rounded-[4px] border px-3 py-1.5 text-xs font-medium ${
                        done ? "border-emerald text-emerald" : "border-rule hover:bg-paper"
                      }`}
                    >
                      {done ? "Read today" : "Mark today read"}
                    </button>
                    <button
                      onClick={() => plans.remove(plan.id)}
                      className="rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
                    >
                      Lay aside
                    </button>
                  </div>
                </div>
                <div
                  className="mt-3 h-1.5 bg-paper"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.done}
                  aria-label={`${gen.name} progress`}
                >
                  <div
                    className="h-full bg-emerald"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                <p className="small-caps mt-1 text-xs text-muted">
                  {progress.done} of {progress.total} {plan.book ? "sessions" : "chapters"}
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  {readings.map((r, i) => (
                    <p key={i}>
                      {readings.length > 1 && (
                        <span className="small-caps mr-2 text-xs text-muted">{r.label}</span>
                      )}
                      {r.chapters.map((c, j) => (
                        <span key={`${c.book}-${c.chapter}`}>
                          {plan.book ? (
                            /* A book plan's chapters wear the session
                             * numbers; the session opens the book at its
                             * slice. */
                            <button
                              type="button"
                              onClick={() =>
                                dispatch({
                                  type: "openPersonalBook",
                                  bookId: plan.book!.bookId,
                                  title: plan.book!.title,
                                  session: c.chapter,
                                  of: plan.book!.sessions.length,
                                })
                              }
                              className="text-sapphire hover:underline"
                            >
                              {plan.book.sessions[c.chapter - 1] ?? `Session ${c.chapter}`}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openRef(c.book, c.chapter)}
                              className="text-sapphire hover:underline"
                            >
                              {getBook(c.book)?.name} {c.chapter}
                            </button>
                          )}
                          {j < r.chapters.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <CustomPlanForm />

      <section>
        <h3 className="small-caps mb-2 text-sm text-muted">Begin a plan</h3>
        <ul className="space-y-3">
          {GENERATORS.map((g) => (
            <li
              key={g.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-rule bg-surface p-4"
            >
              <div>
                <p className="font-editorial text-lg font-bold">{g.name}</p>
                <p className="text-sm text-muted">
                  {g.description} <span className="small-caps text-xs">{g.days} days</span>
                </p>
              </div>
              <button
                onClick={() =>
                  plans.create({ generatorKey: g.key, startDate: todayISO(), completedDays: [] })
                }
                className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Begin today
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Build a plan over any stretch of the canon at a chosen pace. */
function CustomPlanForm() {
  const [name, setName] = useState("");
  const [source, setSource] = useState<"range" | "book">("range");
  const [fromBook, setFromBook] = useState("genesis");
  const [fromCh, setFromCh] = useState(1);
  const [toBook, setToBook] = useState("genesis");
  const [toCh, setToCh] = useState(50);
  const [paceMode, setPaceMode] = useState<"perDay" | "days">("perDay");
  const [pace, setPace] = useState(3);

  const books = useCollection(personalbooks);
  const [bookId, setBookId] = useState("");
  const selected = books.find((b) => b.id === bookId) ?? books[0];
  const paceArg = paceMode === "days" ? { days: pace } : { perDay: pace };
  /* The division preview answers the form's question before the plan begins:
   * how many sittings this book makes at this pace. */
  const division = useMemo(
    () => (source === "book" && selected ? divideBook(selected.body, paceArg) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, selected?.id, selected?.body, paceMode, pace]
  );

  const clampCh = (slug: string, v: number) =>
    Math.max(1, Math.min(getBook(slug)?.chapters ?? 1, Math.floor(v) || 1));

  const chapters = chaptersInRange(
    { book: fromBook, chapter: fromCh },
    { book: toBook, chapter: toCh }
  );
  const days =
    paceMode === "days"
      ? Math.max(1, Math.min(pace, chapters.length))
      : Math.ceil(chapters.length / Math.max(1, pace));
  const bookDays = division
    ? paceMode === "days"
      ? Math.max(1, Math.min(pace, division.sessions.length))
      : Math.ceil(division.sessions.length / Math.max(1, pace))
    : 0;

  const begin = (e: React.FormEvent) => {
    e.preventDefault();
    if (source === "book") {
      if (!selected) return;
      beginBookPlan(selected, paceArg);
      setName("");
      return;
    }
    if (chapters.length === 0) return;
    const from = getBook(fromBook);
    const to = getBook(toBook);
    const auto =
      fromBook === toBook
        ? fromCh === 1 && toCh === (from?.chapters ?? 1)
          ? (from?.name ?? "A reading plan")
          : fromCh === toCh
            ? `${from?.name} ${fromCh}`
            : `${from?.name} ${fromCh} to ${toCh}`
        : `${from?.name} ${fromCh} to ${to?.name} ${toCh}`;
    beginCustomPlan(
      name.trim() || auto,
      chapters,
      paceMode === "days" ? { days } : { perDay: pace }
    );
    setName("");
  };

  const field =
    "rounded-[4px] border border-rule bg-surface px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-sapphire";

  return (
    <section>
      <h3 className="small-caps mb-2 text-sm text-muted">Build a plan</h3>
      <form onSubmit={begin} className="space-y-3 rounded-[4px] border border-rule bg-surface p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          aria-label="Plan name"
          className={`${field} w-full`}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="small-caps text-xs text-muted">Source</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "range" | "book")}
            aria-label="Plan source"
            className={field}
          >
            <option value="range">A passage range</option>
            <option value="book">A book</option>
          </select>
        </div>
        {source === "range" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="small-caps text-xs text-muted">From</span>
            <select
              value={fromBook}
              onChange={(e) => {
                setFromBook(e.target.value);
                setFromCh((c) => clampCh(e.target.value, c));
              }}
              aria-label="From book"
              className={field}
            >
              {CANON.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={getBook(fromBook)?.chapters}
              value={fromCh}
              onChange={(e) => setFromCh(clampCh(fromBook, Number(e.target.value)))}
              aria-label="From chapter"
              className={`${field} w-20`}
            />
            <span className="small-caps text-xs text-muted">through</span>
            <select
              value={toBook}
              onChange={(e) => {
                setToBook(e.target.value);
                setToCh((c) => clampCh(e.target.value, c));
              }}
              aria-label="Through book"
              className={field}
            >
              {CANON.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={getBook(toBook)?.chapters}
              value={toCh}
              onChange={(e) => setToCh(clampCh(toBook, Number(e.target.value)))}
              aria-label="Through chapter"
              className={`${field} w-20`}
            />
          </div>
        )}
        {source === "book" &&
          (books.length === 0 ? (
            <p className="text-sm text-muted">
              No personal books yet. Import a text in the Library and it divides into sessions
              here; the shipped library works carry no pagination to pace against.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="small-caps text-xs text-muted">Book</span>
              <select
                value={selected?.id ?? ""}
                onChange={(e) => setBookId(e.target.value)}
                aria-label="Personal book"
                className={field}
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>
          ))}
        {(source === "range" || books.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="small-caps text-xs text-muted">Pace</span>
            <input
              type="number"
              min={1}
              value={pace}
              onChange={(e) => setPace(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
              aria-label="Pace"
              className={`${field} w-20`}
            />
            <select
              value={paceMode}
              onChange={(e) => setPaceMode(e.target.value as "perDay" | "days")}
              aria-label="Pace measure"
              className={field}
            >
              <option value="perDay">
                {source === "book" ? "sessions a day" : "chapters a day"}
              </option>
              <option value="days">days, start to finish</option>
            </select>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {source === "book"
              ? division && division.sessions.length > 0
                ? `${division.sessions.length} session${division.sessions.length === 1 ? "" : "s"} over ${bookDays} day${bookDays === 1 ? "" : "s"}.`
                : "This book has no words to pace."
              : `${chapters.length} chapter${chapters.length === 1 ? "" : "s"} over ${days} day${days === 1 ? "" : "s"}.`}
          </p>
          <button
            type="submit"
            disabled={source === "book" && (!division || division.sessions.length === 0)}
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Begin plan
          </button>
        </div>
      </form>
    </section>
  );
}
