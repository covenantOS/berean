"use client";

import { useState, type FormEvent } from "react";
import { getBook } from "@/lib/canon";
import { createCanvas } from "@/lib/canvas";
import { guides } from "@/lib/guides";
import { useCollection } from "@/lib/hooks";
import { recordSearch, useSearchSaves } from "@/lib/search-history";
import { layoutState, layouts } from "./layouts";
import { Clouds } from "@/components/canvasui/Clouds";
import { useWorkspace } from "./WorkspaceContext";
import {
  allSearchTab,
  bookExplorerTab,
  canvasDocTab,
  concordanceTab,
  customGuideTab,
  confessionTab,
  dashboardTab,
  docSearchTab,
  exegeticalTab,
  findLeaf,
  guideEditorTab,
  guideTab,
  harmonyTab,
  libraryTab,
  mediaTab,
  multiviewTab,
  readerTab,
  searchTab,
  textCompareTab,
  toolsTab,
  wisdomExplorerTab,
  workflowEditorTab,
  type LauncherTab,
  type LeafNode,
  type NavEntry,
  type ReaderTab,
  type Tab,
} from "./workspace-state";

/**
 * The launcher behind every new tab, the Logos New Tab panel: what the
 * workspace opens, with one-tap suggestions keyed to the passage the pane
 * was showing when the tab opened (pinned on the tab, the way a guide pins
 * its passage). Choosing anything hands the tab's slot to the choice through
 * replaceTab, so the launcher never lingers underneath. Recents come from
 * what genuinely remembers: the search rail's history and the pane's own
 * navigation trail. The header names the mechanic plainly: this panel is how
 * you choose a module for a pane, the same door the tab strip's + opens.
 */

const HEAD = "small-caps px-3 pt-3 pb-1 text-[0.62rem] font-semibold text-muted";
const ROW =
  "flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[0.8rem] text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";
const HINT = "ml-auto shrink-0 pl-3 text-[0.62rem] text-muted";

/** The pane's trail as recent passages: newest first, deduped, capped. */
function recentTrail(
  leaf: LeafNode | null,
  current: { book: string; chapter: number } | null
): NavEntry[] {
  if (!leaf) return [];
  const out: NavEntry[] = [];
  for (let i = leaf.history.entries.length - 1; i >= 0 && out.length < 4; i--) {
    const e = leaf.history.entries[i];
    // The pinned passage already heads the suggestions above.
    if (current && e.book === current.book && e.chapter === current.chapter) continue;
    if (out.some((o) => o.book === e.book && o.chapter === e.chapter && o.translation === e.translation)) {
      continue;
    }
    out.push(e);
  }
  return out;
}

