"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBook } from "@/lib/canon";
import { useCollection } from "@/lib/hooks";
import { RuleCadence, calendar, rule, todayISO, toggleKept } from "@/lib/almanac";
import { listProjects, projects as projectsCollection, StudyProject } from "@/lib/projects";
import { plans, generatorFor, currentDay, readingsForDay } from "@/lib/plans";
import { memoryPassages, isDue } from "@/lib/memory";

export default function AlmanacPage() {
  const entries = useCollection(calendar).sort((a, b) => a.date.localeCompare(b.date));
  const ruleItems = useCollection(rule);
  const activePlans = useCollection(plans);
  const memory = useCollection(memoryPassages);
  const [sermons, setSermons] = useState<StudyProject[]>([]);

  const [entryTitle, setEntryTitle] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [entrySeries, setEntrySeries] = useState("");
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleCadence, setRuleCadence] = useState<RuleCadence>("daily");

  useEffect(() => {
    const load = () => setSermons(listProjects("sermon").filter((p) => p.appointedFor));
    load();
    return projectsCollection.subscribe(load);
  }, []);

  const today = todayISO();
  const dueMemory = memory.filter((p) => isDue(p));

  // The preaching calendar: explicit entries plus appointed sermons, one timeline.
  const timeline = [
    ...entries.map((e) => ({
      key: e.id,
      date: e.date,
      title: e.title,
      series: e.series,
      href: e.projectId ? `/pulpit/${e.projectId}` : e.liturgyId ? `/chapel/${e.liturgyId}` : undefined,
      kind: e.type as string,
      removable: true,
    })),
    ...sermons.map((p) => ({
      key: `sermon-${p.id}`,
      date: p.appointedFor!,
      title: p.title,
      series: p.series,
      href: `/pulpit/${p.id}`,
      kind: "sermon",
      removable: false,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = timeline.filter((t) => t.date >= today);
  const past = timeline.filter((t) => t.date < today);

  function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryDate || !entryTitle.trim()) return;
    calendar.create({
      date: entryDate,
      type: "teaching",
      title: entryTitle.trim(),
      series: entrySeries.trim() || undefined,
    });
    setEntryTitle("");
    setEntrySeries("");
  }

  function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleTitle.trim()) return;
    rule.create({ title: ruleTitle.trim(), cadence: ruleCadence, kept: [] });
    setRuleTitle("");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">The Almanac</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        The room that governs time: the preaching and teaching calendar, the rule of life, and the
        day&apos;s appointed work. Everything be done decently and in order.
      </p>

      {/* Today's appointed work */}
      <section className="mb-10 rounded-[4px] border border-rule bg-surface p-5">
        <h2 className="small-caps mb-3 text-sm text-muted">Appointed today</h2>
        <ul className="space-y-2 text-sm">
          {activePlans.map((plan) => {
            const gen = generatorFor(plan);
            if (!gen) return null;
            const day = Math.min(currentDay(plan), gen.days);
            const done = plan.completedDays.includes(day);
            const readings = readingsForDay(gen, day);
            return (
              <li key={plan.id}>
                <span className={done ? "text-emerald" : ""}>
                  {gen.name}, day {day}:
                </span>{" "}
                {readings.map((r, i) => (
                  <span key={i}>
                    {r.label !== "Reading" && <span className="text-muted">{r.label}: </span>}
                    {r.chapters.map((c, j) => (
                      <span key={`${c.book}-${c.chapter}`}>
                        <Link
                          href={`/read/${c.book}/${c.chapter}`}
                          className="text-sapphire no-underline hover:underline"
                        >
                          {getBook(c.book)?.name} {c.chapter}
                        </Link>
                        {j < r.chapters.length - 1 ? ", " : ""}
                      </span>
                    ))}
                    {i < readings.length - 1 ? " · " : ""}
                  </span>
                ))}{" "}
                {done && <span className="small-caps text-xs text-emerald">read</span>}
              </li>
            );
          })}
          {dueMemory.length > 0 && (
            <li>
              Memory work:{" "}
              <Link href="/memory" className="text-sapphire no-underline hover:underline">
                {dueMemory.length} passage{dueMemory.length === 1 ? "" : "s"} due for review
              </Link>
            </li>
          )}
          {upcoming.length > 0 && upcoming[0].date === today && (
            <li>
              Today:{" "}
              {upcoming[0].href ? (
                <Link href={upcoming[0].href} className="text-sapphire no-underline hover:underline">
                  {upcoming[0].title}
                </Link>
              ) : (
                upcoming[0].title
              )}
            </li>
          )}
          {activePlans.length === 0 && dueMemory.length === 0 && (
            <li className="text-muted">
              Nothing appointed. Begin a{" "}
              <Link href="/plans" className="text-sapphire no-underline hover:underline">
                reading plan
              </Link>{" "}
              or add{" "}
              <Link href="/memory" className="text-sapphire no-underline hover:underline">
                memory work
              </Link>
              , and the Almanac will keep the day&apos;s portion before you.
            </li>
          )}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Preaching & teaching calendar */}
        <section>
          <h2 className="small-caps mb-2 text-sm text-muted">Preaching &amp; teaching calendar</h2>
          <form onSubmit={addEntry} className="mb-4 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder="Class, series note, occasion…"
              aria-label="Entry title"
              className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
            />
            <input
              value={entrySeries}
              onChange={(e) => setEntrySeries(e.target.value)}
              placeholder="Series (optional)"
              aria-label="Series"
              className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              aria-label="Date"
              className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Add
            </button>
          </form>
          {upcoming.length === 0 && past.length === 0 ? (
            <p className="text-sm text-muted">
              The calendar is empty. Sermons appointed with a date at the{" "}
              <Link href="/pulpit" className="text-sapphire no-underline hover:underline">
                Pulpit
              </Link>{" "}
              appear here of themselves.
            </p>
          ) : (
            <>
              <CalendarList rows={upcoming} onRemove={(k) => calendar.remove(k)} />
              {past.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted">
                    {past.length} past entr{past.length === 1 ? "y" : "ies"}
                  </summary>
                  <div className="mt-2">
                    <CalendarList rows={past} onRemove={(k) => calendar.remove(k)} />
                  </div>
                </details>
              )}
            </>
          )}
        </section>

        {/* Rule of life */}
        <section>
          <h2 className="small-caps mb-2 text-sm text-muted">The rule of life</h2>
          <form onSubmit={addRule} className="mb-4 grid grid-cols-[1fr_auto_auto] gap-2">
            <input
              value={ruleTitle}
              onChange={(e) => setRuleTitle(e.target.value)}
              placeholder="Morning prayer, family worship, writing hour…"
              aria-label="Discipline"
              className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
            />
            <select
              value={ruleCadence}
              onChange={(e) => setRuleCadence(e.target.value as RuleCadence)}
              aria-label="Cadence"
              className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="lordsday">Lord&apos;s Day</option>
            </select>
            <button
              type="submit"
              className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Appoint
            </button>
          </form>
          {ruleItems.length === 0 ? (
            <p className="text-sm text-muted">
              A rule of life is the order a disciplined man appoints for himself: the daily offices,
              family worship, fasting, memory work, writing hours. Written down and kept — plainly,
              with no scoring.
            </p>
          ) : (
            <ul className="space-y-2">
              {ruleItems.map((item) => {
                const keptToday = item.kept.includes(today);
                const recent = item.kept.slice(-7);
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-surface px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="small-caps text-xs text-muted">
                        {item.cadence === "lordsday" ? "Lord's Day" : item.cadence}
                        {recent.length > 0 &&
                          ` · last kept ${new Date(recent[recent.length - 1] + "T00:00:00").toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleKept(item, today)}
                        className={`rounded-[4px] border px-3 py-1.5 text-xs font-medium ${
                          keptToday
                            ? "border-emerald bg-surface text-emerald"
                            : "border-rule hover:bg-paper"
                        }`}
                      >
                        {keptToday ? "Kept today" : "Mark kept"}
                      </button>
                      <button
                        onClick={() => rule.remove(item.id)}
                        aria-label="Remove discipline"
                        className="rounded-[4px] border border-rule px-2 py-1.5 text-xs text-ruby hover:bg-paper"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function CalendarList({
  rows,
  onRemove,
}: {
  rows: { key: string; date: string; title: string; series?: string; href?: string; kind: string; removable: boolean }[];
  onRemove: (key: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((t) => (
        <li
          key={t.key}
          className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-surface px-4 py-2.5 text-sm"
        >
          <div>
            <span className="small-caps mr-2 text-xs text-muted">{t.date}</span>
            {t.href ? (
              <Link href={t.href} className="font-medium text-ink no-underline hover:text-sapphire">
                {t.title}
              </Link>
            ) : (
              <span className="font-medium">{t.title}</span>
            )}
            {t.series && <span className="text-muted"> · {t.series}</span>}
            <span className="small-caps ml-2 text-xs text-muted">{t.kind}</span>
          </div>
          {t.removable && (
            <button
              onClick={() => onRemove(t.key)}
              aria-label="Remove entry"
              className="text-xs text-ruby hover:underline"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
