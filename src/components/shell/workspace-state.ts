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
  /** Text size step, 1 (smallest) through 5 (largest); absent reads as 2. */
  fontScale?: number;
}

/** The engine a search tab runs; "bible" is the precise KJV concordance. */
export type SearchMode = "bible" | "original" | "semantic";

/** A concordance search, opened as a pane by the omnibox. */
export interface SearchTab {
  id: string;
  type: "search";
  q: string;
  /** The engine the pane runs; absent reads as the precise Bible search. */
  mode?: "original" | "semantic";
}

/** A search over the user's own notes, manuscripts, lists, and prayers. */
export interface DocSearchTab {
  id: string;
  type: "docsearch";
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

/**
 * A custom guide (src/lib/guides.ts) run on one chapter: the Passage Guide's
 * report filtered and ordered to the named composition. The guide's name is
 * captured at open time for the tab strip; the pane reads the collection
 * live, so edits and renames apply to the open tab, and a deleted guide
 * degrades the way a deleted list document does.
 */
export interface CustomGuideTab {
  id: string;
  type: "customguide";
  guideId: string;
  /** The guide's name, captured at open time for the tab strip. */
  name: string;
  book: string;
  chapter: number;
}

/**
 * The Guide Editor: compose, rename, reorder, and delete custom guides. A
 * guideId opens that guide in the editor; null opens the guide list.
 */
export interface GuideEditorTab {
  id: string;
  type: "guideeditor";
  guideId: string | null;
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

/**
 * The Writing Desk: the manuscript list with its filters and sorts. A
 * singleton with no payload; the pane opens on the desk itself.
 */
export interface DeskTab {
  id: string;
  type: "desk";
}

/** A manuscript open for editing, pinned to its document id. */
export interface ManuscriptTab {
  id: string;
  type: "manuscript";
  docId: string;
  /** Display title, captured at open time for the tab strip. */
  title: string;
}

/** The Factbook: one TIPNR entity's report, pinned to its entity id. */
export interface FactbookTab {
  id: string;
  type: "factbook";
  entityId: string;
  /** The entity's name, captured at open time for the tab strip. */
  title: string;
}

/** The library browser: the faceted catalog, one tab with no payload. */
export interface LibraryTab {
  id: string;
  type: "library";
}

/** Text Comparison: one chapter's translations diffed against a base text. */
export interface TextCompareTab {
  id: string;
  type: "textcompare";
  book: string;
  chapter: number;
  /** Base translation id; the shelf default at open, switchable in the pane. */
  base: string;
}

/** The Concordance: one book's word and lemma inventories, pinned at open. */
export interface ConcordanceTab {
  id: string;
  type: "concordance";
  book: string;
}

/**
 * The Atlas: every geolocated place on its land base. A place id opens the
 * map focused on it, the way the retired page's ?place= did; the name rides
 * along for the tab strip.
 */
export interface AtlasTab {
  id: string;
  type: "atlas";
  /** TIPNR place id to focus; absent opens the whole map. */
  place?: string;
  /** The place's name, captured at open time for the tab strip. */
  title?: string;
}

/**
 * Memory work: the spaced-review trainer. A passage id opens the drill on
 * that passage, the way the retired page's ?drill= did; without one the
 * pane opens on the due list and the take-up form.
 */
export interface MemoryTab {
  id: string;
  type: "memory";
  /** Memory passage id to drill; absent opens the trainer's list. */
  passageId?: string;
}

/**
 * The journal: date-anchored notes read as a diary. A singleton with no
 * payload; the pane opens on the capture form and the days already written.
 */
export interface JournalTab {
  id: string;
  type: "journal";
}

/**
 * Prayer lists: the requests carried before God, gathered into lists. A
 * singleton with no payload; the pane opens on the due requests and the
 * lists themselves.
 */
export interface PrayersTab {
  id: string;
  type: "prayers";
}

/**
 * Reading plans: the canon paced evenly across days. A singleton with no
 * payload; the pane opens on the active plans and the build-a-plan form.
 */
export interface PlansTab {
  id: string;
  type: "plans";
}

/**
 * The Timeline: the curated chronology in era bands. An event id opens the
 * chart with that event selected, the way the retired page's ?event= did.
 */
export interface TimelineTab {
  id: string;
  type: "timeline";
  /** Timeline event id to focus; absent opens the whole chart. */
  event?: string;
  /** The event's label, captured at open time for the tab strip. */
  title?: string;
}

/**
 * The new-tab launcher: everything the workspace opens, with suggestions
 * keyed to the pane's passage at open time. A pane with no reader tab opens
 * a launcher without a passage and the reference-aware rows stay out.
 */
export interface LauncherTab {
  id: string;
  type: "launcher";
  /** The pane's passage when the tab opened; absent when the pane had none. */
  book?: string;
  chapter?: number;
}

/** Tabs that mirror a dock module; they can travel back to the tray. */
export type ToolTab = CommentaryTab | LexiconTab | CrossRefsTab;

export type Tab =
  | ReaderTab
  | SearchTab
  | DocSearchTab
  | ToolTab
  | GuideTab
  | CustomGuideTab
  | GuideEditorTab
  | WordStudyTab
  | ExegeticalTab
  | TopicGuideTab
  | ListDocTab
  | DeskTab
  | ManuscriptTab
  | FactbookTab
  | LibraryTab
  | TextCompareTab
  | ConcordanceTab
  | AtlasTab
  | TimelineTab
  | MemoryTab
  | JournalTab
  | PrayersTab
  | PlansTab
  | LauncherTab;

/* ---------- drop targets (where a dragged module can land) ---------- */

export type DropEdge = "left" | "right" | "top" | "bottom";

export type DropTarget =
  /** On a pane's tab strip: a new tab, or a moved tab inserted at index. */
  | { kind: "strip"; paneId: string; index?: number }
  /** On a pane's body: a moved tab joins the pane; a dropped chapter retargets it. */
  | { kind: "body"; paneId: string }
  /** On an edge zone: the pane splits and the module opens as the new leaf. */
  | { kind: "edge"; paneId: string; edge: DropEdge };

/** One stop on a pane's navigation trail: the passage a reader tab showed. */
export interface NavEntry {
  book: string;
  chapter: number;
  /** Translation id when the tab was reading a non-default text. */
  translation?: string;
}

/**
 * A pane's back/forward trail. Entries sit in visit order with the index on
 * the stop the pane is showing; navigating past a walked-back position drops
 * the forward stops, the way a browser does. Bounded at HISTORY_LIMIT.
 */
export interface PaneHistory {
  entries: NavEntry[];
  index: number;
}

export const HISTORY_LIMIT = 100;

export interface LeafNode {
  kind: "leaf";
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
  /** The pane's link set; persisted with the session. */
  linkSet: LinkSet | null;
  /** The pane's navigation trail; persisted with the session. */
  history: PaneHistory;
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
  const translation = preferredTranslation();
  return {
    id: newId("tab"),
    type: "reader",
    book,
    chapter,
    ...(translation ? { translation } : {}),
  };
}

export function searchTab(q: string, mode?: SearchMode): SearchTab {
  return {
    id: newId("tab"),
    type: "search",
    q,
    ...(mode && mode !== "bible" ? { mode } : {}),
  };
}

export function docSearchTab(q: string): DocSearchTab {
  return { id: newId("tab"), type: "docsearch", q };
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

export function customGuideTab(
  guideId: string,
  name: string,
  book = "genesis",
  chapter = 1
): CustomGuideTab {
  return { id: newId("tab"), type: "customguide", guideId, name, book, chapter };
}

export function guideEditorTab(guideId: string | null = null): GuideEditorTab {
  return { id: newId("tab"), type: "guideeditor", guideId };
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

export function deskTab(): DeskTab {
  return { id: newId("tab"), type: "desk" };
}

export function manuscriptTab(docId: string, title: string): ManuscriptTab {
  return { id: newId("tab"), type: "manuscript", docId, title };
}

/** TIPNR ids are 5–6 character codes such as "H0175" or "H2148w". */
export const ENTITY_ID_PATTERN = /^[A-Za-z0-9]{5,6}$/;

/** Timeline event ids are lowercase kebab tokens such as "call-of-abraham". */
export const EVENT_ID_PATTERN = /^[a-z0-9-]+$/;

/** Memory passage ids are the store's UUIDs (crypto.randomUUID, src/lib/store.ts). */
export const MEMORY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Manuscript ids are the store's UUIDs, the same shape memory passage ids take. */
export const DOCUMENT_ID_PATTERN = MEMORY_ID_PATTERN;

export function factbookTab(entityId: string, title: string): FactbookTab {
  return { id: newId("tab"), type: "factbook", entityId, title };
}

export function libraryTab(): LibraryTab {
  return { id: newId("tab"), type: "library" };
}

/**
 * The comparison's default base. The shelf's own default lives in
 * src/lib/translations.ts, which reads the disk and cannot be imported here;
 * the reader already speaks of the KJV by name the same way.
 */
export const COMPARE_BASE_DEFAULT = "kjv";

/**
 * The translation new reader tabs open in, the workspace's default text. A
 * device-local scalar like the candle key, written by the Settings rail and
 * read here at tab creation; a tab already open keeps its own text, and a
 * pane's swap still wins. KJV stores as nothing, the way a tab carrying no
 * translation already means the default text.
 */
export const PREFERRED_TRANSLATION_KEY = "berean.preferred-translation.v1";

function preferredTranslation(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = window.localStorage.getItem(PREFERRED_TRANSLATION_KEY)?.trim();
  return v && v !== "kjv" && /^[a-z]+$/.test(v) ? v : undefined;
}

/** The text size step a reader tab falls back to when it carries none. */
export const READER_FONT_SCALE_DEFAULT = 2;

export function textCompareTab(
  book = "genesis",
  chapter = 1,
  base = COMPARE_BASE_DEFAULT
): TextCompareTab {
  return { id: newId("tab"), type: "textcompare", book, chapter, base };
}

export function concordanceTab(book = "genesis"): ConcordanceTab {
  return { id: newId("tab"), type: "concordance", book };
}

export function atlasTab(place?: string, title?: string): AtlasTab {
  return {
    id: newId("tab"),
    type: "atlas",
    ...(place ? { place } : {}),
    ...(title ? { title } : {}),
  };
}

export function timelineTab(event?: string, title?: string): TimelineTab {
  return {
    id: newId("tab"),
    type: "timeline",
    ...(event ? { event } : {}),
    ...(title ? { title } : {}),
  };
}

export function memoryTab(passageId?: string): MemoryTab {
  return {
    id: newId("tab"),
    type: "memory",
    ...(passageId ? { passageId } : {}),
  };
}

export function journalTab(): JournalTab {
  return { id: newId("tab"), type: "journal" };
}

export function prayersTab(): PrayersTab {
  return { id: newId("tab"), type: "prayers" };
}

export function plansTab(): PlansTab {
  return { id: newId("tab"), type: "plans" };
}

/** The launcher, keyed to the pane's passage at open time when it has one. */
export function launcherTab(ref?: { book: string; chapter: number }): LauncherTab {
  return { id: newId("tab"), type: "launcher", ...(ref ? { book: ref.book, chapter: ref.chapter } : {}) };
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
    history: { entries: [], index: -1 },
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
    history: { entries: [], index: -1 },
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

/* ---------- layout presets (the seeded starter layouts) ---------- */

export type PresetId = "reading" | "study" | "sermon-prep" | "word-study" | "original-languages";

export interface LayoutPreset {
  id: PresetId;
  name: string;
  /** One honest line for the rail button's title and the layouts menu. */
  blurb: string;
  /** Builds the panes around the passage in focus. */
  build: (
    book: string,
    chapter: number
  ) => Pick<WorkspaceState, "root" | "activePaneId"> &
    Partial<Pick<WorkspaceState, "dockOpen" | "dockTab">>;
}

/** Two panes side by side at an even split. */
function sideBySide(left: LeafNode, right: LeafNode): SplitNode {
  return {
    kind: "split",
    id: newId("split"),
    direction: "horizontal",
    ratio: 0.5,
    children: [left, right],
  };
}

/**
 * The built-in layouts. Every preset composes panes that genuinely work; a
 * layout that would open an unbuilt surface (the Scribe writes nothing yet)
 * does not ship. Named layouts the user saves live beside these in the
 * layouts menu (./layouts.ts).
 */
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "reading",
    name: "Reading",
    blurb: "One unhurried pane, the dock closed",
    build: (book, chapter) => {
      const leaf = leafNode([readerTab(book, chapter)]);
      return { root: leaf, activePaneId: leaf.id, dockOpen: false };
    },
  },
  {
    id: "study",
    name: "Study",
    blurb: "Text beside text, commentary at hand",
    build: (book, chapter) => {
      const left = leafNode([readerTab(book, chapter)]);
      const right = leafNode([readerTab(book, chapter)]);
      return { root: sideBySide(left, right), activePaneId: left.id, dockOpen: true, dockTab: "commentary" };
    },
  },
  {
    id: "sermon-prep",
    name: "Sermon prep",
    blurb: "The text beside its Passage Guide, commentary at hand",
    build: (book, chapter) => {
      const left = leafNode([readerTab(book, chapter)]);
      const right = leafNode([guideTab(book, chapter)]);
      return { root: sideBySide(left, right), activePaneId: left.id, dockOpen: true, dockTab: "commentary" };
    },
  },
  {
    id: "word-study",
    name: "Word study",
    blurb: "The text beside the lexicon, ready for a word",
    build: (book, chapter) => {
      const left = leafNode([readerTab(book, chapter)]);
      const right = leafNode([lexiconTab(null)]);
      return { root: sideBySide(left, right), activePaneId: left.id, dockOpen: true, dockTab: "lexicon" };
    },
  },
  {
    id: "original-languages",
    name: "Original languages",
    blurb: "The text beside its Exegetical Guide",
    build: (book, chapter) => {
      const left = leafNode([readerTab(book, chapter)]);
      const right = leafNode([exegeticalTab(book, chapter)]);
      return { root: sideBySide(left, right), activePaneId: left.id, dockOpen: true, dockTab: "lexicon" };
    },
  },
];

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
  | { type: "navigateBack"; paneId: string }
  | { type: "navigateForward"; paneId: string }
  | { type: "openSearch"; q: string; mode?: SearchMode; paneId?: string }
  | { type: "openDocSearch"; q: string; paneId?: string }
  | { type: "openLexicon"; id: string }
  | { type: "openGuide"; book: string; chapter: number; paneId?: string }
  | {
      type: "openCustomGuide";
      guideId: string;
      name: string;
      book: string;
      chapter: number;
      paneId?: string;
    }
  | { type: "openGuideEditor"; guideId?: string | null; paneId?: string }
  | { type: "openWordStudy"; strongsId: string; paneId?: string }
  | { type: "openExegetical"; book: string; chapter: number; paneId?: string }
  | { type: "openTopicGuide"; work: string; topicId: string; title: string; paneId?: string }
  | { type: "openListDoc"; docId: string; title: string; paneId?: string }
  | { type: "openDesk"; paneId?: string }
  | { type: "openManuscript"; docId: string; title: string; paneId?: string }
  | { type: "openFactbook"; entityId: string; title: string; paneId?: string }
  | { type: "openLibrary"; paneId?: string }
  | { type: "openTextCompare"; book: string; chapter: number; paneId?: string }
  | { type: "openConcordance"; book: string; paneId?: string }
  | { type: "openAtlas"; place?: string; title?: string; paneId?: string }
  | { type: "openTimeline"; event?: string; title?: string; paneId?: string }
  | { type: "openMemory"; passageId?: string; paneId?: string }
  | { type: "openJournal"; paneId?: string }
  | { type: "openPrayers"; paneId?: string }
  | { type: "openPlans"; paneId?: string }
  | { type: "setConcordanceBook"; paneId: string; tabId: string; book: string }
  | { type: "setCompareBase"; paneId: string; tabId: string; base: string }
  | { type: "setReaderTranslation"; paneId: string; tabId: string; translation?: string }
  | { type: "setReaderFontScale"; paneId: string; tabId: string; fontScale: number }
  | { type: "selectVerse"; book: string; chapter: number; verse: number }
  | { type: "selectWord"; word: Omit<WordSelection, "kind"> }
  | { type: "clearSelection" }
  | { type: "compareRef"; book: string; chapter: number; translation: string; paneId?: string }
  | { type: "newTab"; paneId?: string }
  | { type: "replaceTab"; paneId: string; tabId: string; tab: Tab }
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
  | { type: "applyPreset"; preset: PresetId };

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

/** The stop a pane's active reader tab is showing; null for other tab kinds. */
function currentEntry(leaf: LeafNode): NavEntry | null {
  const active = leaf.tabs.find((t) => t.id === leaf.activeTabId);
  if (!active || active.type !== "reader") return null;
  return {
    book: active.book,
    chapter: active.chapter,
    ...(active.translation ? { translation: active.translation } : {}),
  };
}

function sameEntry(a: NavEntry, b: NavEntry): boolean {
  return a.book === b.book && a.chapter === b.chapter && a.translation === b.translation;
}

/**
 * Pushes a navigation onto the pane's trail: the stop being left goes on
 * first when the trail has lost track of it (a tab switch, a translation
 * swap), then the new stop, with any walked-past forward stops dropped.
 * A navigation to the stop already showing records nothing.
 */
function recordNav(leaf: LeafNode, next: NavEntry): LeafNode {
  const current = currentEntry(leaf);
  if (!current || sameEntry(current, next)) return leaf;
  const entries = leaf.history.entries.slice(0, leaf.history.index + 1);
  const last = entries[entries.length - 1];
  if (!last || !sameEntry(last, current)) entries.push(current);
  entries.push(next);
  const trimmed = entries.slice(-HISTORY_LIMIT);
  return { ...leaf, history: { entries: trimmed, index: trimmed.length - 1 } };
}

/** A retarget that enters the trail; a fresh tab opened beside records nothing. */
function recordRetarget(leaf: LeafNode, book: string, chapter: number): LeafNode {
  const active = leaf.tabs.find((t) => t.id === leaf.activeTabId);
  if (active && active.type === "reader") {
    const next: NavEntry = {
      book,
      chapter,
      ...(active.translation ? { translation: active.translation } : {}),
    };
    return openRefInLeaf(recordNav(leaf, next), book, chapter);
  }
  return openRefInLeaf(leaf, book, chapter);
}

/** Puts a trail stop back on the tab exactly, translation included. */
function applyEntryInLeaf(leaf: LeafNode, entry: NavEntry): LeafNode {
  const active = leaf.tabs.find((t) => t.id === leaf.activeTabId);
  if (!active || active.type !== "reader") return leaf;
  return {
    ...leaf,
    tabs: leaf.tabs.map((t) => {
      if (t.id !== active.id || t.type !== "reader") return t;
      const next: ReaderTab = { ...t, book: entry.book, chapter: entry.chapter };
      if (entry.translation) next.translation = entry.translation;
      else delete next.translation;
      return next;
    }),
  };
}

/**
 * Retargets a pane to a reference. When the pane wears a link letter, every
 * other pane in the same set whose active tab is a reader tab follows; tool
 * tabs and search tabs are untouched. This is the link-set half of every
 * navigation, including prev/next chapter inside a ReaderPane (it dispatches
 * openRef) and a chapter dropped on a pane's body. Every pane that moves
 * records the stop on its own trail. Back and forward pass a targetEntry:
 * the pane in focus applies the stop exactly and records nothing, while its
 * link-set partners follow and record as with any other navigation.
 */
function retargetLinked(
  root: PaneNode,
  paneId: string,
  book: string,
  chapter: number,
  targetEntry?: NavEntry
): PaneNode {
  const target = findLeaf(root, paneId);
  if (!target) return root;
  const withTarget = updateLeaf(root, paneId, (l) =>
    targetEntry ? applyEntryInLeaf(l, targetEntry) : recordRetarget(l, book, chapter)
  );
  if (!target.linkSet) return withTarget;
  const set = target.linkSet;
  const follow = (node: PaneNode): PaneNode => {
    if (node.kind === "leaf") {
      if (node.id === paneId || node.linkSet !== set) return node;
      const active = node.tabs.find((t) => t.id === node.activeTabId);
      return active && active.type === "reader" ? recordRetarget(node, book, chapter) : node;
    }
    const a = follow(node.children[0]);
    const b = a === node.children[0] ? follow(node.children[1]) : node.children[1];
    return a === node.children[0] && b === node.children[1] ? node : { ...node, children: [a, b] };
  };
  return follow(withTarget);
}

/**
 * Walks a pane's trail. The retarget goes through retargetLinked, so a
 * linked pane's partners follow a back the way they follow any navigation.
 * Out-of-trail walks and non-reader panes change nothing.
 */
function navigateHistory(state: WorkspaceState, paneId: string, dir: -1 | 1): WorkspaceState {
  const leaf = findLeaf(state.root, paneId);
  if (!leaf) return state;
  const active = leaf.tabs.find((t) => t.id === leaf.activeTabId);
  if (!active || active.type !== "reader") return state;
  const nextIndex = leaf.history.index + dir;
  const entry = leaf.history.entries[nextIndex];
  if (!entry) return state;
  const book = getBook(entry.book);
  if (!book) return state;
  const target = { book: book.slug, chapter: entry.chapter, ...(entry.translation ? { translation: entry.translation } : {}) };
  const retargeted = retargetLinked(state.root, paneId, target.book, target.chapter, target);
  return {
    ...state,
    selection: null,
    root: updateLeaf(retargeted, paneId, (l) => ({
      ...l,
      history: { entries: l.history.entries, index: nextIndex },
    })),
  };
}

/** A reader tab with its passage clamped to the canon; null for an unknown book. */
function clampReaderTab(tab: ReaderTab): ReaderTab | null {
  const book = getBook(tab.book);
  if (!book) return null;
  const chapter = Math.min(Math.max(1, Math.trunc(tab.chapter)), book.chapters);
  return chapter !== tab.chapter || book.slug !== tab.book
    ? { ...tab, book: book.slug, chapter }
    : tab;
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

    case "navigateBack":
      return navigateHistory(state, action.paneId, -1);

    case "navigateForward":
      return navigateHistory(state, action.paneId, 1);

    case "openSearch": {
      const q = action.q.trim();
      if (!q) return state;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      const tab = searchTab(q, action.mode);
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

    case "openDocSearch": {
      const q = action.q.trim();
      if (!q) return state;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      const tab = docSearchTab(q);
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

    case "openCustomGuide": {
      const guideId = action.guideId.trim();
      if (!guideId) return state;
      const book = getBook(action.book);
      if (!book) return state;
      const chapter = Math.min(Math.max(1, Math.trunc(action.chapter)), book.chapters);
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like the Passage Guide, the run pins its passage at open time.
      const name = action.name.trim() || "Custom guide";
      const tab = customGuideTab(guideId, name, book.slug, chapter);
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

    case "openGuideEditor": {
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      const guideId =
        typeof action.guideId === "string" && action.guideId.trim()
          ? action.guideId.trim()
          : null;
      const tab = guideEditorTab(guideId);
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

    case "openDesk": {
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      const leaf = findLeaf(state.root, paneId);
      if (!leaf) return state;
      // One desk per pane: a second open activates the tab already there,
      // the way the Library browser does.
      const existing = leaf.tabs.find((t) => t.type === "desk");
      if (existing) {
        return {
          ...state,
          activePaneId: paneId,
          root: updateLeaf(state.root, paneId, (l) => ({ ...l, activeTabId: existing.id })),
        };
      }
      const tab = deskTab();
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

    case "openManuscript": {
      const docId = action.docId.trim();
      if (!DOCUMENT_ID_PATTERN.test(docId)) return state;
      const title = action.title.trim() || "Untitled manuscript";
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      const leaf = findLeaf(state.root, paneId);
      if (!leaf) return state;
      // One tab per manuscript per pane: reopening the same document
      // activates the tab already there, the desk's singleton pattern keyed
      // by docId. Edits land in the collection and the pane reads them live.
      const existing = leaf.tabs.find((t) => t.type === "manuscript" && t.docId === docId);
      if (existing) {
        return {
          ...state,
          activePaneId: paneId,
          root: updateLeaf(state.root, paneId, (l) => ({ ...l, activeTabId: existing.id })),
        };
      }
      const tab = manuscriptTab(docId, title);
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

    case "openFactbook": {
      const entityId = action.entityId.trim();
      if (!ENTITY_ID_PATTERN.test(entityId)) return state;
      const title = action.title.trim() || entityId;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like a guide, the report pins its entity at open time.
      const tab = factbookTab(entityId, title);
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

    case "openLibrary": {
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      const leaf = findLeaf(state.root, paneId);
      if (!leaf) return state;
      // One browser per pane: a second open activates the tab already there.
      const existing = leaf.tabs.find((t) => t.type === "library");
      if (existing) {
        return {
          ...state,
          activePaneId: paneId,
          root: updateLeaf(state.root, paneId, (l) => ({ ...l, activeTabId: existing.id })),
        };
      }
      const tab = libraryTab();
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

    case "openTextCompare": {
      const book = getBook(action.book);
      if (!book) return state;
      const chapter = Math.min(Math.max(1, Math.trunc(action.chapter)), book.chapters);
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like a guide, the comparison pins its passage at open time.
      const tab = textCompareTab(book.slug, chapter);
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

    case "openConcordance": {
      const book = getBook(action.book);
      if (!book) return state;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like a guide, the concordance pins its book at open time.
      const tab = concordanceTab(book.slug);
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

    case "openAtlas": {
      const place = action.place?.trim();
      if (place && !ENTITY_ID_PATTERN.test(place)) return state;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like a guide, the map pins its focus at open time.
      const title = action.title?.trim() || undefined;
      const tab = atlasTab(place || undefined, title);
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

    case "openTimeline": {
      const event = action.event?.trim().toLowerCase();
      if (event && !EVENT_ID_PATTERN.test(event)) return state;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like a guide, the chart pins its focus at open time.
      const title = action.title?.trim() || undefined;
      const tab = timelineTab(event || undefined, title);
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

    case "openMemory": {
      const passageId = action.passageId?.trim();
      if (passageId && !MEMORY_ID_PATTERN.test(passageId)) return state;
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      if (!findLeaf(state.root, paneId)) return state;
      // Like a guide, the drill pins its passage at open time.
      const tab = memoryTab(passageId || undefined);
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

    case "openJournal":
    case "openPrayers":
    case "openPlans": {
      const paneId =
        action.paneId && findLeaf(state.root, action.paneId) ? action.paneId : state.activePaneId;
      const leaf = findLeaf(state.root, paneId);
      if (!leaf) return state;
      // One of each discipline per pane: a second open activates the tab
      // already there, the way the Library browser does.
      const type =
        action.type === "openJournal" ? "journal" : action.type === "openPrayers" ? "prayers" : "plans";
      const existing = leaf.tabs.find((t) => t.type === type);
      if (existing) {
        return {
          ...state,
          activePaneId: paneId,
          root: updateLeaf(state.root, paneId, (l) => ({ ...l, activeTabId: existing.id })),
        };
      }
      const tab =
        action.type === "openJournal"
          ? journalTab()
          : action.type === "openPrayers"
            ? prayersTab()
            : plansTab();
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
      // A new tab opens the launcher, keyed to the pane's passage; the old
      // plain-reader behavior survives as the launcher's first suggestion.
      const tab = launcherTab(paneRef(leaf) ?? undefined);
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

    case "replaceTab": {
      const leaf = findLeaf(state.root, action.paneId);
      if (!leaf) return state;
      const index = leaf.tabs.findIndex((t) => t.id === action.tabId);
      if (index < 0) return state;
      let tab = action.tab;
      if (tab.type === "reader") {
        const clamped = clampReaderTab(tab);
        if (!clamped) return state;
        tab = clamped;
      }
      // In place at the same index: the launcher hands its slot to whatever
      // was chosen, and the choice takes the focus.
      return {
        ...state,
        activePaneId: action.paneId,
        root: updateLeaf(state.root, action.paneId, (l) => ({
          ...l,
          tabs: l.tabs.map((t, i) => (i === index ? tab : t)),
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
        const clamped = clampReaderTab(tab);
        if (!clamped) return state;
        tab = clamped;
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

    case "setCompareBase": {
      const leaf = findLeaf(state.root, action.paneId);
      const tab = leaf?.tabs.find((t) => t.id === action.tabId);
      if (!leaf || !tab || tab.type !== "textcompare") return state;
      const base = action.base.trim().toLowerCase();
      if (!/^[a-z0-9-]{2,12}$/.test(base) || base === tab.base) return state;
      return {
        ...state,
        root: updateLeaf(state.root, action.paneId, (l) => ({
          ...l,
          tabs: l.tabs.map((t) =>
            t.id === action.tabId && t.type === "textcompare" ? { ...t, base } : t
          ),
        })),
      };
    }

    case "setConcordanceBook": {
      const book = getBook(action.book);
      if (!book) return state;
      const leaf = findLeaf(state.root, action.paneId);
      const tab = leaf?.tabs.find((t) => t.id === action.tabId);
      if (!leaf || !tab || tab.type !== "concordance" || tab.book === book.slug) return state;
      // In place, one pane only, like the comparison's base swap.
      return {
        ...state,
        root: updateLeaf(state.root, action.paneId, (l) => ({
          ...l,
          tabs: l.tabs.map((t) =>
            t.id === action.tabId && t.type === "concordance" ? { ...t, book: book.slug } : t
          ),
        })),
      };
    }

    case "setReaderTranslation": {
      const leaf = findLeaf(state.root, action.paneId);
      const tab = leaf?.tabs.find((t) => t.id === action.tabId);
      if (!leaf || !tab || tab.type !== "reader") return state;
      let translation: string | undefined;
      if (action.translation !== undefined) {
        const m = action.translation.trim().toLowerCase();
        if (!/^[a-z0-9-]{2,12}$/.test(m)) return state;
        translation = m;
      }
      if (translation === tab.translation) return state;
      // In place, one pane only: a swap never dispatches navigation, so
      // link-set partners keep their passage and their own text.
      return {
        ...state,
        root: updateLeaf(state.root, action.paneId, (l) => ({
          ...l,
          tabs: l.tabs.map((t) => {
            if (t.id !== action.tabId || t.type !== "reader") return t;
            const next = { ...t };
            if (translation) next.translation = translation;
            else delete next.translation;
            return next;
          }),
        })),
      };
    }

    case "setReaderFontScale": {
      const leaf = findLeaf(state.root, action.paneId);
      const tab = leaf?.tabs.find((t) => t.id === action.tabId);
      if (!leaf || !tab || tab.type !== "reader") return state;
      const fontScale = Math.trunc(action.fontScale);
      if (fontScale < 1 || fontScale > 5) return state;
      if ((tab.fontScale ?? READER_FONT_SCALE_DEFAULT) === fontScale) return state;
      // In place, one pane only, like a translation swap: a resize never
      // dispatches navigation, so link-set partners keep their own scale.
      return {
        ...state,
        root: updateLeaf(state.root, action.paneId, (l) => ({
          ...l,
          tabs: l.tabs.map((t) => {
            if (t.id !== action.tabId || t.type !== "reader") return t;
            const next = { ...t };
            if (fontScale === READER_FONT_SCALE_DEFAULT) delete next.fontScale;
            else next.fontScale = fontScale;
            return next;
          }),
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
      const preset = LAYOUT_PRESETS.find((p) => p.id === action.preset);
      if (!preset) return state;
      // A preset builds around the passage in focus, Genesis 1 at the outside.
      const current = paneRef(findLeaf(state.root, state.activePaneId) ?? firstLeaf(state.root)) ?? {
        book: "genesis",
        chapter: 1,
      };
      return { ...state, ...preset.build(current.book, current.chapter), selection: null };
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
        // Old search tabs carry no mode and read as the Bible concordance.
        const mode = t.mode === "original" || t.mode === "semantic" ? t.mode : undefined;
        tabs.push({ id: t.id, type: "search", q: t.q, ...(mode ? { mode } : {}) });
        continue;
      }
      if (
        t.type === "docsearch" &&
        typeof t.id === "string" &&
        typeof t.q === "string" &&
        t.q.trim()
      ) {
        tabs.push({ id: t.id, type: "docsearch", q: t.q });
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
      if (
        t.type === "customguide" &&
        typeof t.id === "string" &&
        typeof t.guideId === "string" &&
        t.guideId.trim() &&
        typeof t.book === "string"
      ) {
        const book = getBook(t.book);
        if (!book) continue;
        const chapter =
          typeof t.chapter === "number" && Number.isInteger(t.chapter)
            ? Math.min(Math.max(1, t.chapter), book.chapters)
            : 1;
        // The guide itself may be gone; the tab still loads and degrades at
        // render, the way a deleted list document's tab does.
        const name =
          typeof t.name === "string" && t.name.trim() ? t.name : "Custom guide";
        tabs.push({ id: t.id, type: "customguide", guideId: t.guideId, name, book: book.slug, chapter });
        continue;
      }
      if (t.type === "guideeditor" && typeof t.id === "string") {
        const guideId =
          typeof t.guideId === "string" && t.guideId.trim() ? t.guideId : null;
        tabs.push({ id: t.id, type: "guideeditor", guideId });
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
      if (t.type === "desk" && typeof t.id === "string") {
        // A singleton; it carries nothing to validate.
        tabs.push({ id: t.id, type: "desk" });
        continue;
      }
      if (t.type === "manuscript" && typeof t.id === "string") {
        // A malformed id drops the tab; an id that answers to no document
        // loads anyway and the pane says the manuscript is gone.
        if (typeof t.docId !== "string" || !DOCUMENT_ID_PATTERN.test(t.docId)) continue;
        const title =
          typeof t.title === "string" && t.title.trim() ? t.title : "Untitled manuscript";
        tabs.push({ id: t.id, type: "manuscript", docId: t.docId, title });
        continue;
      }
      if (t.type === "factbook" && typeof t.id === "string") {
        if (typeof t.entityId !== "string" || !ENTITY_ID_PATTERN.test(t.entityId)) continue;
        const title =
          typeof t.title === "string" && t.title.trim() ? t.title : t.entityId;
        tabs.push({ id: t.id, type: "factbook", entityId: t.entityId, title });
        continue;
      }
      if (t.type === "library" && typeof t.id === "string") {
        tabs.push({ id: t.id, type: "library" });
        continue;
      }
      if (t.type === "textcompare" && typeof t.id === "string" && typeof t.book === "string") {
        const book = getBook(t.book);
        if (!book) continue;
        const chapter =
          typeof t.chapter === "number" && Number.isInteger(t.chapter)
            ? Math.min(Math.max(1, t.chapter), book.chapters)
            : 1;
        const base =
          typeof t.base === "string" && /^[a-z0-9-]{2,12}$/i.test(t.base)
            ? t.base.toLowerCase()
            : COMPARE_BASE_DEFAULT;
        tabs.push({ id: t.id, type: "textcompare", book: book.slug, chapter, base });
        continue;
      }
      if (t.type === "concordance" && typeof t.id === "string" && typeof t.book === "string") {
        const book = getBook(t.book);
        if (!book) continue;
        tabs.push({ id: t.id, type: "concordance", book: book.slug });
        continue;
      }
      if (t.type === "atlas" && typeof t.id === "string") {
        // The focus is optional; a malformed one drops and the map still loads.
        const place =
          typeof t.place === "string" && ENTITY_ID_PATTERN.test(t.place) ? t.place : undefined;
        const title =
          place && typeof t.title === "string" && t.title.trim() ? t.title : undefined;
        tabs.push({
          id: t.id,
          type: "atlas",
          ...(place ? { place } : {}),
          ...(title ? { title } : {}),
        });
        continue;
      }
      if (t.type === "timeline" && typeof t.id === "string") {
        // Like the atlas, the focus is optional and a bad one drops.
        const event =
          typeof t.event === "string" && EVENT_ID_PATTERN.test(t.event) ? t.event : undefined;
        const title =
          event && typeof t.title === "string" && t.title.trim() ? t.title : undefined;
        tabs.push({
          id: t.id,
          type: "timeline",
          ...(event ? { event } : {}),
          ...(title ? { title } : {}),
        });
        continue;
      }
      if (t.type === "memory" && typeof t.id === "string") {
        // Like the atlas focus, the drill pin is optional and a bad one drops.
        const passageId =
          typeof t.passageId === "string" && MEMORY_ID_PATTERN.test(t.passageId)
            ? t.passageId
            : undefined;
        tabs.push({ id: t.id, type: "memory", ...(passageId ? { passageId } : {}) });
        continue;
      }
      if (
        (t.type === "journal" || t.type === "prayers" || t.type === "plans") &&
        typeof t.id === "string"
      ) {
        // Singletons carry nothing to validate.
        tabs.push({ id: t.id, type: t.type });
        continue;
      }
      if (t.type === "launcher" && typeof t.id === "string") {
        // The pinned passage is validated the way a guide's is; a launcher
        // without one still loads, with the reference-aware rows staying out.
        if (typeof t.book === "string") {
          const book = getBook(t.book);
          if (book) {
            const chapter =
              typeof t.chapter === "number" && Number.isInteger(t.chapter)
                ? Math.min(Math.max(1, t.chapter), book.chapters)
                : 1;
            tabs.push({ id: t.id, type: "launcher", book: book.slug, chapter });
            continue;
          }
        }
        tabs.push({ id: t.id, type: "launcher" });
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
      // Older sessions predate text scaling; an absent or malformed step
      // reads as the default rather than failing the load.
      const fontScale =
        typeof t.fontScale === "number" && Number.isInteger(t.fontScale)
          ? Math.min(Math.max(1, t.fontScale), 5)
          : undefined;
      tabs.push({
        id: t.id,
        type: "reader",
        book: book.slug,
        chapter,
        ...(translation ? { translation } : {}),
        ...(fontScale !== undefined && fontScale !== READER_FONT_SCALE_DEFAULT
          ? { fontScale }
          : {}),
      });
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
    return { kind: "leaf", id: n.id, tabs, activeTabId, linkSet, history: sanitizeHistory(n.history) };
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

/**
 * A pane's persisted trail. Older sessions predate pane history; an absent
 * or malformed trail reads as empty rather than failing the load, and each
 * stop is validated the way a reader tab is.
 */
function sanitizeHistory(raw: unknown): PaneHistory {
  if (typeof raw !== "object" || raw === null) return { entries: [], index: -1 };
  const h = raw as Record<string, unknown>;
  if (!Array.isArray(h.entries)) return { entries: [], index: -1 };
  const entries: NavEntry[] = [];
  for (const e of h.entries) {
    if (typeof e !== "object" || e === null) continue;
    const r = e as Record<string, unknown>;
    if (typeof r.book !== "string") continue;
    const book = getBook(r.book);
    if (!book) continue;
    const chapter =
      typeof r.chapter === "number" && Number.isInteger(r.chapter)
        ? Math.min(Math.max(1, r.chapter), book.chapters)
        : 1;
    const translation =
      typeof r.translation === "string" && /^[a-z0-9-]{2,12}$/i.test(r.translation)
        ? r.translation.toLowerCase()
        : undefined;
    entries.push({ book: book.slug, chapter, ...(translation ? { translation } : {}) });
  }
  const trimmed = entries.slice(-HISTORY_LIMIT);
  const index =
    typeof h.index === "number" && Number.isInteger(h.index)
      ? Math.min(Math.max(-1, h.index), trimmed.length - 1)
      : trimmed.length - 1;
  return { entries: trimmed, index };
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
  return sanitizeWorkspace(p);
}

/**
 * Validates a stored snapshot the way the session load does; null when it is
 * beyond repair. Saved layouts restore through this (./layouts.ts), so a
 * layout written by an older build degrades the way an old session would.
 */
export function sanitizeWorkspace(p: Partial<StoredWorkspace>): WorkspaceState | null {
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
