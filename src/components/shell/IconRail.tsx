"use client";

import type { ComponentType } from "react";
import { playSound } from "@/lib/sound";
import LayoutMenu from "./LayoutMenu";
import { useWorkspace } from "./WorkspaceContext";
import type { RailMode } from "./workspace-state";
import {
  AlmanacIcon,
  DocumentsIcon,
  LibraryIcon,
  PresetReadingIcon,
  PresetStudyIcon,
  ReadIcon,
  SearchIcon,
  SettingsIcon,
  StudyIcon,
} from "./icons";

const RAIL_ITEMS: { mode: RailMode; label: string; icon: ComponentType }[] = [
  { mode: "read", label: "Read", icon: ReadIcon },
  { mode: "study", label: "Study", icon: StudyIcon },
  { mode: "search", label: "Search", icon: SearchIcon },
  { mode: "library", label: "Library", icon: LibraryIcon },
  { mode: "documents", label: "Docs", icon: DocumentsIcon },
  { mode: "almanac", label: "Almanac", icon: AlmanacIcon },
  { mode: "settings", label: "Settings", icon: SettingsIcon },
];

/**
 * The icon rail: one column of modes that drives the sidebar, with the
 * layout presets and the layouts menu at its foot. Clicking the active
 * mode collapses the sidebar, the way an activity bar behaves. The rail is
 * a glass strip over the ambient wash; a pick answers with a single struck
 * note, a collapse with the falling figure.
 */
export default function IconRail() {
  const { state, dispatch } = useWorkspace();

  return (
    <nav
      aria-label="Workspace modes"
      className="ws-rail glass flex w-12 shrink-0 flex-col items-stretch"
    >
      <div className="ws-rail-modes flex flex-1 flex-col">
        {RAIL_ITEMS.map(({ mode, label, icon: ItemIcon }) => {
          const active = state.railMode === mode && state.sidebarOpen;
          return (
            <button
              key={mode}
              type="button"
              title={label}
              aria-pressed={active}
              onClick={() => {
                const collapse = state.railMode === mode && state.sidebarOpen;
                playSound(collapse ? "close" : "navigate");
                dispatch(
                  collapse ? { type: "toggleSidebar" } : { type: "setRailMode", mode }
                );
              }}
              className={`fx-press flex h-12 flex-col items-center justify-center gap-0.5 border-l-2 text-[0.55rem] font-medium tracking-wide uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                active
                  ? "border-sapphire bg-paper text-sapphire"
                  : "border-transparent text-muted hover:bg-paper hover:text-ink"
              }`}
            >
              <ItemIcon />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="ws-rail-foot flex flex-col border-t border-rule">
        <button
          type="button"
          title="Preset: Reading — one pane, dock closed"
          onClick={() => {
            playSound("navigate");
            dispatch({ type: "applyPreset", preset: "reading" });
          }}
          className="fx-press flex h-12 flex-col items-center justify-center gap-0.5 text-[0.55rem] font-medium tracking-wide uppercase text-muted hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          <PresetReadingIcon />
          <span>Reading</span>
        </button>
        <button
          type="button"
          title="Preset: Study — two panes side by side, commentary at hand"
          onClick={() => {
            playSound("navigate");
            dispatch({ type: "applyPreset", preset: "study" });
          }}
          className="fx-press flex h-12 flex-col items-center justify-center gap-0.5 text-[0.55rem] font-medium tracking-wide uppercase text-muted hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          <PresetStudyIcon />
          <span>Study</span>
        </button>
        <LayoutMenu />
      </div>
    </nav>
  );
}
