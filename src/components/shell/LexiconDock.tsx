"use client";

import { useEffect, useState } from "react";
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
 * omnibox or anywhere else that dispatches berean:open-lexicon. Strong's
 * definitions render with the Tyndale House extended variants beneath.
 */
export default function LexiconDock() {
  const { state } = useWorkspace();
  const id = state.lexiconId;
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

  if (!id || load.status === "idle") {
    return (
      <p className="text-xs text-muted">
        Ask for a Strong's number (G25, H7225) in the omnibox and the entry answers here.
      </p>
    );
  }
  if (load.status === "loading") {
    return <p className="text-xs text-muted">Opening the lexicon…</p>;
  }
  if (load.status === "missing") {
    return <p className="text-xs text-muted">No lexicon entry found for {id}.</p>;
  }

  const e = load.entry;
  const langClass = e.id.startsWith("H") ? "lang-hebrew" : "lang-greek";
  return (
    <div className="space-y-4">
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
