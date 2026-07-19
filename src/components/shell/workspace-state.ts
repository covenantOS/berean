"use client";

import { getBook } from "@/lib/canon";

/**
 * Workspace pane state — the Phase 0 shell's one state tree.
 *
 * The pane grid is a binary tree: split nodes carry a direction and a ratio,
 * leaf nodes carry tabs. Reader and search tabs came first; the dock's tool
 * modules (commentary, lexicon, cross-refs) are tab kinds too, so modules
 * travel between the dock and the grid without changing the tree shape. The
 * whole tree, the active ids, the rail mode, the dock tray order, and the
 * sidebar/dock visibility persist to localStorage under STORAGE_KEY so the
 * workspace reopens where it was left.
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

/**
 * A lettered link set, the Logos mechanic: panes wearing the same letter
 * navigate together and scroll to the same verse. Null means unlinked.
 */
export type LinkSet = "A" | "B" | "C";

export const LINK_SETS: LinkSet[] = ["A", "B", "C"];

export interface ReaderTab {
  id: string;
  type: "reader";
  book: string;
  chapter: number;
  /** Translation id when not the default (a compare tab, e.g. "web"). */
  translation?: string;
}

/** A concordance search, opened as a pane by the omnibox. */
export interface SearchTab {
  id: string;
  type: "search";
  q: string;
}

/** The commentary wall, lifted out of the dock into a pane. */
export interface CommentaryTab {
  id: string;
  type: "commentary";
}

/** The lexicon in a pane; a null entryId prompts for a Strong's id. */
export interface LexiconTab {
  id: string;
  type: "lexicon";
  entryId: string | null;
}

/** The cross-reference treasury, lifted out of the dock into a pane. */
export interface CrossRefsTab {
  id: string;
  type: "crossrefs";
}

/** The Passage Guide: one chapter's datasets composed into a single report. */
export interface GuideTab {
  id: string;
  type: "guide";
  book: string;
  chapter: number;
}

/** The Bible Word Study: one Strong's number's lexical report. */
export interface WordStudyTab {
  id: string;
  type: "wordstudy";
  strongsId: string;
}

/** The Exegetical Guide: one chapter's original-language report. */
export interface ExegeticalTab {
  id: string;
  type: "exegetical";
  book: string;
  chapter: number;
}

/** The Topic Guide: one entry of a topical work, opened as a report. */
export interface TopicGuideTab {
  id: string;
  type: "topicguide";
  work: "naves" | "torreys";
  topicId: string;
  /** Display title, captured at open time for the tab strip. */
  title: string;
}

/** A saved passage or word list, pinned to its document id. */
export interface ListDocTab {
  id: string;
  type: "listdoc";
  docId: string;
  /** Display title, captured at open time for the tab strip. */
  title: string;
}

/** Tabs that mirror a dock module; they can travel back to the tray. */
export type ToolTab = CommentaryTab | LexiconTab | CrossRefsTab;

export type Tab =
  | ReaderTab
  | SearchTab
  | ToolTab
  | GuideTab
  | WordStudyTab
  | ExegeticalTab
  | TopicGuideTab
  | ListDocTab;

/* ---------- drop targets (where a dragged module can land) ---------- */

export type DropEdge = "left" | "right" | "top" | "bottom";

export type DropTarget =
  /** On a pane's tab strip: a new tab, or a moved tab inserted at index. */
  | { kind: "strip"; paneId: string; index?: number }
  /** On a pane's body: a moved tab joins the pane; a dropped chapter retargets it. */
  | { kind: "body"; paneId: string }
  /** On an edge zone: the pane splits and the module opens as the new leaf. */
  | { kind: "edge"; paneId: string; edge: DropEdge };

