"use client";

import { useMemo, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import { useCollection } from "@/lib/hooks";
import {
  countFacet,
  isAnchored,
  noteDay,
  noteMatches,
  notes as marginNotes,
  type MarginNote,
  type NoteFacets,
} from "@/lib/marginalia";
import { playSound } from "@/lib/sound";
import { useWorkspace } from "./WorkspaceContext";

const NO_FACETS: NoteFacets = { notebook: null, book: null, anchor: null, date: null, scope: null };

/**
 * The Notes browser: every note in one list with a faceted sidebar, the
 * facets following what a note genuinely carries (notebook, Bible book,
 * anchor, day, and the passage scope). Facets combine with AND, and each
 * value's count answers against the rest of the filter, so a value that
 * would empty the list shows its zero instead of vanishing. Notes are plain
 * prose; rich text and images do not ship. An anchored row opens its passage
 * and raises the note's strip; a journal row opens the journal.
 */
export default function NotesPane() {
  const { dispatch, activeRef } = useWorkspace();
  const all = useCollection(marginNotes);
  const [facets, setFacets] = useState<NoteFacets>(NO_FACETS);

  /* Each group's counts answer against the rest of the filter. */
  const counts = useMemo(
    () => ({
      notebook: countFacet(all, facets, "notebook", (n) => n.notebook ?? ""),
      book: countFacet(all, facets, "book", (n) => (isAnchored(n) ? n.book : null)),
      anchor: countFacet(all, facets, "anchor", (n) => (isAnchored(n) ? "passage" : "journal")),
      date: countFacet(all, facets, "date", noteDay),
    }),
    [all, facets]
  );

  const shown = useMemo(
    () =>
      all
        .filter((n) => noteMatches(n, facets))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [all, facets]
  );

  const active =
    facets.notebook !== null ||
    facets.book !== null ||
    facets.anchor !== null ||
    facets.date !== null ||
    Boolean(facets.scope);

  const set = (patch: Partial<NoteFacets>) => setFacets((f) => ({ ...f, ...patch }));

  /* A note opens its target: the anchored kind carries the workspace to its
   * verse so the context strip rises with the note, a journal entry opens
   * the journal, the Docs Search pane's rides. */
  const open = (n: MarginNote) => {
    if (isAnchored(n)) {
      dispatch({ type: "openRef", book: n.book, chapter: n.chapter });
      dispatch({ type: "selectVerse", book: n.book, chapter: n.chapter, verse: n.verse });
    } else {
      dispatch({ type: "openJournal" });
    }
  };

  /* Facet values in display order: unfiled leads the notebooks, the canon
   * orders the books, the newest day leads the days. A value with no count
   * under the current filter stays out unless it is the selected one. */
  const notebooks = [...counts.notebook.keys()].sort((a, b) =>
    a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)
  );
  const books = CANON.map((b) => b.slug).filter((slug) => counts.book.has(slug));
  const days = [...counts.date.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-44 shrink-0 overflow-y-auto border-r border-rule py-2">
        {activeRef && (
          <FacetGroup label="Scope">
            <FacetRow
              label={`This passage (${getBook(activeRef.book)?.name ?? activeRef.book} ${activeRef.chapter})`}
              count={
                all.filter((n) =>
                  noteMatches(n, { ...facets, scope: activeRef })
                ).length
              }
              active={Boolean(facets.scope)}
              onToggle={() => set({ scope: facets.scope ? null : activeRef })}
            />
          </FacetGroup>
        )}
        <FacetGroup label="Anchor">
          <FacetRow
            label="On a passage"
            count={counts.anchor.get("passage") ?? 0}
            active={facets.anchor === "passage"}
            onToggle={() => set({ anchor: facets.anchor === "passage" ? null : "passage" })}
          />
          <FacetRow
            label="In the journal"
            count={counts.anchor.get("journal") ?? 0}
            active={facets.anchor === "journal"}
            onToggle={() => set({ anchor: facets.anchor === "journal" ? null : "journal" })}
          />
        </FacetGroup>
        {notebooks.length > 0 && (
          <FacetGroup label="Notebook">
            {notebooks.map((name) => (
              <FacetRow
                key={name || "unfiled"}
                label={name === "" ? "Unfiled" : name}
                count={counts.notebook.get(name) ?? 0}
                active={facets.notebook === name}
                onToggle={() => set({ notebook: facets.notebook === name ? null : name })}
              />
            ))}
          </FacetGroup>
        )}
        {books.length > 0 && (
          <FacetGroup label="Bible book">
            {books.map((slug) => (
              <FacetRow
                key={slug}
                label={getBook(slug)?.name ?? slug}
                count={counts.book.get(slug) ?? 0}
                active={facets.book === slug}
                onToggle={() => set({ book: facets.book === slug ? null : slug })}
              />
            ))}
          </FacetGroup>
        )}
        {days.length > 0 && (
          <FacetGroup label="Day">
            {days.map((day) => (
              <FacetRow
                key={day}
                label={new Date(`${day}T00:00:00`).toLocaleDateString()}
                count={counts.date.get(day) ?? 0}
                active={facets.date === day}
                onToggle={() => set({ date: facets.date === day ? null : day })}
              />
            ))}
          </FacetGroup>
        )}
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex items-baseline justify-between gap-2 border-b border-rule px-4 py-2">
          <p className="text-xs text-muted">
            {shown.length} of {all.length} {all.length === 1 ? "note" : "notes"}
            {active ? " answer the filter" : ""}
          </p>
          {active && (
            <button
              type="button"
              onClick={() => {
                setFacets(NO_FACETS);
                playSound("close");
              }}
              className="text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Clear the filter
            </button>
          )}
        </header>
        {all.length === 0 ? (
          <p className="mx-auto max-w-prose px-6 py-8 text-center text-xs text-muted">
            No notes yet. Select a verse and write in the margin, or open the journal and write
            against the day; both gather here.
          </p>
        ) : shown.length === 0 ? (
          <p className="mx-auto max-w-prose px-6 py-8 text-center text-xs text-muted">
            No note answers this filter.
          </p>
        ) : (
          <ul className="fx-stagger mx-auto max-w-prose px-6 py-2">
            {shown.map((n, i) => (
              <li
                key={n.id}
                className="border-b border-rule/60"
                style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => open(n)}
                  title={
                    isAnchored(n)
                      ? `Open ${getBook(n.book)?.name ?? n.book} ${n.chapter}:${n.verse}`
                      : "Open this entry in the journal"
                  }
                  className="block w-full py-3 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  <span className="small-caps text-sm font-medium text-sapphire">
                    {isAnchored(n)
                      ? `${getBook(n.book)?.name ?? n.book} ${n.chapter}:${n.verse}`
                      : "Journal"}
                    <span className="ml-2 text-[0.62rem] font-normal text-muted">
                      {new Date(`${noteDay(n)}T00:00:00`).toLocaleDateString()}
                      {n.notebook ? ` · ${n.notebook}` : ""}
                    </span>
                  </span>
                  <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                    {n.text.length > 240 ? `${n.text.slice(0, 240).trimEnd()}…` : n.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A facet group in the sidebar: the small-caps heading over its values. */
function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-2">
      <p className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">{label}</p>
      {children}
    </div>
  );
}

/** One facet value: the name filters on click, the count answers against the rest of the filter. */
function FacetRow({
  label,
  count,
  active,
  onToggle,
}: {
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-baseline gap-2 px-3 py-[3px] hover:bg-paper">
      <button
        type="button"
        aria-pressed={active}
        onClick={() => {
          playSound(active ? "toggle-off" : "toggle-on");
          onToggle();
        }}
        className={`min-w-0 flex-1 truncate text-left text-[0.8rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
          active ? "font-semibold text-sapphire" : "text-ink"
        }`}
      >
        {label}
      </button>
      <span className="shrink-0 text-[0.62rem] text-muted">{count}</span>
    </div>
  );
}
