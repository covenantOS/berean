"use client";

import type { DragEvent } from "react";
import type { DropEdge } from "./workspace-state";

/**
 * Native HTML5 drag and drop for the workspace canvas. Every module rides
 * under a Berean MIME type; dragover cannot read payloads, only types, so
 * each type names exactly one kind of module and drop targets light up from
 * the type alone. Indicators stay quiet: an amber line or a tint, and the
 * drag ghost is a small label chip, never a lifted, shadowed card.
 */

export const DND = {
  /** A tab dragged out of a pane's strip. Payload: { paneId, tabId }. */
  paneTab: "application/x-berean-pane-tab",
  /** Set alongside paneTab when the dragged tab is a dock tool module. */
  paneToolTab: "application/x-berean-pane-tool-tab",
  /** A live tool in the dock tray. Payload: { dock: "commentary" | "lexicon" | "crossrefs" }. */
  dockTool: "application/x-berean-dock-tool",
  /** A chapter in the Read tree. Payload: { book, chapter }. */
  chapter: "application/x-berean-chapter",
  /** A Library shelf lexicon entry: opens a prompting lexicon tab. */
  libraryLexicon: "application/x-berean-library-lexicon",
} as const;

/** The module types a pane (strip, body, or edge zone) accepts. */
const GRID_TYPES = [DND.paneTab, DND.dockTool, DND.chapter, DND.libraryLexicon];

/** True when the drag carries a module the grid can take. */
export function hasGridPayload(e: DragEvent): boolean {
  return GRID_TYPES.some((t) => e.dataTransfer.types.includes(t));
}

/* One reusable chip serves as every drag ghost: tinted, square, quiet. */
let chip: HTMLDivElement | null = null;

function dragChip(label: string): HTMLDivElement {
  if (!chip || !chip.isConnected) {
    chip = document.createElement("div");
    chip.style.cssText =
      "position:fixed;top:-1000px;left:-1000px;padding:4px 10px;font-size:12px;line-height:1.4;" +
      "border:1px solid var(--stained-amber);color:var(--signal-ink);white-space:nowrap;" +
      "background:color-mix(in srgb, var(--stained-amber) 16%, var(--signal-paper));";
    document.body.appendChild(chip);
  }
  chip.textContent = label;
  return chip;
}

/** Arms a drag: payload under its type, a plain-text fallback, the chip ghost. */
export function startModuleDrag(
  e: DragEvent,
  type: string,
  payload: Record<string, unknown>,
  label: string,
  extraTypes: Record<string, Record<string, unknown>> = {}
) {
  e.dataTransfer.setData(type, JSON.stringify(payload));
  for (const [t, p] of Object.entries(extraTypes)) {
    e.dataTransfer.setData(t, JSON.stringify(p));
  }
  e.dataTransfer.setData("text/plain", label);
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setDragImage(dragChip(label), 0, 0);
}

/** Reads a payload on drop; null when the type is absent or malformed. */
export function readPayload<T>(e: DragEvent, type: string): T | null {
  const raw = e.dataTransfer.getData(type);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * The split zone a point falls in: the outer quarter along a pane's edge,
 * or null for the body. Corners resolve to the nearer edge.
 */
export function edgeAtPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  zone = 0.25
): DropEdge | null {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  const inX = x < zone || x > 1 - zone;
  const inY = y < zone || y > 1 - zone;
  if (!inX && !inY) return null;
  if (inX && (!inY || Math.min(x, 1 - x) <= Math.min(y, 1 - y))) {
    return x < 0.5 ? "left" : "right";
  }
  return y < 0.5 ? "top" : "bottom";
}