export default function LauncherPane({ paneId, tab }: { paneId: string; tab: LauncherTab }) {
  const { state, dispatch } = useWorkspace();
  const { history } = useSearchSaves();
  const saved = useCollection(layouts);
  /** The user's custom guides, offered against the pinned passage. */
  const customGuides = useCollection(guides);
  const [q, setQ] = useState("");

  const ref = tab.book && tab.chapter ? { book: tab.book, chapter: tab.chapter } : null;
  const bookName = ref ? (getBook(ref.book)?.name ?? ref.book) : null;
  const trail = recentTrail(findLeaf(state.root, paneId), ref);
  const recent = history.slice(0, 5);

  /** A choice takes the launcher's slot in the strip, in place. */
  const choose = (next: Tab) =>
    dispatch({ type: "replaceTab", paneId, tabId: tab.id, tab: next });

  /** A trail stop wears its own text, not the current preferred translation. */
  const readerFor = (entry: NavEntry): ReaderTab => {
    const t = readerTab(entry.book, entry.chapter);
    if (entry.translation) t.translation = entry.translation;
    else delete t.translation;
    return t;
  };

  /* The launcher's box runs All Search by default: one query across the
   * canon and the user's own collections. The Bible and Docs buttons beside
   * it narrow to one group, the dedicated paths staying reachable. Every
   * query enters the rail's re-runnable history, as before. */
  const runAllSearch = () => {
    const query = q.trim();
    if (!query) return;
    recordSearch(query);
    choose(allSearchTab(query));
  };

  const runSearch = () => {
    const query = q.trim();
    if (!query) return;
    // Every search, from anywhere, enters the rail's re-runnable history.
    recordSearch(query);
    choose(searchTab(query));
  };

  const runDocSearch = () => {
    const query = q.trim();
    if (query.length < 2) return;
    choose(docSearchTab(query));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    runAllSearch();
  };

  /** Restores a named layout the way the layouts menu does. */
  const restoreLayout = (id: string) => {
    const layout = layouts.get(id);
    const restored = layout ? layoutState(layout) : null;
    if (restored) dispatch({ type: "hydrate", state: restored });
  };

  return (
    <div className="glass-lit fx-bloom mx-auto max-w-md rounded-[4px] px-2 py-3">
      <Clouds opacity={0.4} density={2} speed={0.4} style={{ borderRadius: "4px" }}>
      <header className="px-3 pb-1">
        <p className="small-caps text-xs font-semibold text-amber">Modules</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">Choose a module for this pane</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          A reader, a guide, a search, or one of the rooms; the choice takes this tab&apos;s place.
        </p>
      </header>
      {ref && bookName && (
        <>
          <div className={HEAD}>
            At {bookName} {ref.chapter}
          </div>
          <ul>
            <li>
              <button
                type="button"
                className={ROW}
                onClick={() => choose(readerFor({ book: ref.book, chapter: ref.chapter }))}
              >
                Read {bookName} {ref.chapter}
                <span className={HINT}>Reader</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={ROW}
                onClick={() => choose(guideTab(ref.book, ref.chapter))}
              >
                Passage Guide
                <span className={HINT}>
                  {bookName} {ref.chapter}
                </span>
              </button>
            </li>
            {/* Both testaments carry complete original datasets (data/tahot,
             * data/tagnt), so the Exegetical Guide answers every passage. */}
            <li>
              <button
                type="button"
                className={ROW}
                onClick={() => choose(exegeticalTab(ref.book, ref.chapter))}
              >
                Exegetical Guide
                <span className={HINT}>Original languages</span>
              </button>
            </li>
            {customGuides.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  title={`Run ${g.name} on ${bookName} ${ref.chapter}`}
                  className={ROW}
                  onClick={() => choose(customGuideTab(g.id, g.name, ref.book, ref.chapter))}
                >
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <span className={HINT}>Custom guide</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className={ROW}
                onClick={() => choose(textCompareTab(ref.book, ref.chapter))}
              >
                Text Compare
                <span className={HINT}>Translations</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={ROW}
                onClick={() => choose(multiviewTab(ref.book, ref.chapter))}
              >
                Multiview
                <span className={HINT}>Translations side by side</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={ROW}
                onClick={() => choose(concordanceTab(ref.book))}
              >
                Concordance
                <span className={HINT}>{bookName}</span>
              </button>
            </li>
          </ul>
        </>
      )}

      <div className={HEAD}>Search</div>
      <form onSubmit={submit} className="flex items-center gap-1.5 px-3 py-1">
        <input
          type="search"
          value={q}
          aria-label="Search the Bible and your documents"
          placeholder="Search everything…"
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <button
          type="button"
          title="Search the canon alone"
          onClick={runSearch}
          disabled={q.trim().length < 2}
          className="shrink-0 border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Bible
        </button>
        <button
          type="button"
          title="Search your notes, manuscripts, lists, and prayers alone"
          onClick={runDocSearch}
          disabled={q.trim().length < 2}
          className="shrink-0 border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Docs
        </button>
      </form>
      <ul>
        <li>
          <button
            type="button"
            title="The day's verse, readings, memory work, prayers, and studies in progress"
            className={ROW}
            onClick={() => choose(dashboardTab())}
          >
            Today
            <span className={HINT}>Dashboard</span>
          </button>
        </li>
        <li>
          <button type="button" className={ROW} onClick={() => choose(libraryTab())}>
            Browse the Library
            <span className={HINT}>Catalog</span>
          </button>
        </li>
        <li>
          <button type="button" className={ROW} onClick={() => choose(bookExplorerTab())}>
            The Canon
            <span className={HINT}>Books by author, genre, size, date</span>
          </button>
        </li>
        <li>
          <button type="button" className={ROW} onClick={() => choose(harmonyTab())}>
            Gospel Harmony
            <span className={HINT}>Parallel accounts side by side</span>
          </button>
        </li>
        <li>
          <button type="button" className={ROW} onClick={() => choose(confessionTab())}>
            Confessions
            <span className={HINT}>Creeds and catechisms with proof texts</span>
          </button>
        </li>
        <li>
          <button type="button" className={ROW} onClick={() => choose(wisdomExplorerTab("psalms"))}>
            Psalms
            <span className={HINT}>Genre map of the Psalter</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={ROW}
            onClick={() => choose(wisdomExplorerTab("proverbs"))}
          >
            Proverbs
            <span className={HINT}>The seven collections</span>
          </button>
        </li>
        <li>
          <button type="button" className={ROW} onClick={() => choose(toolsTab())}>
            Tools
            <span className={HINT}>Measures, alphabets, numerals</span>
          </button>
        </li>
        <li>
          <button type="button" className={ROW} onClick={() => choose(guideEditorTab(null))}>
            Compose a guide
            <span className={HINT}>Guide editor</span>
          </button>
        </li>
        <li>
          <button type="button" className={ROW} onClick={() => choose(workflowEditorTab(null))}>
            Compose a workflow
            <span className={HINT}>Workflow editor</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            title="Compose a verse card from any reference, styled and exported as SVG"
            className={ROW}
            onClick={() => choose(mediaTab(ref ? { ...ref } : undefined))}
          >
            Media
            <span className={HINT}>Verse card studio</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            title="A whiteboard for visual study; saved canvases live in the Documents rail"
            className={ROW}
            onClick={() => {
              const c = createCanvas("Untitled canvas");
              choose(canvasDocTab(c.id, c.name));
            }}
          >
            New canvas
            <span className={HINT}>Visual study</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            title="Step-by-step guided studies; the library and your runs live in the Documents rail"
            className={ROW}
            onClick={() => dispatch({ type: "setRailMode", mode: "documents" })}
          >
            Guided studies
            <span className={HINT}>Workflows</span>
          </button>
        </li>
      </ul>

      {recent.length > 0 && (
        <>
          <div className={HEAD}>Recent searches</div>
          <ul>
            {recent.map((entry) => (
              <li key={`${entry.q}:${entry.mode ?? "bible"}`}>
                <button
                  type="button"
                  title={`Search again for “${entry.q}”`}
                  className={ROW}
                  onClick={() => {
                    recordSearch(entry.q, entry.mode);
                    choose(searchTab(entry.q, entry.mode));
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">“{entry.q}”</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {trail.length > 0 && (
        <>
          <div className={HEAD}>Recent passages</div>
          <ul>
            {trail.map((entry) => {
              const name = getBook(entry.book)?.name ?? entry.book;
              return (
                <li key={`${entry.book}-${entry.chapter}-${entry.translation ?? ""}`}>
                  <button type="button" className={ROW} onClick={() => choose(readerFor(entry))}>
                    {name} {entry.chapter}
                    {entry.translation && (
                      <span className={HINT}>{entry.translation.toUpperCase()}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {saved.length > 0 && (
        <>
          <div className={HEAD}>Saved layouts</div>
          <ul>
            {saved.slice(0, 4).map((layout) => (
              <li key={layout.id}>
                <button
                  type="button"
                  title={`Restore ${layout.name}`}
                  className={ROW}
                  onClick={() => restoreLayout(layout.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{layout.name}</span>
                  <span className={HINT}>Layout</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      </Clouds>
    </div>
  );
}
