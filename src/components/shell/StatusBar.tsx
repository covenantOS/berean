"use client";

import { useEffect, useState } from "react";
import { getBook } from "@/lib/canon";
import { configuredTransport, lastSyncedAt, SYNCED_EVENT } from "@/lib/sync";
import { useWorkspace } from "./WorkspaceContext";
import { countLeaves, findLeaf, paneRef } from "./workspace-state";

/** The sync slot's short relative stamp: "moments ago", "5m ago", "2h ago",
 *  then the date once the day turns. */
function ago(iso: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The status bar: where you are, in which text, and the sync state. Without
 * the sync flag the state reads "Local only" as it always has; with it, the
 * slot carries this device's last completed sync and follows new ones
 * through the event markSynced raises.
 */
export default function StatusBar() {
  const { state } = useWorkspace();
  const leaf = findLeaf(state.root, state.activePaneId);
  const ref = leaf ? paneRef(leaf) : null;
  const book = ref ? getBook(ref.book) : undefined;
  const panes = countLeaves(state.root);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    setSyncEnabled(configuredTransport() !== null);
    const refresh = () => setLast(lastSyncedAt());
    refresh();
    window.addEventListener(SYNCED_EVENT, refresh);
    return () => window.removeEventListener(SYNCED_EVENT, refresh);
  }, []);

  return (
    <footer className="ws-status glass flex h-7 shrink-0 items-center justify-between px-3 text-[0.7rem] text-muted">
      <span
        key={book && ref ? `${ref.book}-${ref.chapter}` : "none"}
        className="fx-fade small-caps font-semibold text-ink"
      >
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
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-emerald" />
          {syncEnabled ? (last ? `Synced ${ago(last)}` : "Sync ready") : "Local only"}
        </span>
      </span>
    </footer>
  );
}