export interface LeafNode {
  kind: "leaf";
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
  /** The pane's link set; persisted with the session. */
  linkSet: LinkSet | null;
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

/* ---------- selection (the broadcast every module answers) ---------- */

/** A verse tap: commentary, cross-refs, and the context strip answer it. */
export interface VerseSelection {
  kind: "verse";
  book: string;
  chapter: number;
  verse: number;
}

/** A word tap: the lexicon answers it, with the parsing carried along. */
export interface WordSelection {
  kind: "word";
  book: string;
  chapter: number;
  verse: number;
  /** Surface text: the KJV word or the original-language word. */
  text: string;
  /** Base Strong's ids the lexicon knows. */
  strongs: string[];
  lemma?: string;
  xlit?: string;
  /** Human-readable morphology, decoded on the server. */
  morph?: string;
  gloss?: string;
}

export type WorkspaceSelection = VerseSelection | WordSelection | null;

export interface WorkspaceState {
  root: PaneNode;
  activePaneId: string;
  railMode: RailMode;
  sidebarOpen: boolean;
  dockOpen: boolean;
  dockTab: DockTab;
  /** Tray order for the dock's module tabs; persists with the session. */
  dockTabOrder: DockTab[];
  /** The Strong's id the dock's Lexicon tab answers, when one was asked for. */
  lexiconId: string | null;
  /** The current selection. Transient by design: never persisted. */
  selection: WorkspaceSelection;
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

export function commentaryTab(): CommentaryTab {
  return { id: newId("tab"), type: "commentary" };
}

export function crossrefsTab(): CrossRefsTab {
  return { id: newId("tab"), type: "crossrefs" };
}

export function lexiconTab(entryId: string | null = null): LexiconTab {
  return { id: newId("tab"), type: "lexicon", entryId };
}

export function guideTab(book = "genesis", chapter = 1): GuideTab {
  return { id: newId("tab"), type: "guide", book, chapter };
}

export function wordStudyTab(strongsId: string): WordStudyTab {
  return { id: newId("tab"), type: "wordstudy", strongsId };
}

export function exegeticalTab(book = "genesis", chapter = 1): ExegeticalTab {
  return { id: newId("tab"), type: "exegetical", book, chapter };
}

export function topicGuideTab(
  work: "naves" | "torreys",
  topicId: string,
  title: string
): TopicGuideTab {
  return { id: newId("tab"), type: "topicguide", work, topicId, title };
}

export function listDocTab(docId: string, title: string): ListDocTab {
  return { id: newId("tab"), type: "listdoc", docId, title };
}

/** A fresh pane tab for a dock tool; the Scribe stays in the tray. */
export function toolTabForDock(dock: DockTab, lexiconId: string | null = null): ToolTab | null {
  if (dock === "commentary") return commentaryTab();
  if (dock === "crossrefs") return crossrefsTab();
  if (dock === "lexicon") return lexiconTab(lexiconId);
  return null;
}

/** The dock module a tool tab belongs to; null for reader and search tabs. */
export function dockTabForTab(tab: Tab): DockTab | null {
  if (tab.type === "commentary") return "commentary";
  if (tab.type === "lexicon") return "lexicon";
  if (tab.type === "crossrefs") return "crossrefs";
  return null;
}

export function leafNode(tabs: Tab[] = []): LeafNode {
  return {
    kind: "leaf",
    id: newId("pane"),
    tabs,
    activeTabId: tabs.length > 0 ? tabs[tabs.length - 1].id : null,
    linkSet: null,
  };
}

/** Fixed ids: the pre-hydration render must match between server and client. */
export const DEFAULT_STATE: WorkspaceState = {
  root: {
    kind: "leaf",
    id: "pane-default",
    tabs: [{ id: "tab-default", type: "reader", book: "genesis", chapter: 1 }],
    activeTabId: "tab-default",
    linkSet: null,
  },
  activePaneId: "pane-default",
  railMode: "read",
  sidebarOpen: true,
  dockOpen: false,
  dockTab: "commentary",
  dockTabOrder: [...DOCK_TABS],
  lexiconId: null,
  selection: null,
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

/** A 50/50 split of a leaf with a fresh sibling placed on the dragged-to edge. */
function splitForEdge(edge: DropEdge, leaf: LeafNode, fresh: LeafNode): SplitNode {
  const direction: SplitDirection = edge === "left" || edge === "right" ? "horizontal" : "vertical";
  const first = edge === "left" || edge === "top";
  return {
    kind: "split",
    id: newId("split"),
    direction,
    ratio: 0.5,
    children: first ? [fresh, leaf] : [leaf, fresh],
  };
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
  | { type: "openGuide"; book: string; chapter: number; paneId?: string }
  | { type: "openWordStudy"; strongsId: string; paneId?: string }
  | { type: "openExegetical"; book: string; chapter: number; paneId?: string }
  | { type: "openTopicGuide"; work: string; topicId: string; title: string; paneId?: string }
  | { type: "openListDoc"; docId: string; title: string; paneId?: string }
  | { type: "selectVerse"; book: string; chapter: number; verse: number }
  | { type: "selectWord"; word: Omit<WordSelection, "kind"> }
  | { type: "clearSelection" }
  | { type: "compareRef"; book: string; chapter: number; translation: string; paneId?: string }
  | { type: "newTab"; paneId?: string }
  | { type: "closeTab"; paneId: string; tabId: string }
  | { type: "splitPane"; paneId: string; direction: SplitDirection }
  | { type: "closePane"; paneId: string }
  | { type: "setRatio"; splitId: string; ratio: number }
  | { type: "moveTab"; fromPaneId: string; tabId: string; target: DropTarget }
  | { type: "openTab"; tab: Tab; target: DropTarget }
  | { type: "returnTabToDock"; paneId: string; tabId: string }
  | { type: "setDockTabOrder"; order: DockTab[] }
  | { type: "setLexiconTabEntry"; paneId: string; tabId: string; entryId: string | null }
  | { type: "setLinkSet"; paneId: string; linkSet: LinkSet | null }
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

/**
 * Retargets a pane to a reference. When the pane wears a link letter, every
 * other pane in the same set whose active tab is a reader tab follows; tool
 * tabs and search tabs are untouched. This is the link-set half of every
 * navigation, including prev/next chapter inside a ReaderPane (it dispatches
 * openRef) and a chapter dropped on a pane's body.
 */
function retargetLinked(root: PaneNode, paneId: string, book: string, chapter: number): PaneNode {
  const target = findLeaf(root, paneId);
  if (!target) return root;
  const withTarget = updateLeaf(root, paneId, (l) => openRefInLeaf(l, book, chapter));
  if (!target.linkSet) return withTarget;
  const set = target.linkSet;
  const follow = (node: PaneNode): PaneNode => {
    if (node.kind === "leaf") {
      if (node.id === paneId || node.linkSet !== set) return node;
      const active = node.tabs.find((t) => t.id === node.activeTabId);
      return active && active.type === "reader" ? openRefInLeaf(node, book, chapter) : node;
    }
    const a = follow(node.children[0]);
    const b = a === node.children[0] ? follow(node.children[1]) : node.children[1];
    return a === node.children[0] && b === node.children[1] ? node : { ...node, children: [a, b] };
  };
  return follow(withTarget);
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
        selection: null,
        root: retargetLinked(state.root, paneId, book.slug, chapter),
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
        selection: null,
        root: updateLeaf(state.root, paneId, (l) => ({
          ...l,
          tabs: [...l.tabs, tab],
          activeTabId: tab.id,
        })),
      };
    }

    case "openLexicon":
      return { ...state, lexiconId: action.id, dockTab: "lexicon", dockOpen: true };

    case "openGuide": {
      const book = getBook(action.book);
      if (!book) return state;
      const chapter = Math.min(Math.max(1, Math.trunc(action.chapter)), book.chapters);
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // A guide pins its passage at open time; it never follows the pane.
      const tab = guideTab(book.slug, chapter);
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

    case "openWordStudy": {
      const m = action.strongsId.trim().toUpperCase().match(/^[GH]\d{1,5}$/);
      if (!m) return state;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      const tab = wordStudyTab(m[0]);
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

    case "openExegetical": {
      const book = getBook(action.book);
      if (!book) return state;
      const chapter = Math.min(Math.max(1, Math.trunc(action.chapter)), book.chapters);
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like the Passage Guide, the report pins its passage at open time.
      const tab = exegeticalTab(book.slug, chapter);
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

    case "openTopicGuide": {
      if (action.work !== "naves" && action.work !== "torreys") return state;
      const topicId = action.topicId.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(topicId)) return state;
      const title = action.title.trim() || topicId;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      const tab = topicGuideTab(action.work, topicId, title);
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

    case "openListDoc": {
      const docId = action.docId.trim();
      if (!docId) return state;
      const title = action.title.trim() || "Untitled list";
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like a guide, the list pins its document at open time; edits land in
      // the collection and the pane reads them live.
      const tab = listDocTab(docId, title);
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

    case "selectVerse": {
      const book = getBook(action.book);
      if (!book) return state;
      const chapter = Math.min(Math.max(1, Math.trunc(action.chapter)), book.chapters);
      const verse = Math.max(1, Math.trunc(action.verse));
      const s = state.selection;
      // Tapping the selected verse again lets it go.
      if (s?.kind === "verse" && s.book === book.slug && s.chapter === chapter && s.verse === verse) {
        return { ...state, selection: null };
      }
      return { ...state, selection: { kind: "verse", book: book.slug, chapter, verse } };
    }

    case "selectWord": {
      const book = getBook(action.word.book);
      if (!book) return state;
      const first = action.word.strongs[0];
      // The lexicon opens at the word's Strong's entry; the parsing rides
      // along in the selection and renders above the entry.
      return {
        ...state,
        selection: {
          kind: "word",
          ...action.word,
          book: book.slug,
          chapter: Math.min(Math.max(1, Math.trunc(action.word.chapter)), book.chapters),
          verse: Math.max(1, Math.trunc(action.word.verse)),
        },
        ...(first ? { lexiconId: first.toUpperCase() } : {}),
        dockTab: "lexicon",
        dockOpen: true,
      };
    }

    case "clearSelection":
      return state.selection === null ? state : { ...state, selection: null };

    case "compareRef": {
      const book = getBook(action.book);
      if (!book) return state;
      const chapter = Math.min(Math.max(1, Math.trunc(action.chapter)), book.chapters);
      const leaf =
        (action.paneId ? findLeaf(state.root, action.paneId) : null) ??
        findLeaf(state.root, state.activePaneId);
      if (!leaf) return state;
      const tab: ReaderTab = { ...readerTab(book.slug, chapter), translation: action.translation };
      if (countLeaves(state.root) < MAX_PANES) {
        // Beside: the comparison opens as a new pane to the right.
        const fresh = leafNode([tab]);
        const split: SplitNode = {
          kind: "split",
          id: newId("split"),
          direction: "horizontal",
          ratio: 0.5,
          children: [leaf, fresh],
        };
        return {
          ...state,
          root: replaceNode(state.root, leaf.id, split),
          activePaneId: fresh.id,
        };
      }
      // The grid is full: the comparison opens as a tab in the same pane.
      return {
        ...state,
        activePaneId: leaf.id,
        root: updateLeaf(state.root, leaf.id, (l) => ({
          ...l,
          tabs: [...l.tabs, tab],
          activeTabId: tab.id,
        })),
      };
    }

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

    case "moveTab": {
      const source = findLeaf(state.root, action.fromPaneId);
      if (!source) return state;
      const tabIndex = source.tabs.findIndex((t) => t.id === action.tabId);
      const tab = source.tabs[tabIndex];
      if (!tab) return state;
      const target = action.target;

      // A drop on the source pane's own body changes nothing.
      if (target.kind === "body" && target.paneId === source.id) return state;

      // A drop on the source pane's own strip reorders in place; the index
      // arrives in the strip's current coordinates, before the removal.
      if (target.kind === "strip" && target.paneId === source.id) {
        const without = source.tabs.filter((t) => t.id !== tab.id);
        let index = target.index === undefined ? source.tabs.length : Math.trunc(target.index);
        index = Math.min(Math.max(0, index), source.tabs.length);
        if (index > tabIndex) index -= 1;
        index = Math.min(index, without.length);
        const tabs = [...without.slice(0, index), tab, ...without.slice(index)];
        return {
          ...state,
          root: updateLeaf(state.root, source.id, (l) => ({ ...l, tabs, activeTabId: tab.id })),
        };
      }

      // A drop on the source pane's own edge splits it; what remains stays.
      if (target.kind === "edge" && target.paneId === source.id) {
        if (countLeaves(state.root) >= MAX_PANES) return state;
        const remaining = source.tabs.filter((t) => t.id !== tab.id);
        const emptied: LeafNode = {
          ...source,
          tabs: remaining,
          activeTabId:
            source.activeTabId === tab.id
              ? (remaining[remaining.length - 1]?.id ?? null)
              : source.activeTabId,
        };
        const fresh = leafNode([tab]);
        return {
          ...state,
          root: replaceNode(state.root, source.id, splitForEdge(target.edge, emptied, fresh)),
          activePaneId: fresh.id,
        };
      }

      // Out of the source: an emptied pane collapses, unless it is the last.
      const remaining = source.tabs.filter((t) => t.id !== tab.id);
      let root = state.root;
      if (remaining.length === 0 && countLeaves(root) > 1) {
        const collapsed = removeLeaf(root, source.id);
        if (!collapsed) return state;
        root = collapsed;
      } else {
        root = updateLeaf(root, source.id, (l) => ({
          ...l,
          tabs: remaining,
          activeTabId:
            l.activeTabId === tab.id
              ? (remaining[remaining.length - 1]?.id ?? null)
              : l.activeTabId,
        }));
      }

      if (target.kind === "edge") {
        // A collapsed source frees the slot this split needs.
        if (countLeaves(root) >= MAX_PANES) return state;
        const targetLeaf = findLeaf(root, target.paneId);
        if (!targetLeaf) return state;
        const fresh = leafNode([tab]);
        return {
          ...state,
          root: replaceNode(root, target.paneId, splitForEdge(target.edge, targetLeaf, fresh)),
          activePaneId: fresh.id,
        };
      }

      const targetLeaf = findLeaf(root, target.paneId);
      if (!targetLeaf) return state;
      const index =
        target.kind === "strip" && target.index !== undefined
          ? Math.min(Math.max(0, Math.trunc(target.index)), targetLeaf.tabs.length)
          : targetLeaf.tabs.length;
      return {
        ...state,
        activePaneId: target.paneId,
        root: updateLeaf(root, target.paneId, (l) => ({
          ...l,
          tabs: [...l.tabs.slice(0, index), tab, ...l.tabs.slice(index)],
          activeTabId: tab.id,
        })),
      };
    }

    case "openTab": {
      let tab = action.tab;
      if (tab.type === "reader") {
        const book = getBook(tab.book);
        if (!book) return state;
        const chapter = Math.min(Math.max(1, Math.trunc(tab.chapter)), book.chapters);
        if (chapter !== tab.chapter || book.slug !== tab.book) {
          tab = { ...tab, book: book.slug, chapter };
        }
      }
      const target = action.target;

      if (target.kind === "edge") {
        if (countLeaves(state.root) >= MAX_PANES) return state;
        const targetLeaf = findLeaf(state.root, target.paneId);
        if (!targetLeaf) return state;
        const fresh = leafNode([tab]);
        return {
          ...state,
          root: replaceNode(state.root, target.paneId, splitForEdge(target.edge, targetLeaf, fresh)),
          activePaneId: fresh.id,
        };
      }

      const targetLeaf = findLeaf(state.root, target.paneId);
      if (!targetLeaf) return state;

      // A chapter dropped on a pane's body retargets it, like the Read tree.
      if (target.kind === "body" && tab.type === "reader") {
        return {
          ...state,
          activePaneId: targetLeaf.id,
          selection: null,
          root: retargetLinked(state.root, targetLeaf.id, tab.book, tab.chapter),
        };
      }

      const index =
        target.kind === "strip" && target.index !== undefined
          ? Math.min(Math.max(0, Math.trunc(target.index)), targetLeaf.tabs.length)
          : targetLeaf.tabs.length;
      return {
        ...state,
        activePaneId: targetLeaf.id,
        root: updateLeaf(state.root, targetLeaf.id, (l) => ({
          ...l,
          tabs: [...l.tabs.slice(0, index), tab, ...l.tabs.slice(index)],
          activeTabId: tab.id,
        })),
      };
    }

    case "returnTabToDock": {
      const leaf = findLeaf(state.root, action.paneId);
      if (!leaf) return state;
      const tab = leaf.tabs.find((t) => t.id === action.tabId);
      if (!tab) return state;
      const dockTab = dockTabForTab(tab);
      if (!dockTab) return state;
      // Removal matches closeTab: an emptied pane collapses with its split.
      const tabs = leaf.tabs.filter((t) => t.id !== action.tabId);
      let root = state.root;
      let activePaneId = state.activePaneId;
      if (tabs.length === 0 && countLeaves(root) > 1) {
        const collapsed = removeLeaf(root, action.paneId);
        if (!collapsed) return state;
        root = collapsed;
        if (activePaneId === action.paneId) activePaneId = firstLeaf(root).id;
      } else {
        root = updateLeaf(root, action.paneId, (l) => ({
          ...l,
          tabs,
          activeTabId:
            l.activeTabId === action.tabId ? (tabs[tabs.length - 1]?.id ?? null) : l.activeTabId,
        }));
      }
      return {
        ...state,
        root,
        activePaneId,
        dockTab,
        dockOpen: true,
        // A lexicon entry the tab pinned comes home to the dock with it.
        ...(tab.type === "lexicon" && tab.entryId ? { lexiconId: tab.entryId } : {}),
      };
    }

    case "setDockTabOrder": {
      const order = action.order;
      if (order.length !== DOCK_TABS.length || !DOCK_TABS.every((t) => order.includes(t))) {
        return state;
      }
      if (order.every((t, i) => t === state.dockTabOrder[i])) return state;
      return { ...state, dockTabOrder: [...order] };
    }

    case "setLexiconTabEntry": {
      const leaf = findLeaf(state.root, action.paneId);
      const tab = leaf?.tabs.find((t) => t.id === action.tabId);
      if (!leaf || !tab || tab.type !== "lexicon") return state;
      const entryId =
        action.entryId && /^[hg]\d{1,5}$/i.test(action.entryId.trim())
          ? action.entryId.trim().toUpperCase()
          : null;
      if (entryId === tab.entryId) return state;
      return {
        ...state,
        root: updateLeaf(state.root, action.paneId, (l) => ({
          ...l,
          tabs: l.tabs.map((t) =>
            t.id === action.tabId && t.type === "lexicon" ? { ...t, entryId } : t
          ),
        })),
      };
    }

    case "setLinkSet": {
      const leaf = findLeaf(state.root, action.paneId);
      if (!leaf || leaf.linkSet === action.linkSet) return state;
      return {
        ...state,
        root: updateLeaf(state.root, action.paneId, (l) => ({ ...l, linkSet: action.linkSet })),
      };
    }

    case "applyPreset": {
      const current = paneRef(findLeaf(state.root, state.activePaneId) ?? firstLeaf(state.root)) ?? {
        book: "genesis",
        chapter: 1,
      };
      if (action.preset === "reading") {
        // One unhurried pane; the dock closes.
        const leaf = leafNode([readerTab(current.book, current.chapter)]);
        return { ...state, root: leaf, activePaneId: leaf.id, dockOpen: false, selection: null };
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
      return { ...state, root: split, activePaneId: left.id, dockOpen: true, dockTab: "commentary", selection: null };
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
      if (t.type === "commentary" && typeof t.id === "string") {
        tabs.push({ id: t.id, type: "commentary" });
        continue;
      }
      if (t.type === "crossrefs" && typeof t.id === "string") {
        tabs.push({ id: t.id, type: "crossrefs" });
        continue;
      }
      if (t.type === "lexicon" && typeof t.id === "string") {
        const entryId =
          typeof t.entryId === "string" && /^[hg]\d{1,5}$/i.test(t.entryId)
            ? t.entryId.toUpperCase()
            : null;
        tabs.push({ id: t.id, type: "lexicon", entryId });
        continue;
      }
      if (t.type === "guide" && typeof t.id === "string" && typeof t.book === "string") {
        const book = getBook(t.book);
        if (!book) continue;
        const chapter =
          typeof t.chapter === "number" && Number.isInteger(t.chapter)
            ? Math.min(Math.max(1, t.chapter), book.chapters)
            : 1;
        tabs.push({ id: t.id, type: "guide", book: book.slug, chapter });
        continue;
      }
      if (t.type === "wordstudy" && typeof t.id === "string") {
        if (typeof t.strongsId !== "string" || !/^[hg]\d{1,5}$/i.test(t.strongsId)) continue;
        tabs.push({ id: t.id, type: "wordstudy", strongsId: t.strongsId.toUpperCase() });
        continue;
      }
      if (t.type === "exegetical" && typeof t.id === "string" && typeof t.book === "string") {
        const book = getBook(t.book);
        if (!book) continue;
        const chapter =
          typeof t.chapter === "number" && Number.isInteger(t.chapter)
            ? Math.min(Math.max(1, t.chapter), book.chapters)
            : 1;
        tabs.push({ id: t.id, type: "exegetical", book: book.slug, chapter });
        continue;
      }
      if (t.type === "topicguide" && typeof t.id === "string") {
        if (t.work !== "naves" && t.work !== "torreys") continue;
        if (typeof t.topicId !== "string" || !/^[a-z0-9-]+$/.test(t.topicId)) continue;
        const title =
          typeof t.title === "string" && t.title.trim() ? t.title : t.topicId;
        tabs.push({ id: t.id, type: "topicguide", work: t.work, topicId: t.topicId, title });
        continue;
      }
      if (t.type === "listdoc" && typeof t.id === "string") {
        if (typeof t.docId !== "string" || !t.docId.trim()) continue;
        const title =
          typeof t.title === "string" && t.title.trim() ? t.title : "Untitled list";
        tabs.push({ id: t.id, type: "listdoc", docId: t.docId, title });
        continue;
      }
      if (t.type !== "reader" || typeof t.id !== "string" || typeof t.book !== "string") continue;
      const book = getBook(t.book);
      if (!book) continue;
      const chapter =
        typeof t.chapter === "number" && Number.isInteger(t.chapter)
          ? Math.min(Math.max(1, t.chapter), book.chapters)
          : 1;
      const translation =
        typeof t.translation === "string" && /^[a-z0-9-]{2,12}$/i.test(t.translation)
          ? t.translation.toLowerCase()
          : undefined;
      tabs.push({ id: t.id, type: "reader", book: book.slug, chapter, ...(translation ? { translation } : {}) });
    }
    const activeTabId =
      typeof n.activeTabId === "string" && tabs.some((t) => t.id === n.activeTabId)
        ? (n.activeTabId as string)
        : (tabs[tabs.length - 1]?.id ?? null);
    // Older sessions predate link sets; an absent or malformed letter reads
    // as unlinked rather than failing the load.
    const linkSet: LinkSet | null = LINK_SETS.includes(n.linkSet as LinkSet)
      ? (n.linkSet as LinkSet)
      : null;
    return { kind: "leaf", id: n.id, tabs, activeTabId, linkSet };
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

/** The persisted tray order; the default when absent (older sessions) or malformed. */
function sanitizeDockTabOrder(raw: unknown): DockTab[] {
  if (Array.isArray(raw)) {
    const order = raw.filter((t): t is DockTab => DOCK_TABS.includes(t as DockTab));
    if (order.length === DOCK_TABS.length && DOCK_TABS.every((t) => order.includes(t))) {
      return order;
    }
  }
  return [...DOCK_TABS];
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
    dockTabOrder: sanitizeDockTabOrder(p.dockTabOrder),
    lexiconId: typeof p.lexiconId === "string" && p.lexiconId ? p.lexiconId : null,
    selection: null,
  };
}

export function saveWorkspace(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    // The selection is transient: it never survives a reload.
    const stored: StoredWorkspace = { version: 1, ...state, selection: null };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // A full or blocked localStorage must never break the workspace.
  }
}
