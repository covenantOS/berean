"use client";

import type { ComponentType } from "react";
import { useWorkspace } from "./WorkspaceContext";
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

/**
 * The right dock: tool tabs answering the selection. Commentary, Lexicon,
 * and Cross-refs are live over the passage in focus; the Scribe lands in a
 * later phase.
 */
export default function RightDock() {
  const { state, dispatch } = useWorkspace();

  if (!state.dockOpen) {
    return (
      <div className="flex w-8 shrink-0 flex-col items-center gap-1 border-l border-rule bg-surface py-2">
        {DOCK_ITEMS.map(({ tab, label, icon: TabIcon }) => (
          <button
            key={tab}
            type="button"
            title={`Open ${label}`}
            onClick={() => dispatch({ type: "setDockTab", tab })}
            className="p-1 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            <TabIcon />
          </button>
        ))}
      </div>
    );
  }

  return (
    <aside
      aria-label="Tools"
      className="flex w-80 shrink-0 flex-col border-l border-rule bg-surface"
    >
      <div className="flex h-9 shrink-0 items-stretch border-b border-rule">
        <div role="tablist" aria-label="Dock tools" className="flex min-w-0 flex-1 items-stretch">
          {DOCK_ITEMS.map(({ tab, label }) => {
            const tabActive = state.dockTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={tabActive}
                onClick={() => dispatch({ type: "setDockTab", tab })}
                className={`flex-1 border-r border-rule px-1 text-[0.66rem] font-medium tracking-wide uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                  tabActive
                    ? "bg-paper text-sapphire shadow-[inset_0_2px_0_var(--stained-sapphire)]"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
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
