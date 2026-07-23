"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getBook } from "@/lib/canon";
import { canvases } from "@/lib/canvas";
import { diagrams } from "@/lib/diagram";
import { documents } from "@/lib/documents";
import { guides } from "@/lib/guides";
import { useCollectionWrites } from "@/lib/hooks";
import { liturgies } from "@/lib/liturgy";
import { memoryPassages } from "@/lib/memory";
import { personalbooks } from "@/lib/personalbooks";
import { playSound } from "@/lib/sound";
import { useWorkspace } from "./WorkspaceContext";
import { DND, edgeAtPoint, hasGridPayload, readPayload, startModuleDrag } from "./dnd";
import {
  countLeaves,
  dockTabForTab,
  lexiconTab,
  LINK_SETS,
  MAX_PANES,
  readerTab,
  toolTabForDock,
  type DockTab,
  type DropTarget,
  type LeafNode,
  type LinkSet,
  type PaneNode,
  type SplitNode,
  type Tab,
  type WorkspaceAction,
} from "./workspace-state";
import ReaderPane from "./ReaderPane";
import SearchPane from "./SearchPane";
import DocSearchPane from "./DocSearchPane";
import BooksSearchPane from "./BooksSearchPane";
import AllSearchPane from "./AllSearchPane";
import ToolTabBody from "./ToolTabBody";
import PassageGuide from "./PassageGuide";
import CustomGuidePane from "./CustomGuidePane";
import GuideEditorPane from "./GuideEditorPane";
import WorkflowPane from "./WorkflowPane";
import WorkflowEditorPane from "./WorkflowEditorPane";
import WordStudyGuide from "./WordStudyGuide";
import ExegeticalGuide from "./ExegeticalGuide";
import TopicGuide from "./TopicGuide";
import ListDocPane from "./ListDocPane";
import CanvasPane from "./CanvasPane";
import DiagramPane from "./DiagramPane";
import DeskPane from "./DeskPane";
import ManuscriptPane from "./ManuscriptPane";
import PersonalBookPane from "./PersonalBookPane";
import PulpitPane from "./PulpitPane";
import ProjectPane from "./ProjectPane";
import ChapelPane from "./ChapelPane";
import ServicePane from "./ServicePane";
import AlmanacPane from "./AlmanacPane";
import Factbook from "./Factbook";
import FamilyMapPane from "./FamilyMapPane";
import LibraryPane from "./LibraryPane";
import MultiviewPane from "./MultiviewPane";
import TextCompare from "./TextCompare";
import ConcordancePane from "./ConcordancePane";
import AtlasPane from "./AtlasPane";
import TimelinePane from "./TimelinePane";
import MemoryPane from "./MemoryPane";
import JournalPane from "./JournalPane";
import PrayersPane from "./PrayersPane";
import PlansPane from "./PlansPane";
import NotesPane from "./NotesPane";
import TopicsPane from "./TopicsPane";
import SettingsPane from "./SettingsPane";
import LauncherPane from "./LauncherPane";
import DashboardPane from "./DashboardPane";
import ToolsPane from "./ToolsPane";
import BookExplorerPane from "./BookExplorerPane";
import HarmonyPane from "./HarmonyPane";
import WisdomExplorerPane from "./WisdomExplorerPane";
import MediaPane from "./MediaPane";
import SermonStarterPane from "./SermonStarterPane";
import { LinkIcon, SplitHorizontalIcon, SplitVerticalIcon } from "./icons";

/**
 * The center pane grid: renders the split tree recursively. Leaves are
 * tabbed panes; splits carry a draggable divider. Clicking anywhere in a
 * pane makes it the target for navigation.
 */
export default function PaneGrid() {
  const { state } = useWorkspace();
  return (
    <div className="ws-grid-inner h-full min-h-0 w-full bg-paper p-1.5">
      <NodeView node={state.root} />
    </div>
  );
}

function NodeView({ node }: { node: PaneNode }) {
  if (node.kind === "leaf") return <Pane leaf={node} />;
  return <SplitView split={node} />;
}

