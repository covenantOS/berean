"use client";

import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import IconRail from "./IconRail";
import Sidebar from "./Sidebar";
import PaneGrid from "./PaneGrid";
import RightDock from "./RightDock";
import StatusBar from "./StatusBar";

/**
 * The workspace shell: rail, sidebar, pane grid, dock, status bar. No
 * website chrome — the root layout's header and footer are hidden for this
 * route by an additive rule in globals.css (body:has(> main >
 * .workspace-shell)), so the existing site is untouched.
 */
export default function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <ShellFrame />
    </WorkspaceProvider>
  );
}

function ShellFrame() {
  const { state, hydrated } = useWorkspace();

  // Until the persisted session is restored, render only paper and the mark
  // so the previous layout never flashes in and out.
  if (!hydrated) {
    return (
      <div className="workspace-shell flex h-dvh items-center justify-center bg-paper">
        <span className="leaded-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      </div>
    );
  }

  return (
    <div className="workspace-shell flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <div className="flex min-h-0 flex-1">
        <IconRail />
        {state.sidebarOpen && <Sidebar />}
        <div className="min-w-0 flex-1">
          <PaneGrid />
        </div>
        <RightDock />
      </div>
      <StatusBar />
    </div>
  );
}
