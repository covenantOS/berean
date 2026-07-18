"use client";

import { getBook } from "@/lib/canon";

/**
 * Workspace pane state — the Phase 0 shell's one state tree.
 *
 * The pane grid is a binary tree: split nodes carry a direction and a ratio,
 * leaf nodes carry tabs. Phase 0 has two tab kinds (reader and search);
 * later phases add commentary, lexicon, and document panels as new tab
 * kinds without changing the tree shape. The whole tree, the active ids,
 * the rail mode, and the sidebar/dock visibility persist to localStorage
 * under STORAGE_KEY so the workspace reopens where it was left.
 */

export type RailMode =
  | "read"
  | "study"
  | "search"
  | "library"
  | "documents"
  | "almanac"
  | "settings";

export const RAIL_MODES: RailMode[] = [
  "read",
  "study",
  "search",
  "library",
  "documents",
  "almanac",
  "settings",
];

export type DockTab = "commentary" | "lexicon" | "crossrefs" | "scribe";

export const DOCK_TABS: DockTab[] = ["commentary", "lexicon", "crossrefs", "scribe"];

/** "horizontal" arranges panes side by side (a row); "vertical" stacks them. */
export type SplitDirection = "horizontal" | "vertical";

export interface ReaderTab {
  id: string;
  type: "reader";
  book: string;
  chapter: number;
}

/** A concordance search, opened as a pane by the omnibox. */
export interface SearchTab {
  id: string;
  type: "search";
  q: string;
}

export type Tab = ReaderTab | SearchTab;

export interface LeafNode {
  kind: "leaf";
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
}

export interface SplitNode {
  kind: "split";
  id: string;
  direction: SplitDirection;
  /** Share of the cross axis given to the first child, 0.2–0.8. */
  ratio: number;
  children: [PaneNode, PaneNode];
}

export type PaneNode = LeafNode | SplitNode;

export interface WorkspaceState {
  root: PaneNode;
  activePaneId: string;
  railMode: RailMode;
  sidebarOpen: boolean;
  dockOpen: boolean;
  dockTab: DockTab;
  /** The Strong's id the dock's Lexicon tab answers, when one was asked for. */
  lexiconId: string | null;
}

export const MAX_PANES = 4;
export const STORAGE_KEY = "berean.workspace.v1";

let idCounter = 0;
function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function readerTab(book = "genesis", chapter = 1): ReaderTab {
  return { id: newId("tab"), type: "reader", book, chapter };
}

export function searchTab(q: string): SearchTab {
  return { id: newId("tab"), type: "search", q };
}

export function leafNode(tabs: Tab[] = []): LeafNode {
  return {
    kind: "leaf",
    id: newId("pane"),
    tabs,
    activeTabId: tabs.length > 0 ? tabs[tabs.length - 1].id : null,
  };
}

/** Fixed ids: the pre-hydration render must match between server and client. */
export const DEFAULT_STATE: WorkspaceState = {
  root: {
    kind: "leaf",
    id: "pane-default",
    tabs: [{ id: "tab-default", type: "reader", book: "genesis", chapter: 1 }],
    activeTabId: "tab-default",
  },
  activePaneId: "pane-default",
  railMode: "read",
  sidebarOpen: true,
  dockOpen: false,
  dockTab: "commentary",
  lexiconId: null,
};

/* ---------- tree helpers (pure; never mutate) ---------- */

export function countLeaves(node: PaneNode): number {
  return node.kind === "leaf" ? 1 : countLeaves(node.children[0]) + countLeaves(node.children[1]);
}

export function firstLeaf(node: PaneNode): LeafNode {
  return node.kind === "leaf" ? node : firstLeaf(node.children[0]);
}

export function findLeaf(node: PaneNode, id: string): LeafNode | null {
  if (node.kind === "leaf") return node.id === id ? node : null;
  return findLeaf(node.children[0], id) ?? findLeaf(node.children[1], id);
}

