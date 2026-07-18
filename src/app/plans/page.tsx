"use client";

import Link from "next/link";
import { getBook } from "@/lib/canon";
import { useCollection } from "@/lib/hooks";
import {
  GENERATORS,
  currentDay,
  generatorFor,
  plans,
  readingsForDay,
  toggleDay,
} from "@/lib/plans";
import { todayISO } from "@/lib/almanac";

export default function PlansPage() {
  const rows = useCollection(plans);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Reading Plans</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        Plans generated from the canon itself, paced evenly across their days. Named historic
        calendars (M&apos;Cheyne among them) will join the shelf from verified source tables — see{" "}
        <Link href="/sources" className="text-sapphire no-underline hover:underline">
          Sources
        </Link>
        . Progress is a private record, not a score; a missed day simply waits.
      </p>

      {rows.length > 0 && (
        <section className="mb-10 space-y-4">
          <h2 className="small-caps text-sm text-muted">Your plans</h2>
          {rows.map((plan) => {
            const gen = generatorFor(plan);
            if (!gen) return null;
            const day = Math.min(currentDay(plan), gen.days);
            const readings = readingsForDay(gen, day);
            const done = plan.completedDays.includes(day);
            const completed = plan.completedDays.length;
            return (
              <div key={plan.id} className="rounded-[4px] border border-rule bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-editorial text-lg font-bold">{gen.name}</h3>
                    <p className="small-caps text-xs text-muted">
                      Day {day} of {gen.days} · began {plan.startDate} · {completed} day
                      {completed === 1 ? "" : "s"} read
                    </p>
                  </div>
                  <div className="flex gap-2">
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
                <div className="mt-3 space-y-1 text-sm">
                  {readings.map((r, i) => (
                    <p key={i}>
                      {readings.length > 1 && (
                        <span className="small-caps mr-2 text-xs text-muted">{r.label}</span>
                      )}
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
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section>
        <h2 className="small-caps mb-2 text-sm text-muted">Begin a plan</h2>
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