function SplitView({ split }: { split: SplitNode }) {
  const { dispatch } = useWorkspace();
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontal = split.direction === "horizontal";

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = horizontal
        ? (ev.clientX - rect.left) / rect.width
        : (ev.clientY - rect.top) / rect.height;
      dispatch({ type: "setRatio", splitId: split.id, ratio });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  return (
    <div ref={containerRef} className={`ws-split flex h-full min-h-0 w-full ${horizontal ? "" : "flex-col"}`}>
      <div
        style={{ flexBasis: `${split.ratio * 100}%` }}
        className="min-h-0 min-w-0 shrink-0 grow-0"
      >
        <NodeView node={split.children[0]} />
      </div>
      <div
        role="separator"
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        title="Drag to resize panes"
        onPointerDown={onPointerDown}
        className={`ws-sep shrink-0 touch-none bg-transparent transition hover:bg-sapphire/40 hover:shadow-[0_0_8px_color-mix(in_srgb,var(--stained-sapphire)_45%,transparent)] ${
          horizontal ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"
        }`}
      />
      <div className="min-h-0 min-w-0 flex-1">
        <NodeView node={split.children[1]} />
      </div>
    </div>
  );
}

/* The collections a tab label can read live; the strip subscribes to them
 * so a rename lands on an open tab without a reopen. */
const TITLE_SOURCES = [guides, canvases, diagrams, documents, personalbooks, liturgies];

/** The label every tab wears, in the strip and on the drag chip. Titles
 *  with a rename path resolve from their collection live, the memory tab's
 *  pattern, so a rename lands without reopening; the title captured at
 *  open time answers when the record is gone. */
function tabLabel(tab: Tab): string {
  if (tab.type === "reader") {
    return `${getBook(tab.book)?.name ?? tab.book} ${tab.chapter}${
      tab.translation ? ` · ${tab.translation.toUpperCase()}` : ""
    }`;
  }
  if (tab.type === "search") {
    const engine =
      tab.mode === "original" ? " · Original" : tab.mode === "semantic" ? " · Meaning" : "";
    return `“${tab.q}”${engine}`;
  }
  if (tab.type === "docsearch") return `“${tab.q}” · Docs`;
  if (tab.type === "bookssearch") return `“${tab.q}” · Books`;
  if (tab.type === "allsearch") return `“${tab.q}” · All`;
  if (tab.type === "commentary") return "Commentary";
  if (tab.type === "crossrefs") return "Cross-refs";
  if (tab.type === "guide") return `Guide: ${getBook(tab.book)?.name ?? tab.book} ${tab.chapter}`;
  if (tab.type === "customguide") {
    return `${guides.get(tab.guideId)?.name ?? tab.name}: ${getBook(tab.book)?.name ?? tab.book} ${tab.chapter}`;
  }
  if (tab.type === "guideeditor") return "Guide editor";
  if (tab.type === "workflow") return tab.title;
  if (tab.type === "workfloweditor") return "Workflow editor";
  if (tab.type === "wordstudy") return `Word Study: ${tab.strongsId}`;
  if (tab.type === "exegetical") {
    return `Exegetical: ${getBook(tab.book)?.name ?? tab.book} ${tab.chapter}`;
  }
  if (tab.type === "sermonstarter") {
    return `Sermon prep: ${getBook(tab.book)?.name ?? tab.book} ${tab.chapter}`;
  }
  if (tab.type === "topicguide") {
    return `Topic: ${tab.title.replace(/\b\w/g, (c) => c.toUpperCase())}`;
  }
  if (tab.type === "listdoc") return `List: ${tab.title}`;
  if (tab.type === "canvasdoc") return `Canvas: ${canvases.get(tab.canvasId)?.name ?? tab.title}`;
  if (tab.type === "diagram") return `Diagram: ${diagrams.get(tab.diagramId)?.name ?? tab.title}`;
  if (tab.type === "desk") return "Writing";
  if (tab.type === "manuscript") return documents.get(tab.docId)?.title ?? tab.title;
  if (tab.type === "personalbook") {
    const title = personalbooks.get(tab.bookId)?.title ?? tab.title;
    return tab.session !== undefined ? `${title} · Session ${tab.session}` : title;
  }
  if (tab.type === "pulpit") return "Pulpit";
  if (tab.type === "project") return tab.title;
  if (tab.type === "chapel") return "Chapel";
  if (tab.type === "service") return liturgies.get(tab.serviceId)?.title ?? tab.title;
  if (tab.type === "almanac") return "Almanac";
  if (tab.type === "factbook") return `Factbook: ${tab.title}`;
  if (tab.type === "familymap") return `Family: ${tab.title}`;
  if (tab.type === "library") return "Library";
  if (tab.type === "multiview") {
    return `Multiview: ${getBook(tab.book)?.name ?? tab.book} ${tab.chapter}`;
  }
  if (tab.type === "textcompare") {
    return `Compare: ${getBook(tab.book)?.name ?? tab.book} ${tab.chapter}`;
  }
  if (tab.type === "concordance") {
    return `Concordance: ${getBook(tab.book)?.name ?? tab.book}`;
  }
  if (tab.type === "atlas") return tab.title ? `Atlas: ${tab.title}` : "Atlas";
  if (tab.type === "timeline") return tab.title ? `Timeline: ${tab.title}` : "Timeline";
  if (tab.type === "memory") {
    // The drill pin resolves live; a laid-aside record reads as the list.
    const p = tab.passageId ? memoryPassages.get(tab.passageId) : undefined;
    if (!p) return "Memory work";
    return `Memory: ${getBook(p.book)?.name ?? p.book} ${p.chapter}:${p.from}${
      p.to !== p.from ? `–${p.to}` : ""
    }`;
  }
  if (tab.type === "journal") return "Journal";
  if (tab.type === "prayers") return "Prayers";
  if (tab.type === "plans") return "Plans";
  if (tab.type === "notes") return "Notes";
  if (tab.type === "topics") return "Topics";
  if (tab.type === "settings") return "Settings";
  if (tab.type === "launcher") return "New tab";
  if (tab.type === "dashboard") return "Today";
  if (tab.type === "tools") return "Tools";
  if (tab.type === "bookexplorer") return "The Canon";
  if (tab.type === "harmony") {
    return tab.book !== undefined
      ? `Harmony: ${getBook(tab.book)?.name ?? tab.book} ${tab.chapter}:${tab.verse}`
      : "Gospel Harmony";
  }
  if (tab.type === "wisdomexplorer") {
    return tab.book === "psalms" ? "Psalms Explorer" : "Proverbs Explorer";
  }
  if (tab.type === "media") return "Media";
  return tab.entryId ? `Lexicon ${tab.entryId}` : "Lexicon";
}

