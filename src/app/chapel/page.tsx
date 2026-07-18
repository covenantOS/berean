"use client";

import Link from "next/link";
import { useState } from "react";
import { useCollection } from "@/lib/hooks";
import {
  Liturgy,
  LiturgyTemplate,
  defaultOrder,
  liturgies,
  liturgyTemplates,
} from "@/lib/liturgy";
import { plans, generatorFor, currentDay, readingsForDay } from "@/lib/plans";
import { getBook } from "@/lib/canon";

export default function ChapelPage() {
  const rows = useCollection(liturgies).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const templates = useCollection(liturgyTemplates);
  const activePlans = useCollection(plans);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [templateId, setTemplateId] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const template = templates.find((t) => t.id === templateId);
    const elements = template
      ? template.elements.map((el) => ({ ...el, id: crypto.randomUUID() }))
      : defaultOrder();
    liturgies.create({
      title: title.trim() || (date ? `Lord's Day, ${date}` : "Order of Worship"),
      date: date || undefined,
      elements,
    });
    setTitle("");
    setDate("");
  }

  // This evening's family worship: the day's reading from the first plan,
  // and a psalm appointed by simple rotation through the psalter.
  const plan = activePlans[0];
  const gen = plan ? generatorFor(plan) : undefined;
  const day = plan && gen ? Math.min(currentDay(plan), gen.days) : 0;
  const familyReadings = plan && gen ? readingsForDay(gen, day) : [];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const eveningPsalm = (dayOfYear % 150) + 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">The Chapel</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        The service of the Lord&apos;s Day is built here, from the full historic vocabulary:
        call to worship, confession, assurance, the reading of the Law, psalms and hymns,
        the sermon, the Table, the benediction. A congregation&apos;s settled form becomes its
        template; each week is composed from it rather than from a blank page.
      </p>

      <form
        onSubmit={add}
        className="mb-10 grid gap-3 rounded-[4px] border border-rule bg-surface p-5 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Service title (optional)"
          aria-label="Service title"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Service date"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        />
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          aria-label="Start from template"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          <option value="">Historic starting order</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Compose a service
        </button>
      </form>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="small-caps mb-2 text-sm text-muted">Orders of worship</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">
              No services composed yet. Begin one above — the historic starting order is
              editable into your congregation&apos;s own settled form.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((l: Liturgy) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-surface p-4"
                >
                  <div>
                    <Link
                      href={`/chapel/${l.id}`}
                      className="font-editorial text-lg font-bold text-ink no-underline hover:text-sapphire"
                    >
                      {l.title}
                    </Link>
                    <p className="small-caps text-xs text-muted">
                      {l.date ?? "undated"} · {l.elements.length} elements
                    </p>
                  </div>
                  <button
                    onClick={() => liturgies.remove(l.id)}
                    className="rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          {templates.length > 0 && (
            <div className="mt-8">
              <h2 className="small-caps mb-2 text-sm text-muted">Your settled forms</h2>
              <ul className="space-y-2">
                {templates.map((t: LiturgyTemplate) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm"
                  >
                    <span>{t.name}</span>
                    <button
                      onClick={() => liturgyTemplates.remove(t.id)}
                      className="text-xs text-ruby hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside>
          <h2 className="small-caps mb-2 text-sm text-muted">This evening&apos;s family worship</h2>
          <div className="rounded-[4px] border border-rule bg-surface p-5 text-sm leading-relaxed">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <span className="font-medium">Psalm.</span>{" "}
                <Link href={`/read/psalms/${eveningPsalm}`} className="text-sapphire no-underline hover:underline">
                  Psalm {eveningPsalm}
                </Link>{" "}
                — read or sung.
              </li>
              <li>
                <span className="font-medium">Scripture.</span>{" "}
                {familyReadings.length > 0 ? (
                  familyReadings.map((r, i) => (
                    <span key={i}>
                      {r.chapters.slice(0, 1).map((c) => (
                        <Link
                          key={`${c.book}-${c.chapter}`}
                          href={`/read/${c.book}/${c.chapter}`}
                          className="text-sapphire no-underline hover:underline"
                        >
                          {getBook(c.book)?.name} {c.chapter}
                        </Link>
                      ))}
                      {i < familyReadings.length - 1 ? ", " : ""}
                    </span>
                  ))
                ) : (
                  <>
                    today&apos;s portion from a{" "}
                    <Link href="/plans" className="text-sapphire no-underline hover:underline">
                      reading plan
                    </Link>{" "}
                    once one is begun.
                  </>
                )}
              </li>
              <li>
                <span className="font-medium">Catechism.</span> The next question in your
                household&apos;s course. (The historic catechism texts arrive on the shelf when a
                verified source edition is secured —{" "}
                <Link href="/sources" className="text-sapphire no-underline hover:underline">
                  see Sources
                </Link>
                .)
              </li>
              <li>
                <span className="font-medium">Prayer.</span> Confession, thanksgiving, the needs of
                the household and the church.
              </li>
            </ol>
            <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
              A plain evening order: appointed, not tracked. Nothing here is scored.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
