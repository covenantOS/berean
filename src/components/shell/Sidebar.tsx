"use client";

import { useState } from "react";
import { CANON, bookIndex, getBook } from "@/lib/canon";
import { documents, listDocuments, listKindLabel } from "@/lib/documents";
import { useCollection } from "@/lib/hooks";
import { deleteNote, notes as marginNotes, type MarginNote } from "@/lib/marginalia";
import { toggleFavorite, useSearchSaves } from "@/lib/search-history";
import { visualFilters, type VisualFilterSet } from "@/lib/visualfilters";
import { useWorkspace } from "./WorkspaceContext";
import { DND, startModuleDrag } from "./dnd";
import { findLeaf, paneRef, type RailMode } from "./workspace-state";

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
 * The left sidebar: one tree or section list per rail mode. The Read tree,
 * the Search rail's pinned searches and history, and the Documents list
 * carry real data; the rest are quiet placeholders until their panels land
 * in a later phase.
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
        {state.railMode === "read" && <CanonTree />}
        {state.railMode === "library" && <LibrarySections />}
        {state.railMode === "documents" && <DocumentsList />}
        {state.railMode === "study" && (
          <Placeholder text="Studies, projects, and the sermon pipeline will gather here. Until then, open a passage and split the pane." />
        )}
        {state.railMode === "search" && <SearchPanel />}
        {state.railMode === "almanac" && (
          <Placeholder text="The calendar, rule of life, and timeline will live here." />
        )}
        {state.railMode === "settings" && (
          <Placeholder text="Workspace and reading preferences will live here. Session state already persists on this device." />
        )}
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
 * or from the search pane's own header.
 */
function SearchPanel() {
  const { dispatch } = useWorkspace();
  const { history, favorites } = useSearchSaves();
  const rerun = (q: string) => dispatch({ type: "openSearch", q });

  return (
    <div className="py-1">
      <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
        Pinned searches
      </div>
      {favorites.length === 0 ? (
        <p className="px-3 py-1 text-[0.7rem] leading-relaxed text-muted">
          Pin a search from its pane header and it waits here.
        </p>
      ) : (
        favorites.map((f) => (
          <div key={f.q} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
            <button
              type="button"
              onClick={() => rerun(f.q)}
              title={`Search again for “${f.q}”`}
              className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {f.q}
            </button>
            <button
              type="button"
              onClick={() => toggleFavorite(f.q)}
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
          const pinned = favorites.some((f) => f.q.toLowerCase() === h.q.toLowerCase());
          return (
            <div key={h.q} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
              <button
                type="button"
                onClick={() => rerun(h.q)}
                title={`Search again for “${h.q}”`}
                className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {h.q}
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(h.q)}
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
const byCanon = (a: MarginNote, b: MarginNote) =>
  bookIndex(a.book) - bookIndex(b.book) || a.chapter - b.chapter || a.verse - b.verse;

function DocumentsList() {
  const { dispatch } = useWorkspace();
  const docs = useCollection(documents);
  const lists = useCollection(listDocuments);
  const filterSets = useCollection(visualFilters);
  const notes = useCollection(marginNotes).slice().sort(byCanon);
  if (docs.length === 0 && lists.length === 0 && filterSets.length === 0 && notes.length === 0) {
    return (
      <Placeholder text="No documents yet. Manuscripts from the Writing Desk appear here, by reference, never by copy; passage and word lists saved from a search or guide gather alongside them, and the marginalia you write on verses collect below." />
    );
  }

  /* A note opens its anchor passage and selects the verse, so the context
   * strip rises with the note ready for reading and editing. */
  const openNote = (n: MarginNote) => {
    dispatch({ type: "openRef", book: n.book, chapter: n.chapter });
    dispatch({ type: "selectVerse", book: n.book, chapter: n.chapter, verse: n.verse });
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
              <li
                key={doc.id}
                className="flex items-baseline justify-between gap-2 px-3 py-[3px] text-[0.8rem] text-ink"
              >
                <span className="truncate">{doc.title || "Untitled"}</span>
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
        <>
          <div className="small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted">
            Notes
          </div>
          <ul>
            {notes.map((n) => {
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
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * One visual filter set in the rail: the swatch switches visibility (a
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
