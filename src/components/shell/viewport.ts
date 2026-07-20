/**
 * The phone breakpoint the shell's mobile rules (globals.css) hang on.
 * Below it the rail is a bottom tab bar and the sidebar and dock are
 * drawers; the few behaviors CSS cannot express (Escape closing a drawer,
 * a drawer yielding once its pick opens) ask this helper instead of
 * hardcoding the width.
 */
export const PHONE_BREAKPOINT = "(max-width: 767px)";

/** True while the viewport sits at the phone breakpoint. */
export function phoneViewport(): boolean {
  return window.matchMedia(PHONE_BREAKPOINT).matches;
}