function updateLeaf(node: PaneNode, id: string, fn: (leaf: LeafNode) => LeafNode): PaneNode {
  if (node.kind === "leaf") return node.id === id ? fn(node) : node;
  const a = updateLeaf(node.children[0], id, fn);
  const b = a === node.children[0] ? updateLeaf(node.children[1], id, fn) : node.children[1];
  return a === node.children[0] && b === node.children[1] ? node : { ...node, children: [a, b] };
}

function replaceNode(node: PaneNode, id: string, replacement: PaneNode): PaneNode {
  if (node.id === id) return replacement;
  if (node.kind === "leaf") return node;
  const a = replaceNode(node.children[0], id, replacement);
  const b = a === node.children[0] ? replaceNode(node.children[1], id, replacement) : node.children[1];
  return a === node.children[0] && b === node.children[1] ? node : { ...node, children: [a, b] };
}

/** Removes a leaf and collapses its parent split. Null when the root was the leaf. */
function removeLeaf(node: PaneNode, id: string): PaneNode | null {
  if (node.kind === "leaf") return node.id === id ? null : node;
  const [a, b] = node.children;
  const na = removeLeaf(a, id);
  if (na !== a) return na === null ? b : { ...node, children: [na, b] };
  const nb = removeLeaf(b, id);
  if (nb !== b) return nb === null ? a : { ...node, children: [a, nb] };
  return node;
}

function updateSplit(node: PaneNode, id: string, fn: (split: SplitNode) => SplitNode): PaneNode {
  if (node.kind === "split") {
    if (node.id === id) return fn(node);
    const a = updateSplit(node.children[0], id, fn);
    const b = a === node.children[0] ? updateSplit(node.children[1], id, fn) : node.children[1];
    return a === node.children[0] && b === node.children[1] ? node : { ...node, children: [a, b] };
  }
  return node;
}

/** The reference a pane is currently showing (its active reader tab, when it has one). */
export function paneRef(leaf: LeafNode): { book: string; chapter: number } | null {
  const tab = leaf.tabs.find((t) => t.id === leaf.activeTabId);
  return tab && tab.type === "reader" ? { book: tab.book, chapter: tab.chapter } : null;
}

/* ---------- reducer ---------- */

export type WorkspaceAction =
  | { type: "hydrate"; state: WorkspaceState }
  | { type: "setRailMode"; mode: RailMode }
  | { type: "toggleSidebar" }
  | { type: "setDockTab"; tab: DockTab }
  | { type: "toggleDock" }
  | { type: "activatePane"; paneId: string }
  | { type: "activateTab"; paneId: string; tabId: string }
  | { type: "openRef"; book: string; chapter: number; paneId?: string }
  | { type: "openSearch"; q: string; paneId?: string }
  | { type: "openLexicon"; id: string }
  | { type: "newTab"; paneId?: string }
  | { type: "closeTab"; paneId: string; tabId: string }
  | { type: "splitPane"; paneId: string; direction: SplitDirection }
  | { type: "closePane"; paneId: string }
  | { type: "setRatio"; splitId: string; ratio: number }
  | { type: "applyPreset"; preset: "reading" | "study" };

