"use client";

import { useEffect, useState, type FormEvent } from "react";
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

/** One row of a whole-dictionary search, from GET /api/lexicon. */
interface SearchHit {
  id: string;
  lemma?: string;
  xlit?: string;
  kjv_def?: string;
}

/**
 * The lexicon body: answers the Strong's number last asked for, from the
 * omnibox or anywhere else that dispatches berean:open-lexicon. A word
 * selection in the reader opens the entry directly and pins the word's
 * parsing above it. Strong's definitions render with the Tyndale House
 * extended variants beneath. The search box queries the whole dictionary
 * (ids, lemmas, transliterations, definitions) and a hit opens in place:
 * the dock answers with its own entry, a pane tab pins the hit as the
 * tab's entry through onOpenEntry. The dock renders it bare; a lexicon
 * pane tab passes entryId to pin the tab's own entry.
 */
export default function LexiconDock({
  entryId,
  onOpenEntry,
}: {
  entryId?: string | null;
  onOpenEntry?: (id: string) => void;
} = {}) {
  const { state, dispatch } = useWorkspace();
  // A pane tab pins its own entry; the dock answers the workspace's ask.
  const id = entryId === undefined ? state.lexiconId : entryId;
  const word = state.selection?.kind === "word" ? state.selection : null;
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);

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
      {word.strongs[0] && (
        <p className="mt-1.5">
          <button
            type="button"
            onClick={() => {
              // Extended ids (H7225G) reduce to the base entry the study knows.
              const base = word.strongs[0].toUpperCase().match(/^[GH]\d+/)?.[0];
              if (base) dispatch({ type: "openWordStudy", strongsId: base });
            }}
            className="text-[0.68rem] font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Open word study
          </button>
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

  // The whole-dictionary search, the retired /lexicon index's query against
  // /api/lexicon. A hit opens in place: the tab's own entry when the pane
  // passes onOpenEntry, the workspace's lexicon ask otherwise.
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    fetch(`/api/lexicon?q=${encodeURIComponent(q)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { available: boolean; results: SearchHit[] };
        setHits(data.results);
      })
      .catch(() => setHits([]))
      .finally(() => setSearching(false));
  };

  const openHit = (hitId: string) => {
    if (onOpenEntry) onOpenEntry(hitId);
    else dispatch({ type: "openLexicon", id: hitId });
  };

  const searchBlock = (
    <div className="space-y-2">
      <form onSubmit={submitSearch} className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the dictionaries"
          aria-label="Search the dictionaries"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
        />
        <button
          type="submit"
          disabled={searching}
          className="border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Search
        </button>
      </form>
      {hits !== null && hits.length === 0 && !searching && (
        <p className="text-xs text-muted">Nothing in the dictionaries matches.</p>
      )}
      {hits !== null && hits.length > 0 && (
        <ul className="space-y-1.5">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => openHit(h.id)}
                className="w-full rounded-[4px] border border-rule bg-paper p-2 text-left hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                <span className="flex items-baseline gap-2">
                  <span className="small-caps text-[0.62rem] text-muted">{h.id}</span>
                  <span className={h.id.startsWith("H") ? "lang-hebrew" : "lang-greek"}>
                    {h.lemma}
                  </span>
                  {h.xlit && <span className="text-[0.68rem] italic text-muted">{h.xlit}</span>}
                </span>
                {h.kjv_def && (
                  <span className="mt-0.5 block text-[0.68rem] text-muted">KJV: {h.kjv_def}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!id || load.status === "idle") {
    return (
      <div className="space-y-4">
        {searchBlock}
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
        {searchBlock}
        {wordCard}
        <p className="text-xs text-muted">Opening the lexicon…</p>
      </div>
    );
  }
  if (load.status === "missing") {
    return (
      <div className="space-y-4">
        {searchBlock}
        {wordCard}
        <p className="text-xs text-muted">No lexicon entry found for {id}.</p>
      </div>
    );
  }

  const e = load.entry;
  const langClass = e.id.startsWith("H") ? "lang-hebrew" : "lang-greek";
  return (
    <div className="space-y-4">
      {searchBlock}
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
