"use client";

import { useEffect, useMemo, useState } from "react";
import type { PsalmExplorerEntry, PsalmGenre, ProverbSectionEntry } from "@/lib/wisdommeta";
import { playSound } from "@/lib/sound";
import { useWorkspaceDispatch } from "./WorkspaceContext";

type View = "number" | "genre" | "author" | "length";

const VIEWS: { id: View; label: string }[] = [
  { id: "number", label: "Number" },
  { id: "genre", label: "Genre" },
  { id: "author", label: "Author" },
  { id: "length", label: "Length" },
];

/* The genre palette, the canon explorer's discipline: the house colors and
 * their pair mixes give the six forms six readable hues that follow the
 * theme. */
const GENRE_COLORS: Record<PsalmGenre, string> = {
  lament: "var(--stained-sapphire)",
  praise: "var(--stained-amber)",
  royal: "var(--stained-ruby)",
  wisdom: "var(--stained-emerald)",
  pilgrimage: "color-mix(in srgb, var(--stained-emerald) 50%, var(--stained-sapphire))",
  imprecatory: "color-mix(in srgb, var(--stained-ruby) 55%, var(--stained-sapphire))",
};

interface PsalmsPayload {
  genres: { id: PsalmGenre; label: string }[];
  books: { label: string; from: number; to: number }[];
  psalms: PsalmExplorerEntry[];
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "psalms"; payload: PsalmsPayload }
  | { status: "proverbs"; sections: ProverbSectionEntry[] };

/**
 * The Psalms and Proverbs explorers. The Psalter reads as a genre-colored
 * map of all 150 psalms arranged four ways: Number groups by the five books
 * of the Psalter, Genre and Author group by the superscription metadata,
 * Length ranks by word count. A psalm opens in the reader. Proverbs reads
 * as its seven named collections in the book's own order, a structural map
 * rather than a statistical one, each section opening in the reader. The
 * book swap moves in place on the tab, so the strip's label stays honest.
 */
