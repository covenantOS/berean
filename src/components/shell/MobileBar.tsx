"use client";

import type { ComponentType } from "react";
import { playSound } from "@/lib/sound";
import { useWorkspace } from "./WorkspaceContext";
import { usePhoneViewport } from "./viewport";
import { findLeaf, type RailMode } from "./workspace-state";
import { AlmanacIcon, LibraryIcon, ReadIcon, SearchIcon, SettingsIcon } from "./icons";

type Destination =
  | { kind: "sheet"; mode: RailMode; label: string; hint: string; icon: ComponentType }
  | {
      kind: "tab";
      tab: "dashboard" | "library";
      label: string;
      hint: string;
      icon: ComponentType;
      action: "openDashboard" | "openLibrary";
    };

const DESTINATIONS: Destination[] = [
  { kind: "sheet", mode: "read", label: "Read", hint: "The canon tree", icon: ReadIcon },
  { kind: "sheet", mode: "search", label: "Search", hint: "Run a search", icon: SearchIcon },
  {
    kind: "tab",
    tab: "dashboard",
    label: "Today",
    hint: "The day's dashboard",
    icon: AlmanacIcon,
    action: "openDashboard",
  },
  {
    kind: "tab",
    tab: "library",
    label: "Library",
    hint: "Your books",
    icon: LibraryIcon,
    action: "openLibrary",
  },
  { kind: "sheet", mode: "settings", label: "More", hint: "Settings and program options", icon: SettingsIcon },
];

/**
 * The phone's bottom bar: five plain destinations in place of the desktop
 * rail. Read, Search, and More open the sidebar's panels as full-screen
 * sheets, tapping the open one again closes it; Today and Library land
 * their tab in the pane in front. Rendered only below the phone breakpoint
 * (the grid, rail, and sheets all key on the same width); the desktop rail
 * carries those widths unchanged.
 */
export default function MobileBar() {
  const { state, dispatch } = useWorkspace();
  const phone = usePhoneViewport();

  const activeLeaf = findLeaf(state.root, state.activePaneId);
  const activeTab = activeLeaf?.tabs.find((t) => t.id === activeLeaf.activeTabId) ?? null;

  if (!phone) return null;

  return (
    <nav aria-label="Workspace destinations" className="ws-mobilebar glass flex">
      {DESTINATIONS.map((dest) => {
        const DestIcon = dest.icon;
        const active =
          dest.kind === "sheet"
            ? state.sidebarOpen && state.railMode === dest.mode
            : activeTab?.type === dest.tab;
        return (
          <button
            key={dest.label}
            type="button"
            title={dest.hint}
            {...(dest.kind === "sheet"
              ? { "aria-pressed": active }
              : { "aria-current": active ? ("page" as const) : undefined })}
            onClick={() => {
              if (dest.kind === "tab") {
                /* The open* family chimes at the switchboard itself. */
                dispatch({ type: dest.action });
                return;
              }
              const collapse = state.railMode === dest.mode && state.sidebarOpen;
              playSound(collapse ? "close" : "navigate");
              dispatch(
                collapse ? { type: "toggleSidebar" } : { type: "setRailMode", mode: dest.mode }
              );
            }}
            className={`fx-press flex h-12 flex-1 flex-col items-center justify-center gap-0.5 border-t-2 text-[0.55rem] font-medium tracking-wide uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
              active
                ? "border-sapphire bg-paper text-sapphire"
                : "border-transparent text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <DestIcon />
            <span>{dest.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
