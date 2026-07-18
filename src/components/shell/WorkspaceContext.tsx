"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
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
  type WorkspaceAction,
  type WorkspaceState,
} from "./workspace-state";

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  /** False until the persisted workspace has been restored. */
  hydrated: boolean;
  /** The passage the pane in focus shows; the dock's tools answer it. */
  activeRef: { book: string; chapter: number } | null;
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
      dispatch({ type: "openSearch", q: detail.q });
    };
    const onOpenLexicon = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail || typeof detail.id !== "string" || !detail.id.trim()) return;
      dispatch({ type: "openLexicon", id: detail.id.trim().toUpperCase() });
    };
    const onToggleDock = () => dispatch({ type: "toggleDock" });
    const onApplyPreset = (e: Event) => {
      const preset = (e as CustomEvent<{ preset?: string }>).detail?.preset;
      if (preset === "reading" || preset === "study") dispatch({ type: "applyPreset", preset });
    };
    window.addEventListener("berean:open-ref", onOpenRef);
    window.addEventListener("berean:search", onSearch);
    window.addEventListener("berean:open-lexicon", onOpenLexicon);
    window.addEventListener("berean:toggle-right-dock", onToggleDock);
    window.addEventListener("berean:apply-preset", onApplyPreset);
    return () => {
      window.removeEventListener("berean:open-ref", onOpenRef);
      window.removeEventListener("berean:search", onSearch);
      window.removeEventListener("berean:open-lexicon", onOpenLexicon);
      window.removeEventListener("berean:toggle-right-dock", onToggleDock);
      window.removeEventListener("berean:apply-preset", onApplyPreset);
    };
  }, []);

  // Derived, never stored: wherever a pane navigates, the dock follows.
  const activeRef = useMemo(() => {
    const leaf = findLeaf(state.root, state.activePaneId);
    return leaf ? paneRef(leaf) : null;
  }, [state.root, state.activePaneId]);

  const value = useMemo(
    () => ({ state, dispatch, hydrated, activeRef }),
    [state, hydrated, activeRef]
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
