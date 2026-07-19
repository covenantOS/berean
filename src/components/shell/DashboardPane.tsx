"use client";

import { useEffect, useState } from "react";
import { getBook } from "@/lib/canon";
import { dailyRef } from "@/lib/daily-verse";
import { useCollection } from "@/lib/hooks";
import { isDue, memoryPassages } from "@/lib/memory";
import { currentDay, generatorFor, planProgress, plans, readingsForDay } from "@/lib/plans";
import { dueRequests, frequencyLabel, prayerLists } from "@/lib/prayers";
import { useSearchSaves, recordSearch } from "@/lib/search-history";
import { isComplete, runs, workflowFor } from "@/lib/workflows";
import { useWorkspace } from "./WorkspaceContext";

/**
 * The dashboard: the day's verse, readings, memory work, prayers, and
 * studies in progress on one calm surface. Every card reads a collection
 * that genuinely keeps the record, renders only when it has something to
 * say, and hands off to the pane that owns the work. No promos, no streaks,
 * nothing counted as an achievement: a study landing, not a feed.
 */

const CARD = "rounded-[4px] border border-rule bg-surface p-5";
const CARD_HEAD = "small-caps mb-2 text-sm text-muted";
const LINK = "text-sapphire hover:underline";

export default function DashboardPane() {
  const { dispatch } = useWorkspace();
  const planRows = useCollection(plans);
  const memoryRows = useCollection(memoryPassages);
  const listRows = useCollection(prayerLists);
  const runRows = useCollection(runs);
  const { history } = useSearchSaves();

  const day = dailyRef(new Date());
  const [verseText, setVerseText] = useState<string | null>(null);

  /* The day's portion reads its text from the same KJV data the reader
   * serves; a failed fetch degrades the card to the reference alone. */
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/passages?refs=${day.slug}.${day.chapter}.${day.verse}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          passages: { verses: { verse: number; text: string }[] }[];
        };
        const text = data.passages[0]?.verses.map((v) => v.text).join(" ");
        setVerseText(text || null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [day.slug, day.chapter, day.verse]);

  const dueMemory = memoryRows.filter((p) => isDue(p));
  const duePrayers = dueRequests(listRows);
  const studies = runRows
    .filter((r) => !isComplete(r))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recent = history.slice(0, 5);

  const readDay = () => {
    dispatch({ type: "openRef", book: day.slug, chapter: day.chapter });
    dispatch({ type: "selectVerse", book: day.slug, chapter: day.chapter, verse: day.verse });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Today</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">The day&apos;s appointed work</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          The verse, the readings, and the studies already begun · a card appears when it has
          something to say · nothing here is scored
        </p>
      </header>

      <section className={CARD}>
        <h3 className={CARD_HEAD}>Verse of the day</h3>
        {verseText && <p className="font-editorial text-base leading-relaxed">{verseText}</p>}
        <p className="mt-2 text-sm">
          <button type="button" onClick={readDay} className={LINK}>
            {day.label}
          </button>
        </p>
      </section>

      {planRows.map((plan) => {
        const gen = generatorFor(plan);
        if (!gen) return null;
        const today = Math.min(currentDay(plan), gen.days);
        const readings = readingsForDay(gen, today);
        const progress = planProgress(plan, gen);
        return (
          <section key={plan.id} className={CARD}>
            <h3 className={CARD_HEAD}>Today&apos;s reading · {gen.name}</h3>
            <div className="space-y-1 text-sm">
              {readings.map((r, i) => (
                <p key={i}>
                  {readings.length > 1 && (
                    <span className="small-caps mr-2 text-xs text-muted">{r.label}</span>
                  )}
                  {r.chapters.map((c, j) => (
                    <span key={`${c.book}-${c.chapter}`}>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: "openRef", book: c.book, chapter: c.chapter })
                        }
                        className={LINK}
                      >
                        {getBook(c.book)?.name} {c.chapter}
                      </button>
                      {j < r.chapters.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Day {today} of {gen.days} · {progress.done} of {progress.total} chapters read ·{" "}
              <button type="button" onClick={() => dispatch({ type: "openPlans" })} className={LINK}>
                Reading plans
              </button>
            </p>
          </section>
        );
      })}

      {dueMemory.length > 0 && (
        <section className={CARD}>
          <h3 className={CARD_HEAD}>Memory work due</h3>
          <ul className="space-y-1 text-sm">
            {dueMemory.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "openMemory", passageId: p.id })}
                  className={LINK}
                >
                  {getBook(p.book)?.name ?? p.book} {p.chapter}:{p.from}
                  {p.to !== p.from ? `–${p.to}` : ""}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            <button type="button" onClick={() => dispatch({ type: "openMemory" })} className={LINK}>
              Memory work
            </button>
          </p>
        </section>
      )}

      {duePrayers.length > 0 && (
        <section className={CARD}>
          <h3 className={CARD_HEAD}>Prayers appointed today</h3>
          <ul className="space-y-1 text-sm">
            {duePrayers.map(({ list, request }) => (
              <li key={request.id}>
                {request.title}
                <span className="small-caps ml-2 text-xs text-muted">
                  {list.title} · {frequencyLabel(request.frequency).toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            <button type="button" onClick={() => dispatch({ type: "openPrayers" })} className={LINK}>
              Prayer lists
            </button>
          </p>
        </section>
      )}

      {studies.length > 0 && (
        <section className={CARD}>
          <h3 className={CARD_HEAD}>Studies in progress</h3>
          <ul className="space-y-1 text-sm">
            {studies.map((run) => {
              const def = workflowFor(run.workflowId);
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "openWorkflow",
                        runId: run.id,
                        title: def ? `${def.name}: ${run.subject}` : "Workflow",
                      })
                    }
                    className={LINK}
                  >
                    {def ? `${def.name}: ${run.subject}` : run.subject}
                  </button>
                  {def && (
                    <span className="small-caps ml-2 text-xs text-muted">
                      step {run.currentStep + 1} of {def.steps.length}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className={CARD}>
          <h3 className={CARD_HEAD}>Recent searches</h3>
          <ul className="space-y-1 text-sm">
            {recent.map((entry) => (
              <li key={`${entry.q}:${entry.mode ?? "bible"}`}>
                <button
                  type="button"
                  title={`Search again for “${entry.q}”`}
                  onClick={() => {
                    recordSearch(entry.q, entry.mode);
                    dispatch({ type: "openSearch", q: entry.q, mode: entry.mode });
                  }}
                  className={LINK}
                >
                  “{entry.q}”
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
