"use client";

import { useEffect, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import {
  ELEMENT_TYPES,
  ElementType,
  Liturgy,
  LiturgyElement,
  elementLabel,
  liturgies,
  liturgyTemplates,
  newElement,
} from "@/lib/liturgy";
import { listProjects } from "@/lib/projects";
import { useWorkspace } from "./WorkspaceContext";

interface FetchedPassage {
  bookName: string;
  chapter: number;
  verses: { verse: number; text: string }[];
}

/**
 * An order of service open in the composer, moved from the retired
 * /chapel/[id] page: the elements reorder and edit in place, the Scribe's
 * draft comes through its citation-verified route with every selection
 * explained, a settled form saves back to the templates, and the whole
 * order prints clean. Verse text for referenced elements fetches through
 * /api/passage, the same route the desk's insertion uses. A record id that
 * answers to nothing renders the gone notice, the way a missing project
 * does.
 */
export default function ServicePane({ serviceId }: { serviceId: string }) {
  const { dispatch } = useWorkspace();
  const [liturgy, setLiturgy] = useState<Liturgy | null | undefined>(undefined);
  const [passages, setPassages] = useState<Record<string, FetchedPassage>>({});
  const [addType, setAddType] = useState<ElementType>("psalm");
  const [scribeState, setScribeState] = useState<"idle" | "working" | "error">("idle");
  const [scribeError, setScribeError] = useState("");

  useEffect(() => {
    const load = () => setLiturgy(liturgies.get(serviceId) ?? null);
    load();
    return liturgies.subscribe(load);
  }, [serviceId]);

  // Fetch verse text for every element with a reference (for on-page + print display).
  useEffect(() => {
    if (!liturgy) return;
    for (const el of liturgy.elements) {
      if (!el.ref) continue;
      const key = `${el.ref.book}/${el.ref.chapter}/${el.ref.from ?? ""}/${el.ref.to ?? ""}`;
      if (passages[key]) continue;
      const q = new URLSearchParams({ book: el.ref.book, chapter: String(el.ref.chapter) });
      if (el.ref.from) q.set("from", String(el.ref.from));
      if (el.ref.to) q.set("to", String(el.ref.to));
      fetch(`/api/passage?${q}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setPassages((p) => ({ ...p, [key]: data }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liturgy]);

  if (liturgy === undefined) return null;
  if (liturgy === null) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-muted">
          Service not found on this device.{" "}
          <button
            type="button"
            onClick={() => dispatch({ type: "openChapel" })}
            className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Back to the Chapel
          </button>
        </p>
      </div>
    );
  }

  const setElements = (elements: LiturgyElement[]) => liturgies.update(serviceId, { elements });

  function patchElement(elId: string, patch: Partial<LiturgyElement>) {
    if (!liturgy) return;
    setElements(liturgy.elements.map((el) => (el.id === elId ? { ...el, ...patch } : el)));
  }

  function move(elId: string, dir: -1 | 1) {
    if (!liturgy) return;
    const els = [...liturgy.elements];
    const i = els.findIndex((el) => el.id === elId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= els.length) return;
    [els[i], els[j]] = [els[j], els[i]];
    setElements(els);
  }

  function saveAsTemplate() {
    if (!liturgy) return;
    const name = window.prompt("Name for this settled form:", liturgy.title);
    if (!name) return;
    liturgyTemplates.create({ name, elements: liturgy.elements });
  }

  async function askScribe() {
    if (!liturgy) return;
    const sermonEl = liturgy.elements.find((el) => el.type === "sermon" && el.ref);
    const sermon = sermonEl?.ref ?? listProjects("sermon").find((p) => p.status === "preparing");
    const book = sermonEl?.ref?.book ?? (sermon && "book" in sermon ? sermon.book : undefined);
    const chapter = sermonEl?.ref?.chapter ?? (sermon && "chapter" in sermon ? sermon.chapter : undefined);
    if (!book || !chapter) {
      setScribeState("error");
      setScribeError(
        "Give the sermon element its text first (or appoint a sermon at the Pulpit) so the Scribe knows the passage the service answers."
      );
      return;
    }
    setScribeState("working");
    setScribeError("");
    try {
      const res = await fetch("/api/liturgy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book, chapter }),
      });
      const data = (await res.json()) as {
        elements?: (LiturgyElement & { rationale?: string })[];
        error?: string;
      };
      if (!res.ok || !data.elements) throw new Error(data.error ?? `Request failed (${res.status})`);
      const rationale: Record<string, string> = {};
      const elements = data.elements.map((el) => {
        const withId = { ...el, id: crypto.randomUUID() };
        if (el.rationale) rationale[withId.id] = el.rationale;
        delete (withId as { rationale?: string }).rationale;
        return withId;
      });
      liturgies.update(serviceId, { elements, rationale });
      setScribeState("idle");
    } catch (err) {
      setScribeState("error");
      setScribeError(err instanceof Error ? err.message : "The draft could not be prepared.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <input
            value={liturgy.title}
            onChange={(e) => liturgies.update(serviceId, { title: e.target.value })}
            aria-label="Service title"
            className="w-full rounded-[4px] border border-transparent bg-transparent font-editorial text-3xl font-bold focus:border-rule focus:bg-surface focus:outline-none"
          />
          <input
            type="date"
            value={liturgy.date ?? ""}
            onChange={(e) => liturgies.update(serviceId, { date: e.target.value || undefined })}
            aria-label="Service date"
            className="mt-1 rounded-[4px] border border-rule bg-surface px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={askScribe}
            disabled={scribeState === "working"}
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {scribeState === "working" ? "The Scribe is at work…" : "Ask the Scribe for a draft"}
          </button>
          <button
            onClick={saveAsTemplate}
            className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Save as settled form
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Print
          </button>
        </div>
      </div>

      {scribeState === "error" && (
        <p className="mb-6 rounded-[4px] border border-ruby/40 bg-surface p-3 text-sm text-ruby no-print">
          {scribeError}
        </p>
      )}

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="font-editorial text-center text-2xl font-bold">{liturgy.title}</h1>
        {liturgy.date && <p className="small-caps text-center text-sm">{liturgy.date}</p>}
        <hr className="my-4" />
      </div>

      <ol className="space-y-4">
        {liturgy.elements.map((el, idx) => {
          const key = el.ref
            ? `${el.ref.book}/${el.ref.chapter}/${el.ref.from ?? ""}/${el.ref.to ?? ""}`
            : "";
          const passage = key ? passages[key] : undefined;
          const refBook = el.ref ? getBook(el.ref.book) : undefined;
          const typeInfo = ELEMENT_TYPES.find((t) => t.key === el.type);
          return (
            <li key={el.id} className="rounded-[4px] border border-rule bg-surface p-4 print:border-0 print:p-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="small-caps text-sm font-medium text-ink">
                  {idx + 1}. {elementLabel(el.type)}
                  {el.title ? ` — ${el.title}` : ""}
                  {el.ref && refBook && (
                    <span className="text-sapphire">
                      {" "}
                      · {refBook.name} {el.ref.chapter}
                      {el.ref.from ? `:${el.ref.from}` : ""}
                      {el.ref.to && el.ref.to !== el.ref.from ? `–${el.ref.to}` : ""}
                    </span>
                  )}
                  {el.music ? <span className="text-muted"> · {el.music}</span> : ""}
                </p>
                <span className="flex gap-1 no-print">
                  <button onClick={() => move(el.id, -1)} aria-label="Move up" className="rounded-[4px] border border-rule px-2 py-0.5 text-xs hover:bg-paper">↑</button>
                  <button onClick={() => move(el.id, 1)} aria-label="Move down" className="rounded-[4px] border border-rule px-2 py-0.5 text-xs hover:bg-paper">↓</button>
                  <button
                    onClick={() => setElements(liturgy.elements.filter((x) => x.id !== el.id))}
                    aria-label="Remove element"
                    className="rounded-[4px] border border-rule px-2 py-0.5 text-xs text-ruby hover:bg-paper"
                  >
                    ✕
                  </button>
                </span>
              </div>

              {liturgy.rationale?.[el.id] && (
                <p className="mt-1 text-xs italic text-muted no-print">
                  The Scribe&apos;s reason: {liturgy.rationale[el.id]}
                </p>
              )}

              {passage && (
                <blockquote className="mt-2 border-l-2 border-rule pl-3 font-reader text-sm leading-relaxed">
                  {passage.verses.map((v) => (
                    <span key={v.verse}>
                      <span className="verse-num">{v.verse}</span>
                      {v.text}{" "}
                    </span>
                  ))}
                </blockquote>
              )}

              {el.text && <p className="mt-2 whitespace-pre-wrap font-reader text-sm leading-relaxed">{el.text}</p>}

              <details className="mt-2 no-print">
                <summary className="cursor-pointer text-xs text-sapphire">Edit</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    value={el.title ?? ""}
                    onChange={(e) => patchElement(el.id, { title: e.target.value || undefined })}
                    placeholder={el.type === "hymn" ? "Hymn title" : el.type === "creed" ? "Creed name" : "Title (optional)"}
                    aria-label="Element title"
                    className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
                  />
                  <input
                    value={el.music ?? ""}
                    onChange={(e) => patchElement(el.id, { music: e.target.value || undefined })}
                    placeholder="Meter · tune · key (sung elements)"
                    aria-label="Music metadata"
                    className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
                  />
                  {typeInfo?.scripture && (
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <select
                        value={el.ref?.book ?? ""}
                        onChange={(e) =>
                          patchElement(el.id, {
                            ref: e.target.value
                              ? { book: e.target.value, chapter: 1 }
                              : undefined,
                          })
                        }
                        aria-label="Book"
                        className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
                      >
                        <option value="">No passage</option>
                        {CANON.map((b) => (
                          <option key={b.slug} value={b.slug}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      {el.ref && (
                        <>
                          <select
                            value={el.ref.chapter}
                            onChange={(e) =>
                              patchElement(el.id, { ref: { ...el.ref!, chapter: Number(e.target.value), from: undefined, to: undefined } })
                            }
                            aria-label="Chapter"
                            className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
                          >
                            {Array.from({ length: getBook(el.ref.book)?.chapters ?? 1 }, (_, i) => i + 1).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={el.ref.from ?? ""}
                            onChange={(e) =>
                              patchElement(el.id, {
                                ref: { ...el.ref!, from: e.target.value ? Number(e.target.value) : undefined },
                              })
                            }
                            placeholder="from v."
                            aria-label="From verse"
                            className="w-24 rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            min={1}
                            value={el.ref.to ?? ""}
                            onChange={(e) =>
                              patchElement(el.id, {
                                ref: { ...el.ref!, to: e.target.value ? Number(e.target.value) : undefined },
                              })
                            }
                            placeholder="to v."
                            aria-label="To verse"
                            className="w-24 rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
                          />
                        </>
                      )}
                    </div>
                  )}
                  <textarea
                    value={el.text ?? ""}
                    onChange={(e) => patchElement(el.id, { text: e.target.value || undefined })}
                    rows={3}
                    placeholder="Written text — a prayer, a rubric, the minister's own words…"
                    aria-label="Element text"
                    className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 font-reader text-sm sm:col-span-2"
                  />
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-2 no-print">
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value as ElementType)}
          aria-label="Element type to add"
          className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm"
        >
          {ELEMENT_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setElements([...liturgy.elements, newElement(addType)])}
          className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
        >
          Add element
        </button>
      </div>

      <p className="mt-6 text-xs text-muted no-print">
        Hymn and psalter texts appear only from resources with a rights entry; sung elements carry
        title, meter, tune, and key as metadata. The Scribe&apos;s drafts arrive with every selection
        explained, and the minister rules on all of it.
      </p>
    </div>
  );
}
