"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type DragEvent as ReactDragEvent,
} from "react";
import { useWorkspace } from "./WorkspaceContext";
import { DND, readPayload, startModuleDrag } from "./dnd";
import type { DockTab } from "./workspace-state";
import CommentaryDock from "./CommentaryDock";
import CrossRefsDock from "./CrossRefsDock";
import LexiconDock from "./LexiconDock";
import { CommentaryIcon, CrossRefsIcon, LexiconIcon, ScribeIcon } from "./icons";

const DOCK_ITEMS: { tab: DockTab; label: string; icon: ComponentType }[] = [
  { tab: "commentary", label: "Commentary", icon: CommentaryIcon },
  { tab: "lexicon", label: "Lexicon", icon: LexiconIcon },
  { tab: "crossrefs", label: "Cross-refs", icon: CrossRefsIcon },
  { tab: "scribe", label: "Scribe", icon: ScribeIcon },
];

const ITEM_BY_TAB = new Map(DOCK_ITEMS.map((item) => [item.tab, item]));

/**
 * The right dock: a tray of tool modules answering the selection. Tray tabs
 * drag into the grid to open as pane tabs and drag within the tray to
 * reorder; a tool tab dragged back from a pane returns to the tray. The
 * Scribe reorders but never leaves. Commentary, Lexicon, and Cross-refs are
 * live over the passage in focus; the Scribe lands in a later phase.
 */
