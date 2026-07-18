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
  loadWorkspace,
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

  useEffect(() => {
    // Ctrl/Cmd+K is reserved for the command palette (built separately).
    // The shell only announces the intent on the window.
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("berean:palette"));
      }
    };
    // Any part of the app (or another agent's palette) can ask the
    // workspace to open a reference in the pane in focus.
    const onOpenRef = (e: Event) => {
      const detail = (e as CustomEvent<{ book?: string; chapter?: number }>).detail;
      if (!detail || typeof detail.book !== "string") return;
      dispatch({ type: "openRef", book: detail.book, chapter: Number(detail.chapter) || 1 });
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("berean:open-ref", onOpenRef);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("berean:open-ref", onOpenRef);
    };
  }, []);

  const value = useMemo(() => ({ state, dispatch, hydrated }), [state, hydrated]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
