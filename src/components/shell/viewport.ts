import { useSyncExternalStore } from "react";

/**
 * The phone breakpoint the shell's mobile rules (globals.css) hang on.
 * Below it the rail yields to a five-destination bottom bar, one pane fills
 * the frame, and the sidebar, the dock, and the reader's tools rise as
 * sheets; the few behaviors CSS cannot express (Escape closing a sheet, a
 * sheet yielding once its pick opens, the pane grid collapsing to the
 * active pane) ask these helpers instead of hardcoding the width.
 */
export const PHONE_BREAKPOINT = "(max-width: 767px)";

/** True while the viewport sits at the phone breakpoint. */
export function phoneViewport(): boolean {
  return window.matchMedia(PHONE_BREAKPOINT).matches;
}

function subscribeBreakpoint(onChange: () => void): () => void {
  const mql = window.matchMedia(PHONE_BREAKPOINT);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * phoneViewport() as a hook: re-renders when the breakpoint crosses, so a
 * resized window swaps the phone presentation in and out live. The server
 * snapshot is the desktop; the shell renders only after hydration, so no
 * server pass ever reads it.
 */
export function usePhoneViewport(): boolean {
  return useSyncExternalStore(
    subscribeBreakpoint,
    () => phoneViewport(),
    () => false
  );
}