export default function RightDock() {
  const { state, dispatch } = useWorkspace();
  const ordered = state.dockTabOrder
    .map((tab) => ITEM_BY_TAB.get(tab))
    .filter((item): item is (typeof DOCK_ITEMS)[number] => Boolean(item));

  /* Tray drop indicators: an insertion line for reorders, a tint for returns. */
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [returnHint, setReturnHint] = useState(false);
  const depth = useRef(0);
  useEffect(() => {
    const reset = () => {
      setInsertAt(null);
      setReturnHint(false);
      depth.current = 0;
    };
    window.addEventListener("dragend", reset);
    return () => window.removeEventListener("dragend", reset);
  }, []);

  const acceptsReorder = (e: ReactDragEvent) =>
    e.dataTransfer.types.includes(DND.dockTool) || e.dataTransfer.types.includes(DND.dockReorder);
  const acceptsReturn = (e: ReactDragEvent) => e.dataTransfer.types.includes(DND.paneToolTab);
  const accepts = (e: ReactDragEvent) => acceptsReorder(e) || acceptsReturn(e);

  const indexFrom = (e: ReactDragEvent, vertical: boolean): number => {
    const el = (e.target as HTMLElement).closest("[data-dock-index]");
    if (!(el instanceof HTMLElement)) return ordered.length;
    const i = Number(el.dataset.dockIndex);
    const r = el.getBoundingClientRect();
    const after = vertical ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    return after ? i + 1 : i;
  };

  const hintFrom = (e: ReactDragEvent, vertical: boolean) => {
    if (acceptsReorder(e)) {
      setReturnHint(false);
      setInsertAt(indexFrom(e, vertical));
    } else {
      setInsertAt(null);
      setReturnHint(true);
    }
  };

  const stripHandlers = (vertical: boolean) => ({
    onDragEnter: (e: ReactDragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      depth.current += 1;
      hintFrom(e, vertical);
    },
    onDragOver: (e: ReactDragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      hintFrom(e, vertical);
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) {
        setInsertAt(null);
        setReturnHint(false);
      }
    },
    onDrop: (e: ReactDragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      depth.current = 0;
      setInsertAt(null);
      setReturnHint(false);
      const paneTool = readPayload<{ paneId: string; tabId: string }>(e, DND.paneToolTab);
      if (paneTool) {
        dispatch({ type: "returnTabToDock", paneId: paneTool.paneId, tabId: paneTool.tabId });
        return;
      }
      const dragged =
        readPayload<{ dock: DockTab }>(e, DND.dockTool) ??
        readPayload<{ dock: DockTab }>(e, DND.dockReorder);
      if (!dragged) return;
      const from = state.dockTabOrder.indexOf(dragged.dock);
      if (from === -1) return;
      let index = indexFrom(e, vertical);
      if (index > from) index -= 1;
      const without = state.dockTabOrder.filter((t) => t !== dragged.dock);
      index = Math.min(Math.max(0, index), without.length);
      dispatch({
        type: "setDockTabOrder",
        order: [...without.slice(0, index), dragged.dock, ...without.slice(index)],
      });
    },
  });

  const dragTrayTab = (e: ReactDragEvent, tab: DockTab, label: string) =>
    startModuleDrag(e, tab === "scribe" ? DND.dockReorder : DND.dockTool, { dock: tab }, label);

  if (!state.dockOpen) {
    return (
      <div
        {...stripHandlers(true)}
        className={`flex w-8 shrink-0 flex-col items-center gap-1 border-l border-rule bg-surface py-2 ${
          returnHint ? "bg-amber/5 outline-2 -outline-offset-2 outline-amber/60" : ""
        }`}
      >
        {ordered.map(({ tab, label, icon: TabIcon }, i) => (
          <button
            key={tab}
            type="button"
            title={
              tab === "scribe"
                ? `Open ${label}; drag to reorder the tray`
                : `Open ${label}; drag to reorder, or into the workspace`
            }
            data-dock-index={i}
            draggable
            onDragStart={(e) => dragTrayTab(e, tab, label)}
            onClick={() => dispatch({ type: "setDockTab", tab })}
            className="relative p-1 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            {insertAt === i && (
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-amber" />
            )}
            <TabIcon />
          </button>
        ))}
        {insertAt === ordered.length && (
          <span aria-hidden="true" className="h-0.5 w-5 shrink-0 bg-amber" />
        )}
      </div>
    );
  }

  return (
    <aside
      aria-label="Tools"
      className="flex w-80 shrink-0 flex-col border-l border-rule bg-surface"
    >
      <div className="flex h-9 shrink-0 items-stretch border-b border-rule">
        <div
          role="tablist"
          aria-label="Dock tools"
          {...stripHandlers(false)}
          className={`flex min-w-0 flex-1 items-stretch ${
            returnHint ? "bg-amber/5 outline-2 -outline-offset-2 outline-amber/60" : ""
          }`}
        >
          {ordered.map(({ tab, label }, i) => {
            const tabActive = state.dockTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={tabActive}
                title={
                  tab === "scribe"
                    ? `${label}; drag to reorder the tray`
                    : `${label}; drag to reorder, or into the workspace`
                }
                data-dock-index={i}
                draggable
                onDragStart={(e) => dragTrayTab(e, tab, label)}
                onClick={() => dispatch({ type: "setDockTab", tab })}
                className={`relative flex-1 border-r border-rule px-1 text-[0.66rem] font-medium tracking-wide uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                  tabActive
                    ? "bg-paper text-sapphire shadow-[inset_0_2px_0_var(--stained-sapphire)]"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                {insertAt === i && (
                  <span aria-hidden="true" className="absolute inset-y-1 left-0 w-0.5 bg-amber" />
                )}
                {label}
              </button>
            );
          })}
          {insertAt === ordered.length && (
            <span aria-hidden="true" className="my-1 w-0.5 shrink-0 bg-amber" />
          )}
        </div>
        <button
          type="button"
          title="Collapse dock"
          onClick={() => dispatch({ type: "toggleDock" })}
          className="shrink-0 px-2 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          »
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {state.dockTab === "commentary" && <CommentaryDock />}
        {state.dockTab === "lexicon" && <LexiconDock />}
        {state.dockTab === "crossrefs" && <CrossRefsDock />}
        {state.dockTab === "scribe" && (
          <>
            <h3 className="font-editorial text-sm font-semibold">Scribe</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              The Scribe prepares the study; it never writes the sermon. Every citation is
              verified against the text server-side.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
