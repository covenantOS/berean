"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  DEFAULT_STATE,
  findLeaf,
  LAYOUT_PRESETS,
  loadWorkspace,
  paneRef,
  saveWorkspace,
  STORAGE_KEY,
  workspaceReducer,
  type LinkSet,
  type PresetId,
  type WorkspaceAction,
  type WorkspaceState,
} from "./workspace-state";
import { layoutState, layouts } from "./layouts";
import { isOnboarded } from "@/lib/onboarding";
import { recordSearch } from "@/lib/search-history";
import { playSound, type SoundName } from "@/lib/sound";

/**
 * A pane's report of its topmost visible verse, broadcast to the rest of its
 * link set so linked readers scroll together. Transient by design: it lives
 * in a listener set, never in the persisted state tree.
 */
export interface LinkedVerseNotice {
  paneId: string;
  linkSet: LinkSet;
  book: string;
  chapter: number;
  verse: number;
}

/**
 * The reference under the pointer anywhere in the workspace (a cross-ref
 * chip, a guide entry), broadcast so open readers showing that chapter can
 * emphasize the matching verses. Transient by design: a null report clears.
 */
export interface HoverRefNotice {
  book: string;
  chapter: number;
  /** First and last verse of the hovered reference, same chapter. */
  fromVerse: number;
  toVerse: number;
}

/**
 * The word under the pointer anywhere in the workspace (a tagged KJV word,
 * an original-language token, a guide's word card), as the base Strong's
 * ids it carries, broadcast so every open pane emphasizes its own words
 * sharing one. Transient by design: a null report clears.
 */