export default function WisdomExplorerPane({
  paneId,
  tabId,
  book,
}: {
  paneId: string;
  tabId: string;
  book: "psalms" | "proverbs";
}) {
  const { dispatch } = useWorkspaceDispatch();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [view, setView] = useState<View>("number");

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/wisdom?book=${book}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setLoad({ status: "missing" });
          return;
        }
        if (book === "psalms") {
          setLoad({ status: "psalms", payload: (await res.json()) as PsalmsPayload });
        } else {
          const payload = (await res.json()) as { sections: ProverbSectionEntry[] };
          setLoad({ status: "proverbs", sections: payload.sections });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [book]);

  const groups = useMemo((): { label: string; psalms: PsalmExplorerEntry[] }[] => {
    if (load.status !== "psalms") return [];
    const { psalms, genres, books } = load.payload;
    if (view === "number") {
      return books.map((b) => ({
        label: `${b.label} · Psalms ${b.from}–${b.to}`,
        psalms: psalms.filter((p) => p.psalm >= b.from && p.psalm <= b.to),
      }));
    }
    if (view === "genre") {
      return genres
        .map((g) => ({ label: g.label, psalms: psalms.filter((p) => p.genre === g.id) }))
        .filter((g) => g.psalms.length > 0);
    }
    if (view === "author") {
      /* Groups in the order the Psalter first earns each author. */
      const byAuthor = new Map<string, PsalmExplorerEntry[]>();
      for (const p of psalms) {
        const rows = byAuthor.get(p.author) ?? [];
        rows.push(p);
        byAuthor.set(p.author, rows);
      }
      return [...byAuthor.entries()].map(([label, rows]) => ({ label, psalms: rows }));
    }
    return [{ label: "", psalms: [...psalms].sort((a, b) => b.words - a.words) }];
  }, [load, view]);

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Wisdom</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">
          {book === "psalms" ? "The Psalms" : "Proverbs"}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="seg" role="group" aria-label="Book">
            <button
              type="button"
              aria-pressed={book === "psalms"}
              onClick={() => {
                dispatch({ type: "setWisdomBook", paneId, tabId, book: "psalms" });
                playSound("navigate");
              }}
            >
              Psalms
            </button>
            <button
              type="button"
              aria-pressed={book === "proverbs"}
              onClick={() => {
                dispatch({ type: "setWisdomBook", paneId, tabId, book: "proverbs" });
                playSound("navigate");
              }}
            >
              Proverbs
            </button>
          </span>
          {load.status === "psalms" && (
            <span className="seg ml-2" role="group" aria-label="Arrange the psalms">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={view === v.id}
                  onClick={() => {
                    setView(v.id);
                    playSound("navigate");
                  }}
                >
                  {v.label}
                </button>
              ))}
            </span>
          )}
        </p>
        {load.status === "psalms" && (
          <>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {load.payload.genres.map((g) => (
                <span key={g.id} className="flex items-center gap-1 text-[0.62rem] text-muted">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2"
                    style={{ background: GENRE_COLORS[g.id] }}
                  />
                  {g.label}
                </span>
              ))}
            </p>
            <p className="mt-1 text-[0.68rem] text-muted">
              Genres name the dominant form where a psalm mixes them · authors follow the
              superscriptions · counts from the KJV text
            </p>
          </>
        )}
      </header>

      {load.status === "loading" && <p className="text-xs text-muted">Laying out the map…</p>}
      {load.status === "missing" && (
        <p className="text-xs text-muted">
          The wisdom explorer is not furnished in this build; it ships with the KJV text and the
          book metadata.
        </p>
      )}

      {load.status === "psalms" &&
        groups.map((group) => (
          <section key={group.label || "all"}>
            {group.label && (
              <div className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
                {group.label} · {group.psalms.length} {group.psalms.length === 1 ? "psalm" : "psalms"}
              </div>
            )}
            <div className="fx-stagger grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
              {group.psalms.map((p, i) => (
                <button
                  key={p.psalm}
                  type="button"
                  onClick={() => {
                    dispatch({ type: "openRef", book: "psalms", chapter: p.psalm });
                  }}
                  style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  title={`Psalm ${p.psalm}: ${load.payload.genres.find((g) => g.id === p.genre)?.label ?? p.genre} · ${p.author} · ${p.verses} vv · ${p.words} words`}
                  className="glass glass-hover fx-bloom text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  <span
                    aria-hidden="true"
                    className="block h-[3px]"
                    style={{ background: GENRE_COLORS[p.genre] }}
                  />
                  <span className="block px-2 py-1.5">
                    <span className="block text-[0.8rem] font-semibold text-ink">
                      Psalm {p.psalm}
                    </span>
                    <span className="mt-0.5 block text-[0.62rem] text-muted">
                      {view === "length"
                        ? `${p.words.toLocaleString()} words · ${p.verses} vv`
                        : `${load.payload.genres.find((g) => g.id === p.genre)?.label ?? p.genre} · ${p.author}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

      {load.status === "proverbs" && (
        <div className="space-y-2">
          <p className="text-[0.68rem] text-muted">
            The seven collections, bounded by the book's own superscriptions · counts from the
            KJV text
          </p>
          <ul className="glass fx-stagger divide-y divide-rule/50">
            {load.sections.map((s, i) => (
              <li key={s.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "openRef", book: "proverbs", chapter: s.fromChapter });
                  }}
                  className="flex w-full items-baseline gap-3 px-3 py-2 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.84rem] font-semibold text-ink">{s.title}</span>
                    <span className="mt-0.5 block text-[0.68rem] leading-relaxed text-muted">
                      {s.about}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[0.68rem] text-muted">
                    <span className="block text-sapphire">{s.ref}</span>
                    <span className="mt-0.5 block">
                      {s.verses} vv · {s.words.toLocaleString()} words
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
