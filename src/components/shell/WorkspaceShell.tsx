"use client";

import Omnibox from "@/components/palette/Omnibox";
import DeepLinkIntake from "./DeepLinkIntake";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import IconRail from "./IconRail";
import Sidebar from "./Sidebar";
import PaneGrid from "./PaneGrid";
import RightDock from "./RightDock";
import StatusBar from "./StatusBar";
import WelcomeOverlay from "./WelcomeOverlay";

/**
 * The workspace shell: rail, sidebar, pane grid, dock, status bar. No
 * website chrome — the root layout's header and footer are hidden for this
 * route by an additive rule in globals.css (body:has(> main >
 * .workspace-shell)), so the existing site is untouched. The command
 * omnibox mounts once here and listens for Ctrl/Cmd+K and
 * berean:omnibox-toggle itself; the shell answers its events. DeepLinkIntake
 * reads a deep-link URL (?ref=, ?tab=) once on load and dispatches it into
 * the restored session. The welcome overlay mounts with the frame and answers
 * a first run (src/lib/onboarding.ts) or the Settings pane's Welcome row.
 */
export default function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <DeepLinkIntake />
      <ShellFrame />
      <Omnibox />
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
      <WelcomeOverlay />
    </div>
  );
}
