"use client";

import { getBook } from "@/lib/canon";
import { useWorkspace } from "./WorkspaceContext";
import { countLeaves, findLeaf, paneRef } from "./workspace-state";

/**
 * The status bar: where you are, in which text, and the sync state.
 * Phase 0 is device-local, so the sync state reads "Local only".
 */
export default function StatusBar() {
  const { state } = useWorkspace();
  const leaf = findLeaf(state.root, state.activePaneId);
  const ref = leaf ? paneRef(leaf) : null;
  const book = ref ? getBook(ref.book) : undefined;
  const panes = countLeaves(state.root);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-rule bg-surface px-3 text-[0.7rem] text-muted">
      <span className="small-caps font-semibold text-ink">
        {book && ref ? `${book.name} ${ref.chapter}` : "No passage"}
      </span>
      <span className="flex items-center gap-3">
        <span>
          {panes} {panes === 1 ? "pane" : "panes"}
        </span>
        <span aria-hidden="true" className="text-rule">
          |
        </span>
        <span>KJV</span>
        <span aria-hidden="true" className="text-rule">
          |
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-emerald" />
          Local only
        </span>
      </span>
    </footer>
  );
}