export interface HoverWordNotice {
  /** Base Strong's ids of the hovered word (src/lib/strongs.ts form). */
  strongs: string[];
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  /** False until the persisted workspace has been restored. */
  hydrated: boolean;
  /** True on a device with no session and no onboarded mark; the welcome answers it. */
  firstRun: boolean;
  /** The passage the pane in focus shows; the dock's tools answer it. */
  activeRef: { book: string; chapter: number } | null;
  /** Broadcasts a topmost-visible-verse report to the pane's link set. */
  reportLinkedVerse: (notice: LinkedVerseNotice) => void;
  /** Subscribes to linked-verse reports; returns the unsubscribe. */
  subscribeLinkedVerse: (listener: (notice: LinkedVerseNotice) => void) => () => void;
  /** Broadcasts the hovered reference (or null when the hover ends). */
  reportHoverRef: (notice: HoverRefNotice | null) => void;
  /** Subscribes to hovered-reference reports; returns the unsubscribe. */
  subscribeHoverRef: (listener: (notice: HoverRefNotice | null) => void) => () => void;
  /** Broadcasts the hovered word's base Strong's ids (or null on hover out). */
  reportHoverWord: (notice: HoverWordNotice | null) => void;
  /** Subscribes to hovered-word reports; returns the unsubscribe. */
  subscribeHoverWord: (listener: (notice: HoverWordNotice | null) => void) => () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/**
 * The chime a workspace action answers with, or null when the action keeps
 * silent. The whole open* family chimes open: the singletons among them
 * (settings, tools, the explorer) focus the tab already there, but the
 * surface still rises into view, which is what the bell names. openRef is
 * named ahead of the family because it navigates an already-open reader
 * rather than opening anything. closePane rides with closeTab: a pane
 * leaving takes its tabs with it, and one falling figure covers them all.
 * Focus, selection, drags, ratio changes, and scroll stay silent, and boot
 * stays silent too: the initial hydrate never passes through here.
 */
function soundForAction(action: WorkspaceAction): SoundName | null {
  switch (action.type) {
    case "openRef":
      return "navigate";
    case "closeTab":
    case "closePane":
      return "close";
    case "applyPreset":
      return "complete";
    case "newTab":
      return "open";
    default:
      return action.type.startsWith("open") ? "open" : null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // First render matches the server exactly; the persisted tree is restored
  // in an effect so hydration never mismatches.
  const [state, dispatch] = useReducer(workspaceReducer, DEFAULT_STATE);
  const [hydrated, setHydrated] = useReducer(() => true, false);
  const [firstRun, setFirstRun] = useState(false);
  /** The passage in focus, readable inside the mount-once event listeners. */
  const activeRefRef = useRef<{ book: string; chapter: number } | null>(null);

  useEffect(() => {
    const saved = loadWorkspace();
    if (saved) {
      dispatch({ type: "hydrate", state: saved });
    } else if (window.localStorage.getItem(STORAGE_KEY) === null && !isOnboarded()) {
      // Read before the first save writes the session key: a device with no
      // session at all is new, while a stored session that failed to parse
      // was a session and is not. The welcome overlay answers this once.
      setFirstRun(true);
    }
    setHydrated();
  }, []);

  // Continuous session persistence: every state change is saved.
  useEffect(() => {
    if (hydrated) saveWorkspace(state);
  }, [state, hydrated]);

  /*
   * The study's small bells, wired once at the shell's switchboard. Every
   * tab, navigation, and layout change in the workspace funnels through
   * this dispatch, so the chimes live here rather than in forty call
   * sites: a tab arriving chimes open, a tab leaving chimes close, a
   * passage navigation strikes the single navigate note, and an applied
   * preset answers complete. The bell rings for the gesture even where the
   * reducer no-ops (closing what is already gone); the gesture is what the
   * ear confirms. Boot keeps silent by design: the mount effect above
   * dispatches its hydrate through the plain reducer, never through here.
   */
  const soundedDispatch = useCallback<Dispatch<WorkspaceAction>>((action) => {
    const chime = soundForAction(action);
    if (chime) playSound(chime);
    dispatch(action);
  }, []);

  /*
   * The omnibox's side of the event contract (src/components/palette/
   * Omnibox.tsx). The palette owns Ctrl/Cmd+K itself and opens on
   * "berean:omnibox-toggle"; the shell answers these intents on the window.
   * Every intent lands on the sounded switchboard, so a window event chimes
   * exactly like the same gesture made inside a pane.
   */
  useEffect(() => {
    const onOpenRef = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string; chapter?: number }>).detail;
      if (!detail || typeof detail.book !== "string") return;
      soundedDispatch({ type: "openRef", book: detail.book, chapter: Number(detail.chapter) || 1 });
    };
    const onSearch = (e: Event) => {
      const detail = (e as CustomEvent<{ q?: string }>).detail;
      if (!detail || typeof detail.q !== "string") return;
      // Every search, from anywhere, enters the rail's re-runnable history.
      recordSearch(detail.q);
      soundedDispatch({ type: "openSearch", q: detail.q });
    };
    const onOpenLexicon = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail || typeof detail.id !== "string" || !detail.id.trim()) return;
      soundedDispatch({ type: "openLexicon", id: detail.id.trim().toUpperCase() });
    };
    const onOpenGuide = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string; chapter?: number }>).detail;
      // A guide asked for without a passage takes the pane in focus.
      const book =
        detail && typeof detail.book === "string" ? detail.book : activeRefRef.current?.book;
      if (!book) return;
      const chapter =
        detail && typeof detail.chapter === "number"
          ? detail.chapter
          : (activeRefRef.current?.chapter ?? 1);
      soundedDispatch({ type: "openGuide", book, chapter });
    };
    const onOpenCustomGuide = (e: Event) => {
      const detail = (
        e as CustomEvent<{ guideId?: string; name?: string; book?: string; chapter?: number }>
      ).detail;
      if (!detail || typeof detail.guideId !== "string" || !detail.guideId.trim()) return;
      // Like the built-in guides, an absent ref takes the pane in focus.
      const book =
        typeof detail.book === "string" ? detail.book : activeRefRef.current?.book;
      if (!book) return;
      const chapter =
        typeof detail.chapter === "number"
          ? detail.chapter
          : (activeRefRef.current?.chapter ?? 1);
      soundedDispatch({
        type: "openCustomGuide",
        guideId: detail.guideId,
        name: typeof detail.name === "string" ? detail.name : "",
        book,
        chapter,
      });
    };
    const onOpenGuideEditor = (e: Event) => {
      const detail = (e as CustomEvent<{ guideId?: string }>).detail;
      soundedDispatch({
        type: "openGuideEditor",
        guideId: detail && typeof detail.guideId === "string" ? detail.guideId : null,
      });
    };
    const onOpenWordStudy = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail || typeof detail.id !== "string" || !detail.id.trim()) return;
      soundedDispatch({ type: "openWordStudy", strongsId: detail.id.trim() });
    };
    const onOpenExegetical = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string; chapter?: number }>).detail;
      // Like the Passage Guide, an absent ref takes the pane in focus.
      const book =
        detail && typeof detail.book === "string" ? detail.book : activeRefRef.current?.book;
      if (!book) return;
      const chapter =
        detail && typeof detail.chapter === "number"
          ? detail.chapter
          : (activeRefRef.current?.chapter ?? 1);
      soundedDispatch({ type: "openExegetical", book, chapter });
    };
    const onOpenSermonStarter = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string; chapter?: number }>).detail;
      // Like the Passage Guide, an absent ref takes the pane in focus.
      const book =
        detail && typeof detail.book === "string" ? detail.book : activeRefRef.current?.book;
      if (!book) return;
      const chapter =
        detail && typeof detail.chapter === "number"
          ? detail.chapter
          : (activeRefRef.current?.chapter ?? 1);
      soundedDispatch({ type: "openSermonStarter", book, chapter });
    };
    const onOpenTopicGuide = (e: Event) => {
      const detail = (e as CustomEvent<{ work?: string; id?: string; title?: string }>).detail;
      if (!detail || typeof detail.work !== "string" || typeof detail.id !== "string") return;
      if (!detail.id.trim()) return;
      soundedDispatch({
        type: "openTopicGuide",
        work: detail.work,
        topicId: detail.id.trim(),
        title: typeof detail.title === "string" ? detail.title : detail.id.trim(),
      });
    };
    const onOpenFactbook = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string; name?: string }>).detail;
      if (!detail || typeof detail.id !== "string" || !detail.id.trim()) return;
      soundedDispatch({
        type: "openFactbook",
        entityId: detail.id.trim(),
        title: typeof detail.name === "string" ? detail.name : detail.id.trim(),
      });
    };
    const onOpenTextCompare = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string; chapter?: number }>).detail;
      // Like the guides, an absent ref takes the pane in focus.
      const book =
        detail && typeof detail.book === "string" ? detail.book : activeRefRef.current?.book;
      if (!book) return;
      const chapter =
        detail && typeof detail.chapter === "number"
          ? detail.chapter
          : (activeRefRef.current?.chapter ?? 1);
      soundedDispatch({ type: "openTextCompare", book, chapter });
    };
    const onOpenMultiview = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string; chapter?: number }>).detail;
      // Like the guides, an absent ref takes the pane in focus.
      const book =
        detail && typeof detail.book === "string" ? detail.book : activeRefRef.current?.book;
      if (!book) return;
      const chapter =
        detail && typeof detail.chapter === "number"
          ? detail.chapter
          : (activeRefRef.current?.chapter ?? 1);
      soundedDispatch({ type: "openMultiview", book, chapter });
    };
    const onOpenConcordance = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string }>).detail;
      // An absent book takes the pane in focus, like the guides.
      const book =
        detail && typeof detail.book === "string" ? detail.book : activeRefRef.current?.book;
      if (!book) return;
      soundedDispatch({ type: "openConcordance", book });
    };
    const onToggleDock = () => soundedDispatch({ type: "toggleDock" });
    const onOpenSettings = () => soundedDispatch({ type: "openSettings" });
    const onOpenTools = () => soundedDispatch({ type: "openTools" });
    const onApplyPreset = (e: Event) => {
      const preset = (e as CustomEvent<{ preset?: string }>).detail?.preset;
      if (LAYOUT_PRESETS.some((p) => p.id === preset)) {
        soundedDispatch({ type: "applyPreset", preset: preset as PresetId });
      }
    };
    const onRestoreLayout = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      const layout = layouts.get(id);
      const restored = layout ? layoutState(layout) : null;
      // Hydrate replaces the whole tree; the save effect persists it from there.
      // A restored layout is an applied layout, so it answers complete like a
      // preset; the chime lives here rather than in the switchboard because
      // boot and restore both arrive as hydrate, and only restore is a doing.
      if (restored) {
        playSound("complete");
        soundedDispatch({ type: "hydrate", state: restored });
      }
    };
    // Escape lets the selection go, unless the user is typing in a field.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return;
      soundedDispatch({ type: "clearSelection" });
    };
    window.addEventListener("berean:open-ref", onOpenRef);
    window.addEventListener("berean:search", onSearch);
    window.addEventListener("berean:open-lexicon", onOpenLexicon);
    window.addEventListener("berean:open-guide", onOpenGuide);
    window.addEventListener("berean:open-customguide", onOpenCustomGuide);
    window.addEventListener("berean:open-guideeditor", onOpenGuideEditor);
    window.addEventListener("berean:open-wordstudy", onOpenWordStudy);
    window.addEventListener("berean:open-exegetical", onOpenExegetical);
    window.addEventListener("berean:open-sermonstarter", onOpenSermonStarter);
    window.addEventListener("berean:open-topicguide", onOpenTopicGuide);
    window.addEventListener("berean:open-factbook", onOpenFactbook);
    window.addEventListener("berean:open-textcompare", onOpenTextCompare);
    window.addEventListener("berean:open-multiview", onOpenMultiview);
    window.addEventListener("berean:open-concordance", onOpenConcordance);
    window.addEventListener("berean:toggle-right-dock", onToggleDock);
    window.addEventListener("berean:open-settings", onOpenSettings);
    window.addEventListener("berean:open-tools", onOpenTools);
    window.addEventListener("berean:apply-preset", onApplyPreset);
    window.addEventListener("berean:restore-layout", onRestoreLayout);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("berean:open-ref", onOpenRef);
      window.removeEventListener("berean:search", onSearch);
      window.removeEventListener("berean:open-lexicon", onOpenLexicon);
      window.removeEventListener("berean:open-guide", onOpenGuide);
      window.removeEventListener("berean:open-customguide", onOpenCustomGuide);
      window.removeEventListener("berean:open-guideeditor", onOpenGuideEditor);
      window.removeEventListener("berean:open-wordstudy", onOpenWordStudy);
      window.removeEventListener("berean:open-exegetical", onOpenExegetical);
      window.removeEventListener("berean:open-sermonstarter", onOpenSermonStarter);
      window.removeEventListener("berean:open-topicguide", onOpenTopicGuide);
      window.removeEventListener("berean:open-factbook", onOpenFactbook);
      window.removeEventListener("berean:open-textcompare", onOpenTextCompare);
      window.removeEventListener("berean:open-multiview", onOpenMultiview);
      window.removeEventListener("berean:open-concordance", onOpenConcordance);
      window.removeEventListener("berean:toggle-right-dock", onToggleDock);
      window.removeEventListener("berean:open-settings", onOpenSettings);
      window.removeEventListener("berean:open-tools", onOpenTools);
      window.removeEventListener("berean:apply-preset", onApplyPreset);
      window.removeEventListener("berean:restore-layout", onRestoreLayout);
      window.removeEventListener("keydown", onKey);
    };
  }, [soundedDispatch]);

  // Derived, never stored: wherever a pane navigates, the dock follows.
  const activeRef = useMemo(() => {
    const leaf = findLeaf(state.root, state.activePaneId);
    return leaf ? paneRef(leaf) : null;
  }, [state.root, state.activePaneId]);
  activeRefRef.current = activeRef;

  /*
   * The scroll-sync bus for link sets. Kept outside React state so a
   * throttled scroll report does not re-render the whole shell; only the
   * linked readers listen. Stable identities keep the context value calm.
   */
  const verseListeners = useRef(new Set<(notice: LinkedVerseNotice) => void>());
  const reportLinkedVerse = useCallback((notice: LinkedVerseNotice) => {
    for (const listener of verseListeners.current) listener(notice);
  }, []);
  const subscribeLinkedVerse = useCallback(
    (listener: (notice: LinkedVerseNotice) => void) => {
      verseListeners.current.add(listener);
      return () => {
        verseListeners.current.delete(listener);
      };
    },
    []
  );

  /*
   * The hover-emphasis bus, same shape as the scroll-sync bus: reference
   * chips report the passage under the pointer, open readers listen, and a
   * null report clears. Kept outside React state so a pointer crossing a
   * dock does not re-render the shell.
   */
  const hoverListeners = useRef(new Set<(notice: HoverRefNotice | null) => void>());
  const reportHoverRef = useCallback((notice: HoverRefNotice | null) => {
    for (const listener of hoverListeners.current) listener(notice);
  }, []);
  const subscribeHoverRef = useCallback(
    (listener: (notice: HoverRefNotice | null) => void) => {
      hoverListeners.current.add(listener);
      return () => {
        hoverListeners.current.delete(listener);
      };
    },
    []
  );

  /*
   * The lemma hover bus, the hover-emphasis bus's twin at word granularity:
   * tagged and original words report the base Strong's ids under the
   * pointer, open readers and guides listen, and a null report clears. Same
   * reason for living outside React state: a pointer crossing a verse must
   * not re-render the shell.
   */
  const wordListeners = useRef(new Set<(notice: HoverWordNotice | null) => void>());
  const reportHoverWord = useCallback((notice: HoverWordNotice | null) => {
    for (const listener of wordListeners.current) listener(notice);
  }, []);
  const subscribeHoverWord = useCallback(
    (listener: (notice: HoverWordNotice | null) => void) => {
      wordListeners.current.add(listener);
      return () => {
        wordListeners.current.delete(listener);
      };
    },
    []
  );

  const value = useMemo(
    () => ({
      state,
      dispatch: soundedDispatch,
      hydrated,
      firstRun,
      activeRef,
      reportLinkedVerse,
      subscribeLinkedVerse,
      reportHoverRef,
      subscribeHoverRef,
      reportHoverWord,
      subscribeHoverWord,
    }),
    [
      state,
      soundedDispatch,
      hydrated,
      firstRun,
      activeRef,
      reportLinkedVerse,
      subscribeLinkedVerse,
      reportHoverRef,
      subscribeHoverRef,
      reportHoverWord,
      subscribeHoverWord,
    ]
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
