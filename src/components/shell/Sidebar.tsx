"use client";

import { useState } from "react";
import { CANON } from "@/lib/canon";
import { documents } from "@/lib/documents";
import { useCollection } from "@/lib/hooks";
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
 * The left sidebar: one tree or section list per rail mode. Only the Read
 * tree and the Documents list carry real data in Phase 0; the rest are
 * quiet placeholders until their panels land in Phase 1.
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
        {state.railMode === "search" && (
          <Placeholder text="Concordance search answers in the command palette (Ctrl+K) and opens as a pane. Lemma and semantic search land here in a later phase." />
        )}
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
  return (
    <div className="py-1">
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
        The lexicon entries drag into the workspace; the rest of the shelf
        opens as panes in a later phase. Every work is registered in the
        rights registry.
      </p>
    </div>
  );
}

/* ---------- Documents: the user's own writing ---------- */

function DocumentsList() {
  const docs = useCollection(documents);
  if (docs.length === 0) {
    return (
      <Placeholder text="No documents yet. Manuscripts from the Writing Desk appear here, by reference, never by copy." />
    );
  }
  return (
    <ul className="py-1">
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
  );
}
