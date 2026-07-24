"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { useWorkspaceDispatch } from "./WorkspaceContext";

interface HymnSummary {
  id: string;
  title: string;
  author: string | null;
  meter: string;
  firstLine: string;
}

/**
 * The hymnbook in the Chapel: the Open Hymnal's public-domain corpus,
 * browsable and searchable, each row opening the hymn reader in a tab.
 */
function HymnbookSection() {
  const { dispatch } = useWorkspaceDispatch();
  const [hymns, setHymns] = useState<HymnSummary[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pane/hymns", { signal: controller.signal })
      .then(async (res) => (res.ok ? ((await res.json()) as { hymns: HymnSummary[] }) : null))
      .then((data) => setHymns(data?.hymns ?? []))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setHymns([]);
      });
    return () => controller.abort();
  }, []);

  if (hymns === null) return null;
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? hymns.filter(
        (h) =>
          h.title.toLowerCase().includes(needle) ||
          h.firstLine.toLowerCase().includes(needle) ||
          (h.author ?? "").toLowerCase().includes(needle)
      )
    : hymns;
  return (
    <div className="mt-8">
      <h3 className="small-caps mb-2 text-sm text-muted">The hymnbook</h3>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Title, first line, or author"
        aria-label="Search the hymnbook"
        className="mb-2 w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
      />
      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {shown.slice(0, 60).map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => dispatch({ type: "openHymn", hymn: h.id, title: h.title })}
              className="w-full rounded-[4px] px-2 py-1.5 text-left hover:bg-paper"
            >
              <span className="text-sm text-ink">{h.title}</span>
              <span className="ml-2 text-xs text-muted">{[h.author, h.meter].filter(Boolean).join(" · ")}</span>
            </button>
          </li>
        ))}
        {shown.length > 60 ? (
          <li className="px-2 py-1 text-xs text-muted">The first 60 of {shown.length} answers.</li>
        ) : null}
      </ul>
    </div>
  );
}

/** Opens the passage in the workspace, the way every pane asks. */
function openRef(book: string, chapter: number) {
  window.dispatchEvent(new CustomEvent("berean:open-ref", { detail: { book, chapter } }));
}

/**
 * The Chapel pane: the orders of worship and the settled forms, moved from
 * the retired /chapel page. A service is composed from a template or the
 * historic starting order and opens in its own service tab; the evening
 * family order reads the first plan's portion for the day, and its passages
 * dispatch berean:open-ref, carrying the pane in focus to the text.
 */
export default function ChapelPane() {
  const { dispatch } = useWorkspaceDispatch();
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
    const service = liturgies.create({
      title: title.trim() || (date ? `Lord's Day, ${date}` : "Order of Worship"),
      date: date || undefined,
      elements,
    });
    setTitle("");
    setDate("");
    dispatch({ type: "openService", serviceId: service.id, title: service.title });
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
    <div className="mx-auto max-w-4xl">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">The Chapel</p>
        <h2 className="mt-0.5 font-editorial text-lg font-semibold">
          The service of the Lord&apos;s Day
        </h2>
        <p className="no-print mt-0.5 text-[0.68rem] text-muted">
          Built from the full historic vocabulary: call to worship, confession, assurance, the
          reading of the Law, psalms and hymns, the sermon, the Table, the benediction · a
          congregation&apos;s settled form becomes its template, and each week is composed from it
          rather than from a blank page
        </p>
      </header>

      <form
        onSubmit={add}
        className="no-print mt-6 mb-8 grid gap-3 rounded-[4px] border border-rule bg-surface p-5 sm:grid-cols-[1fr_auto_auto_auto]"
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
          <h3 className="small-caps mb-2 text-sm text-muted">Orders of worship</h3>
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
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: "openService", serviceId: l.id, title: l.title })
                      }
                      title={`Open ${l.title} in the composer`}
                      className="font-editorial text-left text-lg font-bold text-ink hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      {l.title}
                    </button>
                    <p className="small-caps text-xs text-muted">
                      {l.date ?? "undated"} · {l.elements.length} elements
                    </p>
                  </div>
                  <button
                    onClick={() => liturgies.remove(l.id)}
                    className="no-print rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          {templates.length > 0 && (
            <div className="mt-8">
              <h3 className="small-caps mb-2 text-sm text-muted">Your settled forms</h3>
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
          <h3 className="small-caps mb-2 text-sm text-muted">This evening&apos;s family worship</h3>
          <div className="rounded-[4px] border border-rule bg-surface p-5 text-sm leading-relaxed">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <span className="font-medium">Psalm.</span>{" "}
                <button
                  type="button"
                  onClick={() => openRef("psalms", eveningPsalm)}
                  title={`Open Psalm ${eveningPsalm} in the workspace`}
                  className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  Psalm {eveningPsalm}
                </button>{" "}
                — read or sung.
              </li>
              <li>
                <span className="font-medium">Scripture.</span>{" "}
                {familyReadings.length > 0 ? (
                  familyReadings.map((r, i) => (
                    <span key={i}>
                      {r.chapters.slice(0, 1).map((c) => (
                        <button
                          key={`${c.book}-${c.chapter}`}
                          type="button"
                          onClick={() => openRef(c.book, c.chapter)}
                          title={`Open ${getBook(c.book)?.name} ${c.chapter} in the workspace`}
                          className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                        >
                          {getBook(c.book)?.name} {c.chapter}
                        </button>
                      ))}
                      {i < familyReadings.length - 1 ? ", " : ""}
                    </span>
                  ))
                ) : (
                  <>
                    today&apos;s portion from a{" "}
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "openPlans" })}
                      className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      reading plan
                    </button>{" "}
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
                the household and the church, carried name by name on your{" "}
                <button
                  type="button"
                  onClick={() => dispatch({ type: "openPrayers" })}
                  className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  prayer lists
                </button>
                .
              </li>
            </ol>
            <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
              A plain evening order: appointed, not tracked. Nothing here is scored.
            </p>
          </div>
          <HymnbookSection />
        </aside>
      </div>
    </div>
  );
}
