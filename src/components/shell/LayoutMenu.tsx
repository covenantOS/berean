"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCollection } from "@/lib/hooks";
import { playSound } from "@/lib/sound";
import { LayoutsIcon } from "./icons";
import { layoutState, layouts, saveLayout, updateLayout, type SavedLayout } from "./layouts";
import { LAYOUT_PRESETS } from "./workspace-state";
import { useWorkspace } from "./WorkspaceContext";

/**
 * The layouts menu at the foot of the rail: the built-in presets and the
 * user's named layouts in one list, the Logos layouts mechanic. A preset
 * row rebuilds the panes around the passage in focus; a saved row restores
 * its snapshot through hydrate, and the normal save effect persists it from
 * there. Saved rows rename inline, update in place (Save over the name),
 * and delete individually. The capture row names the current workspace,
 * the same inline idiom the visual filter handoff uses.
 *
 * The menu shares the shell's overlay discipline: dismiss on outside
 * pointerdown or Escape. It is a glass tray that scales in from the rail
 * button, and the bells answer it: rising when it opens, falling when it
 * leaves, one struck note when a layout moves the workspace, the arpeggio
 * when a capture finishes.
 */
export default function LayoutMenu() {
  const { state, dispatch } = useWorkspace();
  const saved = useCollection(layouts);
  const [open, setOpen] = useState(false);
  /** The inline name capture for the current workspace. */
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("close");
        setOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        playSound("close");
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveLayout(trimmed, state);
    playSound("complete");
    setSaving(false);
    setName("");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Layouts: built-in presets and your saved layouts"
        aria-expanded={open}
        onClick={() => {
          playSound(open ? "close" : "open");
          setOpen((o) => !o);
          setSaving(false);
        }}
        className="fx-press flex h-12 w-full flex-col items-center justify-center gap-0.5 text-[0.55rem] font-medium tracking-wide uppercase text-muted hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        <LayoutsIcon />
        <span>Layouts</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Layouts"
          className="glass fx-scale absolute bottom-0 left-full z-50 ml-1 w-64 shadow-lg"
          style={{ "--fx-origin": "0% 100%" } as CSSProperties}
        >
          <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] text-muted">Built-in</div>
          <ul>
            {LAYOUT_PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  title={p.blurb}
                  onClick={() => {
                    playSound("navigate");
                    dispatch({ type: "applyPreset", preset: p.id });
                    setOpen(false);
                  }}
                  className="fx-press flex w-full items-baseline gap-2 px-3 py-1 text-left text-[0.8rem] text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-[0.62rem] text-muted">Preset</span>
                </button>
              </li>
            ))}
          </ul>
          {saved.length > 0 && (
            <>
              <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] text-muted">Saved</div>
              <ul>
                {saved.map((l) => (
                  <SavedLayoutRow key={l.id} layout={l} onRestored={() => setOpen(false)} />
                ))}
              </ul>
            </>
          )}
          {saving ? (
            <div className="flex items-center gap-2 border-t border-rule px-3 py-2">
              <input
                autoFocus
                value={name}
                aria-label="Layout name"
                placeholder="Layout name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  // Keep the keystroke from the menu's own Escape dismissal.
                  e.stopPropagation();
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setSaving(false);
                }}
                className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
              />
              <button
                type="button"
                onClick={save}
                disabled={!name.trim()}
                className="fx-press border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setName("");
                setSaving(true);
              }}
              className="w-full border-t border-rule px-3 py-1.5 text-left text-[0.72rem] text-sapphire hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Save current layout
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One saved layout: the name restores, Rename rewrites the name inline,
 * Update saves the current workspace over the snapshot, × deletes. A tab
 * pinned to content that has since gone (a deleted list, say) degrades the
 * way that pane already degrades; the restore never crashes on it.
 */
function SavedLayoutRow({ layout, onRestored }: { layout: SavedLayout; onRestored: () => void }) {
  const { state, dispatch } = useWorkspace();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(layout.name);

  const restore = () => {
    const restored = layoutState(layout);
    if (!restored) {
      playSound("error");
      return;
    }
    playSound("navigate");
    dispatch({ type: "hydrate", state: restored });
    onRestored();
  };

  const commit = () => {
    const name = draft.trim();
    if (name && name !== layout.name) layouts.update(layout.id, { name });
    setRenaming(false);
  };

  if (renaming) {
    return (
      <li className="flex items-center gap-1.5 px-3 py-[3px]">
        <input
          autoFocus
          value={draft}
          aria-label="Layout name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // Keep the keystroke from the menu's own Escape dismissal.
            e.stopPropagation();
            if (e.key === "Enter") commit();
            // Reset before closing so the blur commit finds nothing to write.
            if (e.key === "Escape") {
              setDraft(layout.name);
              setRenaming(false);
            }
          }}
          className="min-w-0 flex-1 border border-rule bg-paper px-1 py-0.5 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
      <button
        type="button"
        onClick={restore}
        title={`Restore ${layout.name}`}
        className="fx-press min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        {layout.name}
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(layout.name);
          setRenaming(true);
        }}
        title={`Rename ${layout.name}`}
        className="shrink-0 px-1 text-[0.62rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Rename
      </button>
      <button
        type="button"
        onClick={() => {
          updateLayout(layout.id, state);
          playSound("complete");
        }}
        title={`Save the current workspace over ${layout.name}`}
        className="shrink-0 px-1 text-[0.62rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Update
      </button>
      <button
        type="button"
        onClick={() => {
          layouts.remove(layout.id);
          playSound("close");
        }}
        title="Delete this layout"
        aria-label={`Delete ${layout.name}`}
        className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        ×
      </button>
    </li>
  );
}
