"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  DEFAULT_STATE,
  findLeaf,
  loadWorkspace,
  paneRef,
  saveWorkspace,
  workspaceReducer,
  type LinkSet,
  type WorkspaceAction,
  type WorkspaceState,
} from "./workspace-state";
import { recordSearch } from "@/lib/search-history";

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

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  /** False until the persisted workspace has been restored. */
  hydrated: boolean;
  /** The passage the pane in focus shows; the dock's tools answer it. */
  activeRef: { book: string; chapter: number } | null;
  /** Broadcasts a topmost-visible-verse report to the pane's link set. */
  reportLinkedVerse: (notice: LinkedVerseNotice) => void;
  /** Subscribes to linked-verse reports; returns the unsubscribe. */
  subscribeLinkedVerse: (listener: (notice: LinkedVerseNotice) => void) => () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // First render matches the server exactly; the persisted tree is restored
  // in an effect so hydration never mismatches.
  const [state, dispatch] = useReducer(workspaceReducer, DEFAULT_STATE);
  const [hydrated, setHydrated] = useReducer(() => true, false);
  /** The passage in focus, readable inside the mount-once event listeners. */
  const activeRefRef = useRef<{ book: string; chapter: number } | null>(null);

  useEffect(() => {
    const saved = loadWorkspace();
    if (saved) dispatch({ type: "hydrate", state: saved });
    setHydrated();
  }, []);

  // Continuous session persistence: every state change is saved.
  useEffect(() => {
    if (hydrated) saveWorkspace(state);
  }, [state, hydrated]);

  /*
   * The omnibox's side of the event contract (src/components/palette/
   * Omnibox.tsx). The palette owns Ctrl/Cmd+K itself and opens on
   * "berean:omnibox-toggle"; the shell answers these intents on the window.
   */
  useEffect(() => {
    const onOpenRef = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string; chapter?: number }>).detail;
      if (!detail || typeof detail.book !== "string") return;
      dispatch({ type: "openRef", book: detail.book, chapter: Number(detail.chapter) || 1 });
    };
    const onSearch = (e: Event) => {
      const detail = (e as CustomEvent<{ q?: string }>).detail;
      if (!detail || typeof detail.q !== "string") return;
      // Every search, from anywhere, enters the rail's re-runnable history.
      recordSearch(detail.q);
      dispatch({ type: "openSearch", q: detail.q });
    };
    const onOpenLexicon = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail || typeof detail.id !== "string" || !detail.id.trim()) return;
      dispatch({ type: "openLexicon", id: detail.id.trim().toUpperCase() });
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
      dispatch({ type: "openGuide", book, chapter });
    };
    const onOpenWordStudy = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail || typeof detail.id !== "string" || !detail.id.trim()) return;
      dispatch({ type: "openWordStudy", strongsId: detail.id.trim() });
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
      dispatch({ type: "openExegetical", book, chapter });
    };
    const onOpenTopicGuide = (e: Event) => {
      const detail = (e as CustomEvent<{ work?: string; id?: string; title?: string }>).detail;
      if (!detail || typeof detail.work !== "string" || typeof detail.id !== "string") return;
      if (!detail.id.trim()) return;
      dispatch({
        type: "openTopicGuide",
        work: detail.work,
        topicId: detail.id.trim(),
        title: typeof detail.title === "string" ? detail.title : detail.id.trim(),
      });
    };
    const onToggleDock = () => dispatch({ type: "toggleDock" });
    const onApplyPreset = (e: Event) => {
      const preset = (e as CustomEvent<{ preset?: string }>).detail?.preset;
      if (preset === "reading" || preset === "study") dispatch({ type: "applyPreset", preset });
    };
    // Escape lets the selection go, unless the user is typing in a field.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return;
      dispatch({ type: "clearSelection" });
    };
    window.addEventListener("berean:open-ref", onOpenRef);
    window.addEventListener("berean:search", onSearch);
    window.addEventListener("berean:open-lexicon", onOpenLexicon);
    window.addEventListener("berean:open-guide", onOpenGuide);
    window.addEventListener("berean:open-wordstudy", onOpenWordStudy);
    window.addEventListener("berean:open-exegetical", onOpenExegetical);
    window.addEventListener("berean:open-topicguide", onOpenTopicGuide);
    window.addEventListener("berean:toggle-right-dock", onToggleDock);
    window.addEventListener("berean:apply-preset", onApplyPreset);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("berean:open-ref", onOpenRef);
      window.removeEventListener("berean:search", onSearch);
      window.removeEventListener("berean:open-lexicon", onOpenLexicon);
      window.removeEventListener("berean:open-guide", onOpenGuide);
      window.removeEventListener("berean:open-wordstudy", onOpenWordStudy);
      window.removeEventListener("berean:open-exegetical", onOpenExegetical);
      window.removeEventListener("berean:open-topicguide", onOpenTopicGuide);
      window.removeEventListener("berean:toggle-right-dock", onToggleDock);
      window.removeEventListener("berean:apply-preset", onApplyPreset);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

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

  const value = useMemo(
    () => ({ state, dispatch, hydrated, activeRef, reportLinkedVerse, subscribeLinkedVerse }),
    [state, hydrated, activeRef, reportLinkedVerse, subscribeLinkedVerse]
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