function openRefInLeaf(leaf: LeafNode, book: string, chapter: number): LeafNode {
  const active = leaf.tabs.find((t) => t.id === leaf.activeTabId);
  if (active && active.type === "reader") {
    // Retarget the tab in focus, the way a Logos panel follows navigation.
    return {
      ...leaf,
      tabs: leaf.tabs.map((t) => (t.id === active.id ? { ...t, book, chapter } : t)),
    };
  }
  // A search or empty pane keeps its tab; the passage opens beside it.
  const tab = readerTab(book, chapter);
  return { ...leaf, tabs: [...leaf.tabs, tab], activeTabId: tab.id };
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "setRailMode":
      return { ...state, railMode: action.mode, sidebarOpen: true };

    case "toggleSidebar":
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case "setDockTab":
      return { ...state, dockTab: action.tab, dockOpen: true };

    case "toggleDock":
      return { ...state, dockOpen: !state.dockOpen };

    case "activatePane":
      return findLeaf(state.root, action.paneId) ? { ...state, activePaneId: action.paneId } : state;

    case "activateTab": {
      const leaf = findLeaf(state.root, action.paneId);
      if (!leaf || !leaf.tabs.some((t) => t.id === action.tabId)) return state;
      return {
        ...state,
        activePaneId: action.paneId,
        root: updateLeaf(state.root, action.paneId, (l) => ({ ...l, activeTabId: action.tabId })),
      };
    }

    case "openRef": {
      const book = getBook(action.book);
      if (!book) return state;
      const chapter = Math.min(Math.max(1, Math.trunc(action.chapter)), book.chapters);
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      return {
        ...state,
        activePaneId: paneId,
        root: updateLeaf(state.root, paneId, (l) => openRefInLeaf(l, book.slug, chapter)),
      };
    }

    case "openSearch": {
      const q = action.q.trim();
      if (!q) return state;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      const tab = searchTab(q);
      return {
        ...state,
        activePaneId: paneId,
        root: updateLeaf(state.root, paneId, (l) => ({
          ...l,
          tabs: [...l.tabs, tab],
          activeTabId: tab.id,
        })),
      };
    }

    case "openLexicon":
      return { ...state, lexiconId: action.id, dockTab: "lexicon", dockOpen: true };

    case "newTab": {
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      const leaf = findLeaf(state.root, paneId);
      if (!leaf) return state;
      const ref = paneRef(leaf) ?? { book: "genesis", chapter: 1 };
      const tab = readerTab(ref.book, ref.chapter);
      return {
        ...state,
        activePaneId: paneId,
        root: updateLeaf(state.root, paneId, (l) => ({
          ...l,
          tabs: [...l.tabs, tab],
          activeTabId: tab.id,
        })),
      };
    }

    case "closeTab": {
      const leaf = findLeaf(state.root, action.paneId);
      if (!leaf || !leaf.tabs.some((t) => t.id === action.tabId)) return state;
      const tabs = leaf.tabs.filter((t) => t.id !== action.tabId);
      if (tabs.length === 0 && countLeaves(state.root) > 1) {
        // An empty pane closes with its last tab; the split collapses.
        const root = removeLeaf(state.root, action.paneId);
        if (!root) return state;
        const activePaneId =
          state.activePaneId === action.paneId ? firstLeaf(root).id : state.activePaneId;
        return { ...state, root, activePaneId };
      }
      const activeTabId =
        leaf.activeTabId === action.tabId
          ? (tabs[tabs.length - 1]?.id ?? null)
          : leaf.activeTabId;
      return {
        ...state,
        root: updateLeaf(state.root, action.paneId, (l) => ({ ...l, tabs, activeTabId })),
      };
    }

    case "splitPane": {
      if (countLeaves(state.root) >= MAX_PANES) return state;
      const leaf = findLeaf(state.root, action.paneId);
      if (!leaf) return state;
      const ref = paneRef(leaf) ?? { book: "genesis", chapter: 1 };
      const fresh = leafNode([readerTab(ref.book, ref.chapter)]);
      const split: SplitNode = {
        kind: "split",
        id: newId("split"),
        direction: action.direction,
        ratio: 0.5,
        children: [leaf, fresh],
      };
      return {
        ...state,
        root: replaceNode(state.root, leaf.id, split),
        activePaneId: fresh.id,
      };
    }

    case "closePane": {
      if (countLeaves(state.root) <= 1) return state;
      const root = removeLeaf(state.root, action.paneId);
      if (!root) return state;
      const activePaneId =
        state.activePaneId === action.paneId ? firstLeaf(root).id : state.activePaneId;
      return { ...state, root, activePaneId };
    }

    case "setRatio": {
      const ratio = Math.min(0.8, Math.max(0.2, action.ratio));
      return { ...state, root: updateSplit(state.root, action.splitId, (s) => ({ ...s, ratio })) };
    }

    case "applyPreset": {
      const current = paneRef(findLeaf(state.root, state.activePaneId) ?? firstLeaf(state.root)) ?? {
        book: "genesis",
        chapter: 1,
      };
      if (action.preset === "reading") {
        // One unhurried pane; the dock closes.
        const leaf = leafNode([readerTab(current.book, current.chapter)]);
        return { ...state, root: leaf, activePaneId: leaf.id, dockOpen: false };
      }
      // "study": text beside text, tools at hand.
      const left = leafNode([readerTab(current.book, current.chapter)]);
      const right = leafNode([readerTab(current.book, current.chapter)]);
      const split: SplitNode = {
        kind: "split",
        id: newId("split"),
        direction: "horizontal",
        ratio: 0.5,
        children: [left, right],
      };
      return { ...state, root: split, activePaneId: left.id, dockOpen: true, dockTab: "commentary" };
    }

    default:
      return state;
  }
}

