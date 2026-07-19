"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CANON, bookIndex, getBook } from "@/lib/canon";
import { CITATION_STYLE_KEY, citationStyle, type CitationStyle } from "@/lib/citation";
import { setCandle, setTextScale, TEXT_SCALES, useDisplayPrefs } from "@/lib/display";
import { documents, listDocuments, listKindLabel, parsePassageRef } from "@/lib/documents";
import { favorites, removeFavorite, renameFolder, type Favorite } from "@/lib/favorites";
import { useCollection } from "@/lib/hooks";
import {
  deleteNote,
  deleteNotebook,
  exportNotesMarkdown,
  isAnchored,
  listNotebooks,
  notes as marginNotes,
  renameNotebook,
  type AnchoredNote,
} from "@/lib/marginalia";
import { isDue, memoryPassages } from "@/lib/memory";
import { currentDay, generatorFor, plans, readingsForDay } from "@/lib/plans";
import { dueRequests, markPrayed, prayerLists } from "@/lib/prayers";
import { toggleFavorite, useSearchSaves, type SearchEntry } from "@/lib/search-history";
import { visualFilters, type VisualFilterSet } from "@/lib/visualfilters";
import { useWorkspace } from "./WorkspaceContext";
import PrintButton from "./PrintButton";
import { DND, startModuleDrag } from "./dnd";
import { findLeaf, paneRef, PREFERRED_TRANSLATION_KEY, type RailMode } from "./workspace-state";

const MODE_TITLES: Record<RailMode, string> = {
  read: "Canon",
  study: "Study",
  search: "Search",
  library: "Library",
  documents: "Documents",
  almanac: "Almanac",
  settings: "Settings",
};

/**
 * The left sidebar: one tree or section list per rail mode. The Read tree
 * and its bookmarked passages, the Study rail's manuscripts, the Search
 * rail's pinned searches and history, the Documents list, the Almanac
 * rail's daily readings and due prayers, and the Settings rail's program
 * settings carry real data; the rest are quiet placeholders until their
 * panels land in a later phase.
 */
export default function Sidebar() {
  const { state, dispatch } = useWorkspace();

  return (
    <aside
      aria-label={MODE_TITLES[state.railMode]}
      className="flex w-[260px] shrink-0 flex-col border-r border-rule bg-surface"
    >
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-rule px-3">
        <span className="small-caps text-[0.7rem] font-semibold text-ink">
          {MODE_TITLES[state.railMode]}
        </span>
        <button
          type="button"
          title="Collapse sidebar"
          onClick={() => dispatch({ type: "toggleSidebar" })}
          className="px-1 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          «
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.railMode === "read" && (
          <>
            <CanonTree />
            <FavoritesSection />
          </>
        )}
        {state.railMode === "library" && <LibrarySections />}
        {state.railMode === "documents" && <DocumentsList />}
        {state.railMode === "study" && <StudyPanel />}
        {state.railMode === "search" && <SearchPanel />}
        {state.railMode === "almanac" && <AlmanacPanel />}
        {state.railMode === "settings" && <SettingsPanel />}
      </div>
    </aside>
  );
}

function Placeholder({ text }: { text: string }) {
  return <p className="px-3 py-4 text-xs leading-relaxed text-muted">{text}</p>;
}

/* ---------- Search: pinned searches and history ---------- */

/**
 * The Search rail: every query the workspace runs is remembered here
 * (src/lib/search-history.ts), newest first, and any of them re-runs with a
 * click. A pinned search never ages out; the pin toggles from a row's star
 * or from the search pane's own header. The documents box on top searches
 * the user's own collections instead of the canon; its queries stay out of
 * the concordance history, which re-runs everything as a Bible search.
 */
