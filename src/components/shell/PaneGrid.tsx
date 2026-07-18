"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { getBook } from "@/lib/canon";
import { useWorkspace } from "./WorkspaceContext";
import {
  countLeaves,
  MAX_PANES,
  type LeafNode,
  type PaneNode,
  type SplitNode,
} from "./workspace-state";
import ReaderPane from "./ReaderPane";
import { SplitHorizontalIcon, SplitVerticalIcon } from "./icons";

/**
 * The center pane grid: renders the split tree recursively. Leaves are
 * tabbed panes; splits carry a draggable divider. Clicking anywhere in a
 * pane makes it the target for navigation.
 */
export default function PaneGrid() {
  const { state } = useWorkspace();
  return (
    <div className="h-full min-h-0 w-full bg-paper p-1.5">
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
    <div ref={containerRef} className={`flex h-full min-h-0 w-full ${horizontal ? "" : "flex-col"}`}>
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
        className={`shrink-0 touch-none bg-transparent transition-colors hover:bg-sapphire/40 ${
          horizontal ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"
        }`}
      />
      <div className="min-h-0 min-w-0 flex-1">
        <NodeView node={split.children[1]} />
      </div>
    </div>
  );
}

function Pane({ leaf }: { leaf: LeafNode }) {
  const { state, dispatch } = useWorkspace();
  const isActive = state.activePaneId === leaf.id;
  const panes = countLeaves(state.root);
  const activeTab = leaf.tabs.find((t) => t.id === leaf.activeTabId) ?? null;

  return (
    <section
      aria-label="Pane"
      aria-current={isActive ? "true" : undefined}
      onPointerDown={() => {
        if (!isActive) dispatch({ type: "activatePane", paneId: leaf.id });
      }}
      className={`flex h-full min-h-0 flex-col border bg-surface ${
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
        >
          {leaf.tabs.map((tab) => {
            const book = getBook(tab.book);
            const tabActive = tab.id === leaf.activeTabId;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={tabActive}
                tabIndex={0}
                onClick={() => dispatch({ type: "activateTab", paneId: leaf.id, tabId: tab.id })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    dispatch({ type: "activateTab", paneId: leaf.id, tabId: tab.id });
                  }
                }}
                className={`group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-rule px-3 text-[0.78rem] whitespace-nowrap select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                  tabActive
                    ? "bg-paper font-medium text-ink shadow-[inset_0_2px_0_var(--stained-sapphire)]"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                <span>
                  {book?.name ?? tab.book} {tab.chapter}
                </span>
                <button
                  type="button"
                  aria-label={`Close ${book?.name ?? tab.book} ${tab.chapter}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "closeTab", paneId: leaf.id, tabId: tab.id });
                  }}
                  className={`px-0.5 text-[0.85rem] leading-none hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                    tabActive ? "text-muted" : "text-transparent group-hover:text-muted"
                  }`}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            title="New tab"
            onClick={() => dispatch({ type: "newTab", paneId: leaf.id })}
            className="shrink-0 px-2.5 text-[0.95rem] text-muted hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            +
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 border-l border-rule px-1">
          <button
            type="button"
            title="Split right"
            disabled={panes >= MAX_PANES}
            onClick={() => dispatch({ type: "splitPane", paneId: leaf.id, direction: "horizontal" })}
            className="p-1 text-muted hover:text-ink disabled:opacity-30 disabled:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            <SplitHorizontalIcon />
          </button>
          <button
            type="button"
            title="Split down"
            disabled={panes >= MAX_PANES}
            onClick={() => dispatch({ type: "splitPane", paneId: leaf.id, direction: "vertical" })}
            className="p-1 text-muted hover:text-ink disabled:opacity-30 disabled:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            <SplitVerticalIcon />
          </button>
          <button
            type="button"
            title="Close pane"
            disabled={panes <= 1}
            onClick={() => dispatch({ type: "closePane", paneId: leaf.id })}
            className="px-1 text-[0.85rem] leading-none text-muted hover:text-ruby disabled:opacity-30 disabled:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ×
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab ? (
          <ReaderPane paneId={leaf.id} book={activeTab.book} chapter={activeTab.chapter} />
        ) : (
          <EmptyPane paneId={leaf.id} />
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
        onClick={() => dispatch({ type: "openRef", book: "genesis", chapter: 1, paneId })}
        className="border border-rule bg-paper px-3 py-1.5 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Open Genesis 1
      </button>
    </div>
  );
}