/* ---------- persistence ---------- */

interface StoredWorkspace extends WorkspaceState {
  version: 1;
}

function sanitizeNode(node: unknown): PaneNode | null {
  if (typeof node !== "object" || node === null) return null;
  const n = node as Record<string, unknown>;
  if (n.kind === "leaf" && typeof n.id === "string" && Array.isArray(n.tabs)) {
    const tabs: Tab[] = [];
    for (const raw of n.tabs) {
      if (typeof raw !== "object" || raw === null) continue;
      const t = raw as Record<string, unknown>;
      if (t.type === "search" && typeof t.id === "string" && typeof t.q === "string" && t.q.trim()) {
        tabs.push({ id: t.id, type: "search", q: t.q });
        continue;
      }
      if (t.type !== "reader" || typeof t.id !== "string" || typeof t.book !== "string") continue;
      const book = getBook(t.book);
      if (!book) continue;
      const chapter =
        typeof t.chapter === "number" && Number.isInteger(t.chapter)
          ? Math.min(Math.max(1, t.chapter), book.chapters)
          : 1;
      tabs.push({ id: t.id, type: "reader", book: book.slug, chapter });
    }
    const activeTabId =
      typeof n.activeTabId === "string" && tabs.some((t) => t.id === n.activeTabId)
        ? (n.activeTabId as string)
        : (tabs[tabs.length - 1]?.id ?? null);
    return { kind: "leaf", id: n.id, tabs, activeTabId };
  }
  if (
    n.kind === "split" &&
    typeof n.id === "string" &&
    (n.direction === "horizontal" || n.direction === "vertical") &&
    Array.isArray(n.children) &&
    n.children.length === 2
  ) {
    const a = sanitizeNode(n.children[0]);
    const b = sanitizeNode(n.children[1]);
    if (!a || !b) return null;
    const ratio = typeof n.ratio === "number" ? Math.min(0.8, Math.max(0.2, n.ratio)) : 0.5;
    return { kind: "split", id: n.id, direction: n.direction, ratio, children: [a, b] };
  }
  return null;
}

/** Reads the persisted workspace; null when absent or beyond repair. */
export function loadWorkspace(): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Partial<StoredWorkspace>;
  if (p.version !== 1) return null;
  const root = p.root ? sanitizeNode(p.root) : null;
  if (!root) return null;
  if (countLeaves(root) > MAX_PANES) return null;
  const activePaneId =
    typeof p.activePaneId === "string" && findLeaf(root, p.activePaneId)
      ? p.activePaneId
      : firstLeaf(root).id;
  return {
    root,
    activePaneId,
    railMode: RAIL_MODES.includes(p.railMode as RailMode) ? (p.railMode as RailMode) : "read",
    sidebarOpen: p.sidebarOpen !== false,
    dockOpen: p.dockOpen === true,
    dockTab: DOCK_TABS.includes(p.dockTab as DockTab) ? (p.dockTab as DockTab) : "commentary",
    lexiconId: typeof p.lexiconId === "string" && p.lexiconId ? p.lexiconId : null,
  };
}

export function saveWorkspace(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    const stored: StoredWorkspace = { version: 1, ...state };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // A full or blocked localStorage must never break the workspace.
  }
}
