"use client";

import { useEffect, useState } from "react";
import { getBook } from "@/lib/canon";
import { useWorkspace } from "./WorkspaceContext";

interface TyndaleVariant {
  id: string;
  u: string;
  lemma: string;
  xlit: string;
  pos: string;
  gloss: string;
  def: string;
  rel?: string;
}

interface LexiconPayload {
  id: string;
  lemma?: string;
  xlit?: string;
  pron?: string;
  derivation?: string;
  strongs_def?: string;
  kjv_def?: string;
  tyndale?: TyndaleVariant[];
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; entry: LexiconPayload };

/**
 * The dock's lexicon: answers the Strong's number last asked for, from the
 * omnibox or anywhere else that dispatches berean:open-lexicon. A word
 * selection in the reader opens the entry directly and pins the word's
 * parsing above it. Strong's definitions render with the Tyndale House
 * extended variants beneath.
 */
export default function LexiconDock() {
  const { state, dispatch } = useWorkspace();
  const id = state.lexiconId;
  const word = state.selection?.kind === "word" ? state.selection : null;
  const [load, setLoad] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!id) {
      setLoad({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/lexicon/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setLoad({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", entry: (await res.json()) as LexiconPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [id]);

  // The selected word's parsing, pinned above the entry it opened.
  const wordCard = word ? (
    <div className="rounded-[4px] border border-rule bg-paper p-3">
      <p className="flex items-baseline gap-2">
        <span
          className={
            word.lemma ? (word.strongs[0]?.startsWith("H") ? "lang-hebrew" : "lang-greek") : ""
          }
        >
          {word.text}
        </span>
        {word.xlit && <span className="text-xs text-muted">{word.xlit}</span>}
        <span className="ml-auto text-xs text-muted">
          {getBook(word.book)?.name ?? word.book} {word.chapter}:{word.verse}
        </span>
      </p>
      {word.lemma && (
        <p className="mt-1 text-xs text-muted">
          <span className="font-semibold">Lemma:</span> {word.lemma}
        </p>
      )}
      {word.morph && (
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-semibold">Parsing:</span> {word.morph}
        </p>
      )}
      {word.gloss && (
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-semibold">In context:</span> {word.gloss}
        </p>
      )}
      {word.strongs.length > 1 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.68rem] text-muted">
          Also tagged:
          {word.strongs.slice(1).map((s) => (
            <button
              key={s}
              type="button"
              title={`Open ${s} in the lexicon`}
              onClick={() => dispatch({ type: "openLexicon", id: s.toUpperCase() })}
              className="border border-rule bg-surface px-1 py-0.5 text-sapphire hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {s}
            </button>
          ))}
        </p>
      )}
    </div>
  ) : null;

  if (!id || load.status === "idle") {
    return (
      <div className="space-y-4">
        {wordCard}
        <p className="text-xs text-muted">
          Ask for a Strong's number (G25, H7225) in the omnibox and the entry answers here.
        </p>
      </div>
    );
  }
  if (load.status === "loading") {
    return (
      <div className="space-y-4">
        {wordCard}
        <p className="text-xs text-muted">Opening the lexicon…</p>
      </div>
    );
  }
  if (load.status === "missing") {
    return (
      <div className="space-y-4">
        {wordCard}
        <p className="text-xs text-muted">No lexicon entry found for {id}.</p>
      </div>
    );
  }

  const e = load.entry;
  const langClass = e.id.startsWith("H") ? "lang-hebrew" : "lang-greek";
  return (
    <div className="space-y-4">
      {wordCard}
      <div className="rounded-[4px] border border-rule bg-paper p-3">
        <p className="flex items-baseline gap-2">
          <span className={`${langClass} text-lg`}>{e.lemma}</span>
          {e.xlit && <span className="text-xs text-muted">{e.xlit}</span>}
          <span className="ml-auto text-xs font-semibold text-sapphire">{e.id}</span>
        </p>
        {e.pron && <p className="mt-0.5 text-xs italic text-muted">{e.pron}</p>}
        {e.derivation && (
          <p className="mt-1 text-xs text-muted">
            <span className="font-semibold">Derivation:</span> {e.derivation}
          </p>
        )}
        {e.strongs_def && <p className="mt-2 text-[0.84rem] leading-relaxed">{e.strongs_def}</p>}
        {e.kjv_def && (
          <p className="mt-1.5 text-xs text-muted">
            <span className="font-semibold">KJV renders:</span> {e.kjv_def}
          </p>
        )}
      </div>
      {e.tyndale && e.tyndale.length > 0 && (
        <section>
          <p className="small-caps mb-2 text-xs font-semibold text-muted">Tyndale House variants</p>
          <div className="space-y-3">
            {e.tyndale.map((v) => (
              <div key={v.id} className="rounded-[4px] border border-rule bg-paper p-3">
                <p className="flex items-baseline gap-2">
                  <span className={langClass}>{v.lemma}</span>
                  <span className="text-xs italic text-muted">{v.xlit}</span>
                  <span className="ml-auto text-[0.68rem] text-muted">{v.id}</span>
                </p>
                <p className="mt-1 text-[0.84rem]">
                  <span className="font-semibold">Gloss:</span> {v.gloss}
                </p>
                {v.def && <p className="mt-0.5 text-xs leading-relaxed text-muted">{v.def}</p>}
                <p className="mt-1 text-[0.68rem] text-muted">
                  {v.pos}
                  {v.rel ? ` · ${v.rel}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Strong's dictionary (public domain). Tyndale variants: data created by
        www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0).
      </p>
    </div>
  );
}