/** Translates a dropped payload into the matching workspace action. */
function dispatchDrop(
  e: ReactDragEvent,
  target: DropTarget,
  dispatch: Dispatch<WorkspaceAction>,
  lexiconId: string | null
) {
  const paneTab = readPayload<{ paneId: string; tabId: string }>(e, DND.paneTab);
  if (paneTab) {
    dispatch({ type: "moveTab", fromPaneId: paneTab.paneId, tabId: paneTab.tabId, target });
    return;
  }
  const dockTool = readPayload<{ dock: DockTab }>(e, DND.dockTool);
  if (dockTool) {
    const tab = toolTabForDock(dockTool.dock, lexiconId);
    if (tab) dispatch({ type: "openTab", tab, target });
    return;
  }
  const chapter = readPayload<{ book: string; chapter: number }>(e, DND.chapter);
  if (chapter && typeof chapter.book === "string") {
    dispatch({ type: "openTab", tab: readerTab(chapter.book, chapter.chapter), target });
    return;
  }
  if (readPayload(e, DND.libraryLexicon)) {
    dispatch({ type: "openTab", tab: lexiconTab(), target });
  }
}

/** Clears an indicator when a drag ends anywhere, even outside a target. */
function useDragEndReset(reset: () => void) {
  const ref = useRef(reset);
  ref.current = reset;
  useEffect(() => {
    const fn = () => ref.current();
    window.addEventListener("dragend", fn);
    return () => window.removeEventListener("dragend", fn);
  }, []);
}

/**
 * The link-set badge: a quiet chip in the pane header wearing the pane's
 * letter, or a chain glyph when unlinked. The menu offers the three sets and
 * no link; panes sharing a letter navigate and scroll together.
 */