function SearchPanel() {
  const { dispatch } = useWorkspace();
  const { history, favorites } = useSearchSaves();
  /* An entry re-runs against the engine that answered it; absent mode reads
   * as the Bible concordance, the way old history entries do. */
  const rerun = (q: string, mode?: SearchEntry["mode"]) =>
    dispatch({ type: "openSearch", q, mode });
  /** The Docs Search box: prose over the user's own collections. */
  const [docQuery, setDocQuery] = useState("");

  const runDocSearch = () => {
    const q = docQuery.trim();
    if (q.length < 2) return;
    dispatch({ type: "openDocSearch", q });
    setDocQuery("");
  };

  return (
    <div className="py-1">
      <div className="px-3 pt-2 pb-1">
        <input
          type="search"
          value={docQuery}
          aria-label="Search your notes, manuscripts, lists, and prayers"
          placeholder="Search your documents…"
          onChange={(e) => setDocQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runDocSearch();
          }}
          className="w-full border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <p className="pt-1 text-[0.68rem] leading-relaxed text-muted">
          Your notes, manuscripts, lists, and prayers answer; Enter opens the
          Docs Search pane.
        </p>
      </div>
      <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
        Pinned searches
      </div>
      {favorites.length === 0 ? (
        <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
          Pin a search from its pane header and it waits here.
        </p>
      ) : (
        favorites.map((f) => (
          <div key={`${f.q}:${f.mode ?? "bible"}`} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
            <button
              type="button"
              onClick={() => rerun(f.q, f.mode)}
              title={`Search again for “${f.q}”`}
              className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {f.q}
              <ModeTag mode={f.mode} />
            </button>
            <button
              type="button"
              onClick={() => toggleFavorite(f.q, f.mode)}
              title="Unpin this search"
              className="shrink-0 px-1 text-[0.7rem] text-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              ★
            </button>
          </div>
        ))
      )}
      <div className="small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted">
        History
      </div>
      {history.length === 0 ? (
        <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
          Concordance search answers in the command palette (Ctrl+K) and opens
          as a pane; every query is remembered here.
        </p>
      ) : (
        history.map((h) => {
          const pinned = favorites.some(
            (f) =>
              f.q.toLowerCase() === h.q.toLowerCase() &&
              (f.mode ?? "bible") === (h.mode ?? "bible")
          );
          return (
            <div key={`${h.q}:${h.mode ?? "bible"}`} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
              <button
                type="button"
                onClick={() => rerun(h.q, h.mode)}
                title={`Search again for “${h.q}”`}
                className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {h.q}
                <ModeTag mode={h.mode} />
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(h.q, h.mode)}
                title={pinned ? "Unpin this search" : "Pin this search"}
                className={`shrink-0 px-1 text-[0.7rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                  pinned ? "text-amber" : "text-muted hover:text-ink"
                }`}
              >
                {pinned ? "★" : "☆"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

/** Marks a history or pinned entry that runs on a non-Bible engine. */
function ModeTag({ mode }: { mode?: SearchEntry["mode"] }) {
  if (!mode || mode === "bible") return null;
  return (
    <span className="small-caps ml-1.5 text-[0.6rem] text-muted">
      {mode === "original" ? "Original" : "Meaning"}
    </span>
  );
}

/* ---------- Almanac: today's appointed readings ---------- */

/**
 * The Almanac rail keeps the day's portion before the reader: every active
 * plan's reading for today, each chapter opening in the workspace with a
 * click, and the prayer requests that stand due, marked prayed in place.
 * The plans pane remains the home for beginning, marking, and adjusting;
 * the calendar and rule of life arrive with their panels.
 */
function AlmanacPanel() {
  const { dispatch } = useWorkspace();
  const rows = useCollection(plans);
  const prayers = useCollection(prayerLists);
  const memory = useCollection(memoryPassages);
  const active = rows
    .map((plan) => {
      const gen = generatorFor(plan);
      return gen ? { plan, gen, day: Math.min(currentDay(plan), gen.days) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const due = dueRequests(prayers);
  const dueMemory = memory.filter((p) => isDue(p));

  if (active.length === 0 && due.length === 0 && dueMemory.length === 0) {
    return (
      <p className="px-3 py-4 text-xs leading-relaxed text-muted">
        Nothing is appointed for today. Begin a plan in the{" "}
        <button
          type="button"
          onClick={() => dispatch({ type: "openPlans" })}
          className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          plans pane
        </button>{" "}
        or a list in the{" "}
        <button
          type="button"
          onClick={() => dispatch({ type: "openPrayers" })}
          className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          prayers pane
        </button>{" "}
        and the day&apos;s portion waits here.
      </p>
    );
  }

  return (
    <div className="py-1">
      {active.length > 0 && (
        <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
          Today&apos;s readings
        </div>
      )}
      {active.map(({ plan, gen, day }) => {
        const done = plan.completedDays.includes(day);
        return (
          <div key={plan.id} className="px-3 py-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[0.8rem] font-semibold text-ink">{gen.name}</span>
              <span className="shrink-0 text-[0.62rem] text-muted">
                {day}/{gen.days}
                {done ? " · read" : ""}
              </span>
            </div>
            <p className="text-[0.8rem] leading-relaxed">
              {readingsForDay(gen, day).map((r, i) => (
                <span key={i}>
                  {r.chapters.map((c, j) => (
                    <span key={`${c.book}-${c.chapter}`}>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "openRef", book: c.book, chapter: c.chapter })}
                        title={`Open ${getBook(c.book)?.name} ${c.chapter} in the workspace`}
                        className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        {getBook(c.book)?.name} {c.chapter}
                      </button>
                      {j < r.chapters.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  {i < readingsForDay(gen, day).length - 1 ? " · " : ""}
                </span>
              ))}
            </p>
          </div>
        );
      })}
      {dueMemory.length > 0 && (
        <>
          <div className="small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted">
            Memory work due
          </div>
          <ul>
            {dueMemory.map((p) => (
              <li key={p.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "openMemory", passageId: p.id })}
                  title={`Drill ${getBook(p.book)?.name} ${p.chapter}:${p.from}`}
                  className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {getBook(p.book)?.name} {p.chapter}:{p.from}
                  {p.to !== p.from ? `–${p.to}` : ""}
                </button>
                <span className="shrink-0 text-[0.62rem] text-muted">drill</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {due.length > 0 && (
        <>
          <div className="small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted">
            Prayers appointed today
          </div>
          <ul>
            {due.map(({ list, request }) => {
              const parsed = request.passage ? parsePassageRef(request.passage) : undefined;
              return (
                <li key={request.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
                  <span className="min-w-0 flex-1 truncate text-[0.8rem] text-ink" title={request.title}>
                    {request.title}
                    {parsed && (
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: "openRef", book: parsed.book, chapter: parsed.chapter })
                        }
                        title={`Open ${parsed.bookName} ${parsed.chapter} in the workspace`}
                        className="ml-1 text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        {parsed.bookName} {parsed.chapter}
                        {parsed.from ? `:${parsed.from}` : ""}
                      </button>
                    )}
                  </span>
                  <span className="shrink-0 text-[0.62rem] text-muted">{list.title}</span>
                  <button
                    type="button"
                    onClick={() => markPrayed(list.id, request.id)}
                    title={`Mark "${request.title}" prayed`}
                    className="shrink-0 border border-emerald px-1.5 py-0.5 text-[0.62rem] text-emerald hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    Prayed
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="px-3 py-2 text-[0.7rem] leading-relaxed text-muted">
        Marking, catch-up, and new plans live in the{" "}
        <button
          type="button"
          onClick={() => dispatch({ type: "openPlans" })}
          className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          plans pane
        </button>
        ; the lists and their answered history live in the{" "}
        <button
          type="button"
          onClick={() => dispatch({ type: "openPrayers" })}
          className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          prayers pane
        </button>
        ; memory work lives in the{" "}
        <button
          type="button"
          onClick={() => dispatch({ type: "openMemory" })}
          className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          memory pane
        </button>
        .
      </p>
    </div>
  );
}

/* ---------- Settings: the program settings that apply workspace-wide ---------- */

/** One translation on the shelf, as /api/translations reports it. */
interface ShelfTranslation {
  id: string;
  abbrev: string;
  name: string;
  otOnly: boolean;
}

const SETTINGS_SELECT =
  "w-full border border-rule bg-paper px-1.5 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire";

/**
 * The Settings rail: the controls that genuinely apply workspace-wide, each
 * writing a device-local key the rest of the app reads. Candlelight is the
 * same switch the site header carries (src/lib/display.ts), reachable here
 * with the chrome hidden; the text multiplier rides under every pane's own
 * A steppers; new reader tabs open in the default translation (readerTab in
 * workspace-state.ts); copied verses and Power Lookup follow the citation
 * style (src/lib/citation.ts). Export, import, and the Scribe's profile
 * stay on the settings page.
 */
function SettingsPanel() {
  const { lit, scale } = useDisplayPrefs();
  const [shelf, setShelf] = useState<ShelfTranslation[]>([]);
  const [translation, setTranslation] = useState("kjv");
  const [style, setStyle] = useState<CitationStyle>("text-first");

  useEffect(() => {
    setTranslation(window.localStorage.getItem(PREFERRED_TRANSLATION_KEY) ?? "kjv");
    setStyle(citationStyle());
    fetch("/api/translations")
      .then((res) => (res.ok ? res.json() : { translations: [] }))
      .then((data: { translations: ShelfTranslation[] }) =>
        // OT-only texts cannot default: a new tab might open in the NT.
        setShelf(data.translations.filter((t) => !t.otOnly))
      )
      .catch(() => {});
  }, []);

  const chooseTranslation = (id: string) => {
    setTranslation(id);
    if (id === "kjv") window.localStorage.removeItem(PREFERRED_TRANSLATION_KEY);
    else window.localStorage.setItem(PREFERRED_TRANSLATION_KEY, id);
  };

  const chooseStyle = (v: CitationStyle) => {
    setStyle(v);
    window.localStorage.setItem(CITATION_STYLE_KEY, v);
  };

  return (
    <div className="py-1">
      <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
        Display
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-[3px]">
        <span className="text-[0.8rem] text-ink">Candlelight</span>
        <button
          type="button"
          aria-pressed={lit}
          title={lit ? "Switch to daylight" : "Switch to candlelight"}
          onClick={() => setCandle(!lit)}
          className="border border-rule bg-paper px-2 py-0.5 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {lit ? "☀ Daylight" : "🕯 Candlelight"}
        </button>
      </div>
      <label className="block px-3 py-[3px] text-[0.8rem] text-ink">
        <span className="mb-0.5 block">Text size</span>
        <select
          value={String(scale)}
          onChange={(e) => setTextScale(Number(e.target.value))}
          className={SETTINGS_SELECT}
        >
          {TEXT_SCALES.map((s) => (
            <option key={s.value} value={String(s.value)}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
        The size rides under every reader pane&apos;s own A steppers, here and on
        the reading page.
      </p>

      <div className="small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted">
        Reading
      </div>
      <label className="block px-3 py-[3px] text-[0.8rem] text-ink">
        <span className="mb-0.5 block">Default translation</span>
        <select
          value={translation}
          onChange={(e) => chooseTranslation(e.target.value)}
          className={SETTINGS_SELECT}
        >
          {shelf.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.abbrev})
            </option>
          ))}
        </select>
      </label>
      <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
        New reader tabs open in this text; a pane&apos;s own swap still wins.
      </p>

      <div className="small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted">
        Copying
      </div>
      <label className="block px-3 py-[3px] text-[0.8rem] text-ink">
        <span className="mb-0.5 block">Citation style</span>
        <select
          value={style}
          onChange={(e) => chooseStyle(e.target.value as CitationStyle)}
          className={SETTINGS_SELECT}
        >
          <option value="text-first">Text, then reference</option>
          <option value="citation-first">Reference, then text</option>
        </select>
      </label>
      <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
        Copied verses read “For God so loved… (John 3:16)” or “John 3:16: For
        God so loved…”. Power Lookup follows the same choice.
      </p>

      <p className="mt-2 border-t border-rule px-3 py-2 text-[0.7rem] leading-relaxed text-muted">
        Export, import, deletion, and the Scribe&apos;s profile live on the{" "}
        <Link href="/settings" className="text-sapphire no-underline hover:underline">
          settings page
        </Link>
        . Every preference here persists on this device.
      </p>
    </div>
  );
}

/* ---------- Read: the canon tree ---------- */

function CanonTree() {
  const { state, dispatch } = useWorkspace();
  const activeLeaf = findLeaf(state.root, state.activePaneId);
  const current = activeLeaf ? paneRef(activeLeaf) : null;
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(current ? [current.book] : [])
  );

  const toggle = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const open = (book: string, chapter: number) => dispatch({ type: "openRef", book, chapter });

  return (
    <div className="py-1">
      {(["OT", "NT"] as const).map((testament) => (
        <div key={testament} className="mb-1">
          <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
            {testament === "OT" ? "Old Testament" : "New Testament"}
          </div>
          {CANON.filter((b) => b.testament === testament).map((book) => {
            const isOpen = expanded.has(book.slug);
            const isCurrentBook = current?.book === book.slug;
            return (
              <div key={book.slug}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(book.slug)}
                  className={`flex w-full items-center gap-1.5 px-3 py-[3px] text-left text-[0.8rem] hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                    isCurrentBook ? "font-semibold text-ink" : "text-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block text-[0.6rem] text-muted transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    ▸
                  </span>
                  <span className="flex-1">{book.name}</span>
                  <span className="text-[0.62rem] text-muted">{book.chapters}</span>
                </button>
                {isOpen && (
                  <div className="flex flex-wrap gap-[3px] px-3 pt-1 pb-2 pl-7">
                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => {
                      const isCurrent = isCurrentBook && current?.chapter === ch;
                      return (
                        <button
                          key={ch}
                          type="button"
                          draggable
                          onDragStart={(e) =>
                            startModuleDrag(
                              e,
                              DND.chapter,
                              { book: book.slug, chapter: ch },
                              `${book.name} ${ch}`
                            )
                          }
                          onClick={() => open(book.slug, ch)}
                          aria-current={isCurrent ? "true" : undefined}
                          title={`${book.name} ${ch}: click to open, drag into the workspace`}
                          className={`flex h-6 w-7 items-center justify-center border text-[0.68rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                            isCurrent
                              ? "border-amber bg-amber/15 font-semibold text-ink"
                              : "border-rule bg-paper text-muted hover:border-sapphire hover:text-ink"
                          }`}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------- Read: bookmarked passages ---------- */

/**
 * Favorites: bookmarked verses grouped by folder (src/lib/favorites.ts).
 * A row opens its passage and selects the verse so the context strip rises
 * with it; a folder renames inline and a bookmark deletes in place. Capture
 * lives on the verse's right-click menu in the reader.
 */
function FavoritesSection() {
  const { dispatch } = useWorkspace();
  const rows = useCollection(favorites);
  if (rows.length === 0) return null;

  const open = (f: Favorite) => {
    dispatch({ type: "openRef", book: f.book, chapter: f.chapter });
    dispatch({ type: "selectVerse", book: f.book, chapter: f.chapter, verse: f.verse });
  };

  /* Folders alphabetized; the unfiled bookmarks lead under the heading. */
  const folders = [...new Set(rows.map((f) => f.folder).filter((f) => f !== ""))].sort((a, b) =>
    a.localeCompare(b)
  );

  const row = (f: Favorite) => {
    const reference = `${getBook(f.book)?.name ?? f.book} ${f.chapter}:${f.verse}`;
    return (
      <li key={f.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
        <button
          type="button"
          onClick={() => open(f)}
          title={`Open ${reference}`}
          className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {reference}
        </button>
        <button
          type="button"
          onClick={() => removeFavorite(f.id)}
          title="Delete this bookmark"
          aria-label={`Delete the bookmark on ${reference}`}
          className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          ×
        </button>
      </li>
    );
  };

  return (
    <div className="mt-1 border-t border-rule py-1">
      <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
        Bookmarks
      </div>
      <ul>{rows.filter((f) => f.folder === "").sort(byCanon).map(row)}</ul>
      {folders.map((folder) => {
        const inFolder = rows.filter((f) => f.folder === folder).sort(byCanon);
        return (
          <div key={folder}>
            <FolderHeading folder={folder} count={inFolder.length} />
            <ul>{inFolder.map(row)}</ul>
          </div>
        );
      })}
    </div>
  );
}

/** A folder heading in the bookmarks list; the name renames inline. */
function FolderHeading({ folder, count }: { folder: string; count: number }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(folder);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== folder) renameFolder(folder, name);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="px-3 pt-2 pb-1">
        <input
          autoFocus
          value={draft}
          aria-label="Folder name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            // Reset before closing so the blur commit finds nothing to write.
            if (e.key === "Escape") {
              setDraft(folder);
              setRenaming(false);
            }
          }}
          className="w-full border border-rule bg-paper px-1 py-0.5 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(folder);
        setRenaming(true);
      }}
      title={`Rename the ${folder} folder`}
      className="small-caps flex w-full items-baseline gap-2 px-3 pt-3 pb-1 text-left text-[0.62rem] font-semibold text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
    >
      <span className="truncate">{folder}</span>
      <span className="shrink-0 font-normal">{count}</span>
    </button>
  );
}

/* ---------- Library: the reference shelf ---------- */

const LIBRARY_SECTIONS: { title: string; items: { label: string; note?: string }[] }[] = [
  {
    title: "Translations",
    items: [
      { label: "King James Version", note: "KJV" },
      { label: "American Standard Version", note: "ASV" },
      { label: "World English Bible", note: "WEB" },
      { label: "Young's Literal Translation", note: "YLT" },
      { label: "Bible in Basic English", note: "BBE" },
      { label: "Darby Translation", note: "DARBY" },
      { label: "Brenton English Septuagint", note: "OT" },
      { label: "Greek Septuagint", note: "OT" },
    ],
  },
  {
    title: "Commentaries",
    items: [
      { label: "Matthew Henry — Whole Bible" },
      { label: "Matthew Henry — Concise" },
      { label: "John Calvin" },
      { label: "Jamieson, Fausset & Brown" },
      { label: "Adam Clarke" },
      { label: "Albert Barnes", note: "NT" },
    ],
  },
  {
    title: "Lexicon",
    items: [
      { label: "Strong's Hebrew" },
      { label: "Strong's Greek" },
      { label: "TBESH — Hebrew" },
      { label: "TBESG — Greek" },
    ],
  },
  {
    title: "Topics",
    items: [{ label: "Nave's Topical Bible" }, { label: "Torrey's New Topical Textbook" }],
  },
  {
    title: "Entities",
    items: [{ label: "People (TIPNR)" }, { label: "Places & Atlas (TIPNR)" }],
  },
];

/* ---------- Study: the writing half of the room ---------- */

/**
 * The Study rail: the Writing Desk's manuscripts, each opening in its own
 * tab, beside the desk itself as the manage surface. Studies, projects, and
 * the sermon pipeline gather here when their panels land.
 */
function StudyPanel() {
  const { dispatch } = useWorkspace();
  const docs = useCollection(documents);
  return (
    <div className="py-1">
      <div className="px-3 pt-2 pb-1">
        <button
          type="button"
          onClick={() => dispatch({ type: "openDesk" })}
          title="Open the Writing Desk as a pane"
          className="w-full border border-rule bg-paper px-2 py-1.5 text-[0.8rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Open the Writing Desk
        </button>
      </div>
      <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
        Writing
      </div>
      {docs.length === 0 ? (
        <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
          Nothing on the desk yet. A manuscript opened from the desk waits
          here too.
        </p>
      ) : (
        <ul>
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "openManuscript", docId: doc.id, title: doc.title })
                }
                title={`Open ${doc.title || "Untitled"} for editing`}
                className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {doc.title || "Untitled"}
              </button>
              <span className="shrink-0 text-[0.62rem] text-muted">{doc.kind}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="px-3 py-3 text-[0.7rem] leading-relaxed text-muted">
        Studies, projects, and the sermon pipeline will gather here. Until
        then, open a passage and split the pane.
      </p>
    </div>
  );
}

function LibrarySections() {
  const { dispatch } = useWorkspace();
  return (
    <div className="py-1">
      <div className="px-3 pt-2 pb-1">
        <button
          type="button"
          onClick={() => dispatch({ type: "openLibrary" })}
          title="Open the faceted catalog browser as a pane"
          className="w-full border border-rule bg-paper px-2 py-1.5 text-[0.8rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Browse the catalog
        </button>
      </div>
      {LIBRARY_SECTIONS.map((section) => (
        <div key={section.title} className="mb-1">
          <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
            {section.title}
          </div>
          {section.items.map((item) => {
            const draggable = section.title === "Lexicon";
            return (
              <div
                key={item.label}
                draggable={draggable}
                onDragStart={
                  draggable ? (e) => startModuleDrag(e, DND.libraryLexicon, {}, item.label) : undefined
                }
                title={draggable ? "Drag into the workspace to open the lexicon" : undefined}
                className={`flex items-baseline justify-between gap-2 px-3 py-[3px] text-[0.8rem] text-ink ${
                  draggable ? "cursor-grab hover:bg-paper" : ""
                }`}
              >
                <span>{item.label}</span>
                {item.note && <span className="text-[0.62rem] text-muted">{item.note}</span>}
              </div>
            );
          })}
        </div>
      ))}
      <p className="px-3 py-3 text-[0.7rem] leading-relaxed text-muted">
        The catalog browser opens as a pane with facets, tags, ratings, and
        commentary priority; the lexicon entries drag into the workspace.
        Every work is registered in the rights registry.
      </p>
    </div>
  );
}

/* ---------- Documents: the user's own writing and saved lists ---------- */

/** Canon order, then chapter and verse, the way a bound Bible runs. */
const byCanon = (
  a: { book: string; chapter: number; verse: number },
  b: { book: string; chapter: number; verse: number }
) => bookIndex(a.book) - bookIndex(b.book) || a.chapter - b.chapter || a.verse - b.verse;

function DocumentsList() {
  const { dispatch, activeRef } = useWorkspace();
  const docs = useCollection(documents);
  const lists = useCollection(listDocuments);
  const filterSets = useCollection(visualFilters);
  /* The rail lists anchored notes; date-only journal entries gather on the
   * journal page instead. */
  const notes = useCollection(marginNotes).filter(isAnchored).slice().sort(byCanon);
  /** The "This passage" filter: only notes inside the pane in focus show. */
  const [thisPassage, setThisPassage] = useState(false);
  /** The per-notebook filter: only the named notebook's notes show. */
  const [onlyNotebook, setOnlyNotebook] = useState<string | null>(null);
  const passageNotes =
    thisPassage && activeRef
      ? notes.filter((n) => n.book === activeRef.book && n.chapter === activeRef.chapter)
      : notes;
  const shownNotes = onlyNotebook
    ? passageNotes.filter((n) => (n.notebook ?? "") === onlyNotebook)
    : passageNotes;
  /* Unfiled notes lead under the heading, the way unfiled bookmarks do;
   * each notebook follows alphabetized. The filtered notebook's heading
   * stays even at zero notes so the filter can always be cleared. */
  const groups: { name: string; notes: AnchoredNote[] }[] = [
    { name: "", notes: shownNotes.filter((n) => !n.notebook) },
    ...listNotebooks()
      .filter((name) => !onlyNotebook || name === onlyNotebook)
      .map((name) => ({ name, notes: shownNotes.filter((n) => n.notebook === name) })),
  ].filter((g) => g.notes.length > 0 || g.name === onlyNotebook);
  if (docs.length === 0 && lists.length === 0 && filterSets.length === 0 && notes.length === 0) {
    return (
      <Placeholder text="No documents yet. Manuscripts from the Writing Desk appear here, by reference, never by copy; passage and word lists saved from a search or guide gather alongside them, and the marginalia you write on verses collect below." />
    );
  }

  /* A note opens its anchor passage and selects the verse, so the context
   * strip rises with the note ready for reading and editing. */
  const openNote = (n: AnchoredNote) => {
    dispatch({ type: "openRef", book: n.book, chapter: n.chapter });
    dispatch({ type: "selectVerse", book: n.book, chapter: n.chapter, verse: n.verse });
  };

  /** The export helper (src/lib/marginalia.ts) as a visible download. */
  const exportMarkdown = () => {
    const md = exportNotesMarkdown((slug) => getBook(slug)?.name ?? slug);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marginalia.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const noteRow = (n: AnchoredNote) => {
    const reference = `${getBook(n.book)?.name ?? n.book} ${n.chapter}:${n.verse}`;
    return (
      <li key={n.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
        <button
          type="button"
          onClick={() => openNote(n)}
          title={`Open ${reference}: ${n.text}`}
          className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          <span className="text-sapphire">{reference}</span>{" "}
          <span className="text-muted">{n.text}</span>
        </button>
        <button
          type="button"
          onClick={() => deleteNote(n.id)}
          title="Delete this note"
          aria-label={`Delete the note on ${reference}`}
          className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          ×
        </button>
      </li>
    );
  };

  return (
    <div className="py-1">
      {docs.length > 0 && (
        <>
          <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
            Manuscripts
          </div>
          <ul>
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "openManuscript", docId: doc.id, title: doc.title })
                  }
                  title={`Open ${doc.title || "Untitled"} for editing`}
                  className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {doc.title || "Untitled"}
                </button>
                <span className="shrink-0 text-[0.62rem] text-muted">{doc.kind}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {lists.length > 0 && (
        <>
          <div className="small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted">
            Lists
          </div>
          <ul>
            {lists.map((doc) => (
              <li key={doc.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "openListDoc", docId: doc.id, title: doc.title })}
                  title={`Open ${doc.title}`}
                  className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {doc.title || "Untitled list"}
                </button>
                <span className="shrink-0 text-[0.62rem] text-muted">
                  {listKindLabel(doc.kind)} · {doc.items.length}
                </span>
                <button
                  type="button"
                  onClick={() => listDocuments.remove(doc.id)}
                  title="Delete this list"
                  aria-label={`Delete ${doc.title || "Untitled list"}`}
                  className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {filterSets.length > 0 && (
        <>
          <div className="small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted">
            Visual filters
          </div>
          <ul>
            {filterSets.map((s) => (
              <FilterSetRow key={s.id} set={s} />
            ))}
          </ul>
        </>
      )}
      {notes.length > 0 && (
        <div data-print-root>
          <div className="no-print flex items-baseline justify-between gap-2 px-3 pt-3 pb-1">
            <div className="small-caps text-[0.62rem] font-semibold text-muted">Notes</div>
            <span className="flex items-baseline gap-2.5">
              <button
                type="button"
                aria-pressed={thisPassage}
                title={
                  thisPassage
                    ? "Show every note again"
                    : "Show only the notes inside the passage in front of you"
                }
                onClick={() => setThisPassage((v) => !v)}
                className={`text-[0.62rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                  thisPassage ? "font-semibold text-sapphire" : "text-muted hover:text-ink"
                }`}
              >
                This passage
              </button>
              <button
                type="button"
                title="Download every note as Markdown"
                onClick={exportMarkdown}
                className="text-[0.62rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Export
              </button>
              <PrintButton className="text-[0.62rem]" />
            </span>
          </div>
          <div className="no-print">
            {thisPassage && !activeRef && (
              <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
                Open a passage and the notes beside it gather here.
              </p>
            )}
            {thisPassage && activeRef && shownNotes.length === 0 && (
              <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
                No notes on {getBook(activeRef.book)?.name ?? activeRef.book} {activeRef.chapter}{" "}
                yet.
              </p>
            )}
            {groups.map((g) =>
              g.name === "" ? (
                <ul key="unfiled">{g.notes.map(noteRow)}</ul>
              ) : (
                <div key={g.name}>
                  <NotebookHeading
                    name={g.name}
                    count={g.notes.length}
                    active={onlyNotebook === g.name}
                    onToggleFilter={() =>
                      setOnlyNotebook((cur) => (cur === g.name ? null : g.name))
                    }
                    onChanged={() => setOnlyNotebook(null)}
                  />
                  <ul>{g.notes.map(noteRow)}</ul>
                </div>
              )
            )}
            <p className="px-3 py-2 text-[0.7rem] leading-relaxed text-muted">
              Entries anchored to a day instead of a verse gather in the{" "}
              <button
                type="button"
                onClick={() => dispatch({ type: "openJournal" })}
                className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                journal
              </button>
              .
            </p>
          </div>
          {/* The print rendering: the same filter's notes, grouped by
           *  notebook, with references and full text. */}
          <div className="print-only px-3 py-2">
            <h2 className="font-editorial text-lg font-bold text-ink">
              Notes
              {onlyNotebook ? ` · ${onlyNotebook}` : ""}
            </h2>
            {thisPassage && activeRef && (
              <p className="text-xs text-muted">
                {getBook(activeRef.book)?.name ?? activeRef.book} {activeRef.chapter}
              </p>
            )}
            {groups.map((g) => (
              <section key={g.name || "unfiled"} className="mt-3">
                {g.name !== "" && (
                  <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                    {g.name}
                  </p>
                )}
                {g.notes.map((n) => (
                  <div key={n.id} className="mt-2">
                    <p className="small-caps text-sm font-medium text-ink">
                      {getBook(n.book)?.name ?? n.book} {n.chapter}:{n.verse}
                    </p>
                    <p className="font-reader text-[0.9rem] leading-relaxed whitespace-pre-wrap text-ink">
                      {n.text}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(n.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A notebook heading in the notes list: the name filters the rail to that
 * notebook (the notebook is the filtering unit), "Rename" renames it across
 * every note filed in it, and × deletes the notebook alone; its notes stay,
 * unfiled. onChanged clears a filter left pointing at the old name.
 */
function NotebookHeading({
  name,
  count,
  active,
  onToggleFilter,
  onChanged,
}: {
  name: string;
  count: number;
  active: boolean;
  onToggleFilter: () => void;
  onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) {
      renameNotebook(name, next);
      onChanged();
    }
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="px-3 pt-2 pb-1">
        <input
          autoFocus
          value={draft}
          aria-label="Notebook name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            // Reset before closing so the blur commit finds nothing to write.
            if (e.key === "Escape") {
              setDraft(name);
              setRenaming(false);
            }
          }}
          className="w-full border border-rule bg-paper px-1 py-0.5 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
      </div>
    );
  }

  return (
    <div className="flex w-full items-baseline gap-2 px-3 pt-3 pb-1">
      <button
        type="button"
        aria-pressed={active}
        title={active ? "Show every note again" : `Show only the ${name} notebook`}
        onClick={onToggleFilter}
        className={`small-caps min-w-0 truncate text-left text-[0.62rem] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
          active ? "text-sapphire" : "text-muted hover:text-ink"
        }`}
      >
        {name}
      </button>
      <span className="shrink-0 text-[0.62rem] text-muted">{count}</span>
      <button
        type="button"
        title={`Rename the ${name} notebook`}
        onClick={() => {
          setDraft(name);
          setRenaming(true);
        }}
        className="ml-auto shrink-0 text-[0.62rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Rename
      </button>
      <button
        type="button"
        title={`Delete the ${name} notebook; its notes stay, unfiled`}
        aria-label={`Delete the ${name} notebook`}
        onClick={() => {
          deleteNotebook(name);
          onChanged();
        }}
        className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        ×
      </button>
    </div>
  );
}

/**
 * hidden set keeps its marks and renders nothing), the name renames inline,
 * the count is the set's verse count, and × deletes the set alone; personal
 * highlights never move.
 */
function FilterSetRow({ set }: { set: VisualFilterSet }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(set.name);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== set.name) visualFilters.update(set.id, { name });
    setRenaming(false);
  };

  return (
    <li className="flex items-center gap-1.5 px-3 py-[3px] hover:bg-paper">
      <button
        type="button"
        aria-pressed={set.visible}
        title={set.visible ? "Hide this filter's marks" : "Show this filter's marks"}
        onClick={() => visualFilters.update(set.id, { visible: !set.visible })}
        className={`h-3 w-3 shrink-0 border border-rule focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
          set.visible ? "" : "opacity-30"
        }`}
        style={{ background: `var(--stained-${set.color})` }}
      />
      {renaming ? (
        <input
          autoFocus
          value={draft}
          aria-label="Filter name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            // Reset before closing so the blur commit finds nothing to write.
            if (e.key === "Escape") {
              setDraft(set.name);
              setRenaming(false);
            }
          }}
          className="min-w-0 flex-1 border border-rule bg-paper px-1 py-0.5 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(set.name);
            setRenaming(true);
          }}
          title={`Rename ${set.name}${set.source ? ` (from the search ${set.source})` : ""}`}
          className={`min-w-0 flex-1 truncate text-left text-[0.8rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
            set.visible ? "text-ink" : "text-muted"
          }`}
        >
          {set.name}
        </button>
      )}
      <span className="shrink-0 text-[0.62rem] text-muted">
        {set.items.length} {set.items.length === 1 ? "verse" : "verses"}
      </span>
      <button
        type="button"
        onClick={() => visualFilters.remove(set.id)}
        title="Delete this visual filter"
        aria-label={`Delete ${set.name}`}
        className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        ×
      </button>
    </li>
  );
}
