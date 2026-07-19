"use client";

import { collection, type Record_ } from "@/lib/store";
import { sanitizeWorkspace, type WorkspaceState } from "./workspace-state";

/**
 * Named layouts: the user-saved half of the Logos layouts mechanic, beside
 * the built-in presets (LAYOUT_PRESETS in ./workspace-state.ts). A layout
 * captures everything the continuous session save persists: the pane tree,
 * the active ids, the rail mode, the dock state and tray order, the link
 * sets. All of it goes under a name the user gives it. The transient
 * selection never rides along, mirroring saveWorkspace. Restoring sanitizes the snapshot
 * through the same path the session load uses and hydrates the workspace,
 * so the normal save effect persists the restored state from there. The
 * sync envelope rides along from day one as everywhere.
 */

export interface SavedLayout extends Record_ {
  name: string;
  /** The workspace snapshot, minus the transient selection. */
  state: WorkspaceState;
}

const layouts = collection<SavedLayout>("berean.layouts.v1");
export { layouts };

/** Captures the workspace as it stands under a user-given name. */
export function saveLayout(name: string, state: WorkspaceState): SavedLayout {
  return layouts.create({ name, state: { ...state, selection: null } });
}

/** Saves the workspace as it stands over an existing named layout. */
export function updateLayout(id: string, state: WorkspaceState) {
  return layouts.update(id, { state: { ...state, selection: null } });
}

/** The state a layout restores to; null when the snapshot is beyond repair. */
export function layoutState(layout: SavedLayout): WorkspaceState | null {
  return sanitizeWorkspace(layout.state);
}