function LinkSetBadge({ paneId, linkSet }: { paneId: string; linkSet: LinkSet | null }) {
  const { dispatch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        playSound("close");
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("close");
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (set: LinkSet | null) => {
    /* Arming a set switches it on; "No link" switches it off. */
    if (set !== linkSet) playSound(set ? "toggle-on" : "toggle-off");
    dispatch({ type: "setLinkSet", paneId, linkSet: set });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        title={
          linkSet
            ? `Link set ${linkSet}: panes in a set move together`
            : "Link this pane with others"
        }
        aria-label={linkSet ? `Link set ${linkSet}` : "Link this pane with others"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          playSound(open ? "close" : "open");
          setOpen((v) => !v);
        }}
        className={`fx-press flex h-5 min-w-5 items-center justify-center border px-1 text-[0.62rem] leading-none font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
          linkSet ? "border-sapphire text-sapphire" : "border-rule text-muted hover:text-ink"
        }`}
      >
        {linkSet ?? <LinkIcon />}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Link set"
          style={{ "--fx-origin": "100% 0" } as CSSProperties}
          className="glass fx-scale absolute top-full right-0 z-30 mt-1 w-32 py-0.5"
        >
          {LINK_SETS.map((set) => (
            <button
              key={set}
              type="button"
              role="menuitemradio"
              aria-checked={linkSet === set}
              onClick={() => choose(set)}
              className={`flex w-full items-center gap-2 px-2.5 py-1 text-left text-[0.68rem] hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                linkSet === set ? "text-sapphire" : "text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-3.5 w-3.5 items-center justify-center border text-[0.58rem] leading-none font-semibold ${
                  linkSet === set ? "border-sapphire" : "border-rule text-muted"
                }`}
              >
                {set}
              </span>
              Set {set}
            </button>
          ))}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={linkSet === null}
            onClick={() => choose(null)}
            className={`mt-0.5 flex w-full items-center gap-2 border-t border-rule px-2.5 py-1 text-left text-[0.68rem] hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
              linkSet === null ? "text-sapphire" : "text-muted"
            }`}
          >
            No link
          </button>
        </div>
      )}
    </div>
  );
}

function Pane({ leaf }: { leaf: LeafNode }) {
  const { state, dispatch } = useWorkspace();
  const isActive = state.activePaneId === leaf.id;
  const panes = countLeaves(state.root);
  const activeTab = leaf.tabs.find((t) => t.id === leaf.activeTabId) ?? null;
  /* The strip's live labels: a rename written in any pane re-renders the
   * strip, and tabLabel reads the new name. */
  useCollectionWrites(TITLE_SOURCES);

  /* Drop indicators: an insertion index on the strip, a tint or split
   * preview on the body. Both reset on drop, dragleave, and any dragend. */
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [bodyHint, setBodyHint] = useState<"body" | "left" | "right" | "top" | "bottom" | null>(
    null
  );
  const stripDepth = useRef(0);
  const bodyDepth = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  useDragEndReset(() => {
    setInsertAt(null);
    setBodyHint(null);
    stripDepth.current = 0;
    bodyDepth.current = 0;
  });

  /* The insertion index under the pointer; strip background means append. */
  const stripIndexFrom = (e: ReactDragEvent): number => {
    const el = (e.target as HTMLElement).closest("[data-tab-index]");
    if (!(el instanceof HTMLElement)) return leaf.tabs.length;
    const i = Number(el.dataset.tabIndex);
    const r = el.getBoundingClientRect();
    return e.clientX > r.left + r.width / 2 ? i + 1 : i;
  };

  /* Edge zones open a split. A dragged pane tab may free a slot, so the
   * zones stay open at MAX_PANES for pane drags; the reducer decides. */
  const bodyTargetFrom = (e: ReactDragEvent): DropTarget => {
    const rect = bodyRef.current?.getBoundingClientRect();
    const splitsOpen = panes < MAX_PANES || e.dataTransfer.types.includes(DND.paneTab);
    const edge = rect && splitsOpen ? edgeAtPoint(e.clientX, e.clientY, rect) : null;
    return edge ? { kind: "edge", paneId: leaf.id, edge } : { kind: "body", paneId: leaf.id };
  };

  return (
    <section
      aria-label="Pane"
      aria-current={isActive ? "true" : undefined}
      onPointerDown={() => {
        if (!isActive) dispatch({ type: "activatePane", paneId: leaf.id });
      }}
      className={`ws-pane fx-pane-enter flex h-full min-h-0 flex-col border bg-surface ${
        isActive ? "border-ink/25" : "border-rule"
      }`}
    >
      <div
        className={`flex h-9 shrink-0 items-stretch border-b border-rule bg-surface ${
          isActive ? "shadow-[inset_0_2px_0_var(--stained-amber)]" : ""
        }`}
      >
        <div
          role="tablist"
          aria-label="Pane tabs"
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
          onDragEnter={(e) => {
            if (!hasGridPayload(e)) return;
            e.preventDefault();
            stripDepth.current += 1;
            setInsertAt(stripIndexFrom(e));
          }}
          onDragOver={(e) => {
            if (!hasGridPayload(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setInsertAt(stripIndexFrom(e));
          }}
          onDragLeave={() => {
            stripDepth.current = Math.max(0, stripDepth.current - 1);
            if (stripDepth.current === 0) setInsertAt(null);
          }}
          onDrop={(e) => {
            if (!hasGridPayload(e)) return;
            e.preventDefault();
            const index = stripIndexFrom(e);
            stripDepth.current = 0;
            setInsertAt(null);
            dispatchDrop(e, { kind: "strip", paneId: leaf.id, index }, dispatch, state.lexiconId);
            /* A dropped tab walks to its new place; anything else opens here,
             * and the switchboard chimes that openTab itself. */
            if (e.dataTransfer.types.includes(DND.paneTab)) playSound("navigate");
          }}
        >
          {leaf.tabs.map((tab, i) => {
            const tabActive = tab.id === leaf.activeTabId;
            const label = tabLabel(tab);
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={tabActive}
                tabIndex={0}
                data-tab-index={i}
                draggable
                onDragStart={(e) => {
                  const tool = dockTabForTab(tab);
                  startModuleDrag(
                    e,
                    DND.paneTab,
                    { paneId: leaf.id, tabId: tab.id },
                    label,
                    tool ? { [DND.paneToolTab]: { paneId: leaf.id, tabId: tab.id } } : {}
                  );
                }}
                onClick={() => {
                  if (!tabActive) playSound("navigate");
                  dispatch({ type: "activateTab", paneId: leaf.id, tabId: tab.id });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!tabActive) playSound("navigate");
                    dispatch({ type: "activateTab", paneId: leaf.id, tabId: tab.id });
                  }
                }}
                className={`group relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-rule px-3 text-[0.78rem] whitespace-nowrap transition-colors select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                  tabActive
                    ? "bg-paper font-medium text-ink shadow-[inset_0_2px_0_var(--stained-sapphire)]"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                {insertAt === i && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 left-0 w-0.5 bg-amber shadow-[0_0_6px_color-mix(in_srgb,var(--stained-amber)_75%,transparent)]"
                  />
                )}
                <span>{label}</span>
                <button
                  type="button"
                  aria-label={`Close ${label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "closeTab", paneId: leaf.id, tabId: tab.id });
                  }}
                  className={`fx-press px-0.5 text-[0.85rem] leading-none hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                    tabActive ? "text-muted" : "text-transparent group-hover:text-muted"
                  }`}
                >
                  ×
                </button>
              </div>
            );
          })}
          {insertAt !== null && insertAt >= leaf.tabs.length && leaf.tabs.length > 0 && (
            <span
              aria-hidden="true"
              className="my-1 w-0.5 shrink-0 bg-amber shadow-[0_0_6px_color-mix(in_srgb,var(--stained-amber)_75%,transparent)]"
            />
          )}
          <button
            type="button"
            title="New tab"
            onClick={() => {
              dispatch({ type: "newTab", paneId: leaf.id });
            }}
            className="fx-press shrink-0 px-2.5 text-[0.95rem] text-muted transition-colors hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            +
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 border-l border-rule px-1">
          <LinkSetBadge paneId={leaf.id} linkSet={leaf.linkSet} />
          <button
            type="button"
            title="Split right"
            disabled={panes >= MAX_PANES}
            onClick={() => {
              playSound("open");
              dispatch({ type: "splitPane", paneId: leaf.id, direction: "horizontal" });
            }}
            className="fx-press p-1 text-muted transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            <SplitHorizontalIcon />
          </button>
          <button
            type="button"
            title="Split down"
            disabled={panes >= MAX_PANES}
            onClick={() => {
              playSound("open");
              dispatch({ type: "splitPane", paneId: leaf.id, direction: "vertical" });
            }}
            className="fx-press p-1 text-muted transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            <SplitVerticalIcon />
          </button>
          <button
            type="button"
            title="Close pane"
            disabled={panes <= 1}
            onClick={() => {
              dispatch({ type: "closePane", paneId: leaf.id });
            }}
            className="fx-press px-1 text-[0.85rem] leading-none text-muted transition-colors hover:text-ruby disabled:opacity-30 disabled:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ×
          </button>
        </div>
      </div>
      <div
        ref={bodyRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        onDragEnter={(e) => {
          if (!hasGridPayload(e)) return;
          e.preventDefault();
          bodyDepth.current += 1;
          const t = bodyTargetFrom(e);
          setBodyHint(t.kind === "edge" ? t.edge : "body");
        }}
        onDragOver={(e) => {
          if (!hasGridPayload(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const t = bodyTargetFrom(e);
          setBodyHint(t.kind === "edge" ? t.edge : "body");
        }}
        onDragLeave={() => {
          bodyDepth.current = Math.max(0, bodyDepth.current - 1);
          if (bodyDepth.current === 0) setBodyHint(null);
        }}
        onDrop={(e) => {
          if (!hasGridPayload(e)) return;
          e.preventDefault();
          const target = bodyTargetFrom(e);
          bodyDepth.current = 0;
          setBodyHint(null);
          dispatchDrop(e, target, dispatch, state.lexiconId);
          /* A tab landing in a body walks there; a tab split opens a pane.
           * Both arrive as moveTab, which keeps silent at the switchboard;
           * anything else is an openTab and the switchboard chimes it. */
          if (e.dataTransfer.types.includes(DND.paneTab)) {
            playSound(target.kind === "body" ? "navigate" : "open");
          }
        }}
      >
        {/* Tab activation crossfade: keying on the live tab remounts the body
         * so the incoming view fades in (fx-fade); reader scroll already
         * resets on chapter change, so nothing is lost on the swap. */}
        <div key={activeTab?.id ?? "empty"} className="fx-fade h-full min-h-0">
        {activeTab ? (
          activeTab.type === "reader" ? (
            <ReaderPane
              paneId={leaf.id}
              book={activeTab.book}
              chapter={activeTab.chapter}
              translation={activeTab.translation}
              fontScale={activeTab.fontScale}
            />
          ) : activeTab.type === "search" ? (
            <SearchPane
              q={activeTab.q}
              mode={activeTab.mode ?? "bible"}
              paneId={leaf.id}
              tabId={activeTab.id}
            />
          ) : activeTab.type === "docsearch" ? (
            <DocSearchPane q={activeTab.q} />
          ) : activeTab.type === "bookssearch" ? (
            <BooksSearchPane q={activeTab.q} />
          ) : activeTab.type === "allsearch" ? (
            <AllSearchPane q={activeTab.q} />
          ) : activeTab.type === "guide" ? (
            <div className="h-full overflow-y-auto p-4">
              <PassageGuide book={activeTab.book} chapter={activeTab.chapter} />
            </div>
          ) : activeTab.type === "customguide" ? (
            <div className="h-full overflow-y-auto p-4">
              <CustomGuidePane
                guideId={activeTab.guideId}
                book={activeTab.book}
                chapter={activeTab.chapter}
              />
            </div>
          ) : activeTab.type === "guideeditor" ? (
            <div className="h-full overflow-y-auto p-4">
              <GuideEditorPane guideId={activeTab.guideId} />
            </div>
          ) : activeTab.type === "workflow" ? (
            <div className="h-full overflow-y-auto p-4">
              <WorkflowPane runId={activeTab.runId} />
            </div>
          ) : activeTab.type === "workfloweditor" ? (
            <div className="h-full overflow-y-auto p-4">
              <WorkflowEditorPane workflowId={activeTab.workflowId} />
            </div>
          ) : activeTab.type === "wordstudy" ? (
            <div className="h-full overflow-y-auto p-4">
              <WordStudyGuide strongsId={activeTab.strongsId} />
            </div>
          ) : activeTab.type === "exegetical" ? (
            <div className="h-full overflow-y-auto p-4">
              <ExegeticalGuide book={activeTab.book} chapter={activeTab.chapter} />
            </div>
          ) : activeTab.type === "sermonstarter" ? (
            <div className="h-full overflow-y-auto p-4">
              <SermonStarterPane book={activeTab.book} chapter={activeTab.chapter} />
            </div>
          ) : activeTab.type === "topicguide" ? (
            <div className="h-full overflow-y-auto p-4">
              <TopicGuide work={activeTab.work} topicId={activeTab.topicId} />
            </div>
          ) : activeTab.type === "listdoc" ? (
            <div className="h-full overflow-y-auto p-4">
              <ListDocPane docId={activeTab.docId} />
            </div>
          ) : activeTab.type === "canvasdoc" ? (
            /* The canvas is a surface, not a scroll page: it fills the pane
             * and handles its own pan and zoom. */
            <CanvasPane canvasId={activeTab.canvasId} />
          ) : activeTab.type === "diagram" ? (
            <div className="h-full overflow-y-auto p-4">
              <DiagramPane diagramId={activeTab.diagramId} />
            </div>
          ) : activeTab.type === "desk" ? (
            <div className="h-full overflow-y-auto p-4">
              <DeskPane />
            </div>
          ) : activeTab.type === "manuscript" ? (
            <div className="h-full overflow-y-auto p-4">
              <ManuscriptPane docId={activeTab.docId} />
            </div>
          ) : activeTab.type === "personalbook" ? (
            <div className="h-full overflow-y-auto p-4">
              <PersonalBookPane
                paneId={leaf.id}
                tabId={activeTab.id}
                bookId={activeTab.bookId}
                session={activeTab.session}
                of={activeTab.of}
              />
            </div>
          ) : activeTab.type === "pulpit" ? (
            <div className="h-full overflow-y-auto p-4">
              <PulpitPane />
            </div>
          ) : activeTab.type === "project" ? (
            <div className="h-full overflow-y-auto p-4">
              <ProjectPane projectId={activeTab.projectId} />
            </div>
          ) : activeTab.type === "chapel" ? (
            <div className="h-full overflow-y-auto p-4">
              <ChapelPane />
            </div>
          ) : activeTab.type === "service" ? (
            <div className="h-full overflow-y-auto p-4">
              <ServicePane serviceId={activeTab.serviceId} />
            </div>
          ) : activeTab.type === "almanac" ? (
            <div className="h-full overflow-y-auto p-4">
              <AlmanacPane />
            </div>
          ) : activeTab.type === "factbook" ? (
            <div className="h-full overflow-y-auto p-4">
              <Factbook entityId={activeTab.entityId} />
            </div>
          ) : activeTab.type === "familymap" ? (
            <div className="h-full overflow-auto p-4">
              <FamilyMapPane entityId={activeTab.entityId} />
            </div>
          ) : activeTab.type === "library" ? (
            <div className="h-full overflow-y-auto p-4">
              <LibraryPane />
            </div>
          ) : activeTab.type === "multiview" ? (
            /* Like the canvas, the view owns its scrolling: the shared
             * mode's single grid container must be the scroll element. */
            <MultiviewPane
              paneId={leaf.id}
              tabId={activeTab.id}
              book={activeTab.book}
              chapter={activeTab.chapter}
              texts={activeTab.texts}
            />
          ) : activeTab.type === "textcompare" ? (
            <div className="h-full overflow-y-auto p-4">
              <TextCompare
                paneId={leaf.id}
                tabId={activeTab.id}
                book={activeTab.book}
                chapter={activeTab.chapter}
                base={activeTab.base}
              />
            </div>
          ) : activeTab.type === "concordance" ? (
            <div className="h-full overflow-y-auto p-4">
              <ConcordancePane paneId={leaf.id} tabId={activeTab.id} book={activeTab.book} />
            </div>
          ) : activeTab.type === "atlas" ? (
            <div className="h-full overflow-y-auto p-4">
              <AtlasPane place={activeTab.place} />
            </div>
          ) : activeTab.type === "timeline" ? (
            <div className="h-full overflow-y-auto p-4">
              <TimelinePane event={activeTab.event} />
            </div>
          ) : activeTab.type === "memory" ? (
            <div className="h-full overflow-y-auto p-4">
              <MemoryPane passageId={activeTab.passageId} />
            </div>
          ) : activeTab.type === "journal" ? (
            <div className="h-full overflow-y-auto p-4">
              <JournalPane />
            </div>
          ) : activeTab.type === "prayers" ? (
            <div className="h-full overflow-y-auto p-4">
              <PrayersPane />
            </div>
          ) : activeTab.type === "plans" ? (
            <div className="h-full overflow-y-auto p-4">
              <PlansPane />
            </div>
          ) : activeTab.type === "notes" ? (
            /* The browser owns its layout: the facet sidebar and the list
             * scroll on their own inside the pane. */
            <NotesPane />
          ) : activeTab.type === "topics" ? (
            <div className="h-full overflow-y-auto p-4">
              <TopicsPane />
            </div>
          ) : activeTab.type === "settings" ? (
            <div className="h-full overflow-y-auto p-4">
              <SettingsPane />
            </div>
          ) : activeTab.type === "launcher" ? (
            <div className="h-full overflow-y-auto p-4">
              <LauncherPane paneId={leaf.id} tab={activeTab} />
            </div>
          ) : activeTab.type === "dashboard" ? (
            <div className="h-full overflow-y-auto p-4">
              <DashboardPane />
            </div>
          ) : activeTab.type === "tools" ? (
            <div className="h-full overflow-y-auto p-4">
              <ToolsPane paneId={leaf.id} />
            </div>
          ) : activeTab.type === "bookexplorer" ? (
            <div className="h-full overflow-y-auto p-4">
              <BookExplorerPane />
            </div>
          ) : activeTab.type === "harmony" ? (
            /* Like the multiview, the pane owns its scrolling: the columns
             * share a single scroll container. */
            <HarmonyPane
              paneId={leaf.id}
              tabId={activeTab.id}
              book={activeTab.book}
              chapter={activeTab.chapter}
              verse={activeTab.verse}
            />
          ) : activeTab.type === "wisdomexplorer" ? (
            <div className="h-full overflow-y-auto p-4">
              <WisdomExplorerPane paneId={leaf.id} tabId={activeTab.id} book={activeTab.book} />
            </div>
          ) : activeTab.type === "media" ? (
            <div className="h-full overflow-y-auto p-4">
              <MediaPane
                book={activeTab.book}
                chapter={activeTab.chapter}
                verse={activeTab.verse}
              />
            </div>
          ) : (
            <ToolTabBody paneId={leaf.id} tab={activeTab} />
          )
        ) : (
          <EmptyPane paneId={leaf.id} />
        )}
        </div>
        {bodyHint === "body" && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 border-2 border-amber/60 bg-amber/5 shadow-[inset_0_0_28px_color-mix(in_srgb,var(--stained-amber)_16%,transparent)]"
          />
        )}
        {bodyHint !== null && bodyHint !== "body" && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute z-10 bg-amber/10 shadow-[inset_0_0_24px_color-mix(in_srgb,var(--stained-amber)_20%,transparent)] ${
              bodyHint === "left"
                ? "inset-y-0 left-0 w-1/4 border-r-2 border-amber/70"
                : bodyHint === "right"
                  ? "inset-y-0 right-0 w-1/4 border-l-2 border-amber/70"
                  : bodyHint === "top"
                    ? "inset-x-0 top-0 h-1/4 border-b-2 border-amber/70"
                    : "inset-x-0 bottom-0 h-1/4 border-t-2 border-amber/70"
            }`}
          />
        )}
      </div>
    </section>
  );
}

function EmptyPane({ paneId }: { paneId: string }) {
  const { dispatch } = useWorkspace();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="max-w-[26ch] text-xs leading-relaxed text-muted">
        No passage open. Choose a chapter in the Read tree, or press Ctrl+K.
      </p>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: "openRef", book: "genesis", chapter: 1, paneId });
        }}
        className="glass glass-hover fx-press px-3 py-1.5 text-xs text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Open Genesis 1
      </button>
    </div>
  );
}
