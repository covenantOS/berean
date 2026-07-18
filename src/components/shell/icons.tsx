"use client";

import type { ReactNode } from "react";

/**
 * Shell icons: quiet 18px strokes with square caps, cut to the design
 * language (square corners, structural ink, stained glass only as signal).
 */

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="square"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ReadIcon() {
  return (
    <Icon>
      <path d="M9 4.5C7.5 3.2 5 3 2.5 3.2v11c2.5-.2 5 0 6.5 1.3 1.5-1.3 4-1.5 6.5-1.3v-11C13 3 10.5 3.2 9 4.5z" />
      <path d="M9 4.5v11" />
    </Icon>
  );
}

export function StudyIcon() {
  return (
    <Icon>
      <path d="M3 13.6 11.4 5.2l1.4 1.4-8.4 8.4H3v-1.4z" />
      <path d="M10.4 6.2l1.4 1.4" />
      <path d="M12.5 3.5h3v3" />
    </Icon>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="7.5" cy="7.5" r="4.5" />
      <path d="M11 11l4.5 4.5" />
    </Icon>
  );
}

export function LibraryIcon() {
  return (
    <Icon>
      <path d="M2.5 3.5h2.6v11H2.5z" />
      <path d="M6.6 3.5h2.6v11H6.6z" />
      <path d="M11.4 3.9l2.5.5-2.3 10.4-2.5-.5z" />
    </Icon>
  );
}

export function DocumentsIcon() {
  return (
    <Icon>
      <path d="M4 2.5h6.5L14 6v9.5H4z" />
      <path d="M10 2.5V6h4" />
      <path d="M6.5 9h5M6.5 11.5h5" />
    </Icon>
  );
}

export function AlmanacIcon() {
  return (
    <Icon>
      <rect x="2.5" y="3.5" width="13" height="12" />
      <path d="M2.5 7h13" />
      <path d="M6 2v3M12 2v3" />
      <path d="M5.5 10h2M10.5 10h2M5.5 12.5h2" />
    </Icon>
  );
}

export function SettingsIcon() {
  return (
    <Icon>
      <circle cx="9" cy="9" r="2.4" />
      <path d="M9 2.5v2.6M9 12.9v2.6M2.5 9h2.6M12.9 9h2.6M4.4 4.4l1.8 1.8M11.8 11.8l1.8 1.8M13.6 4.4l-1.8 1.8M6.2 11.8l-1.8 1.8" />
    </Icon>
  );
}

/* Named layout presets, docked at the foot of the rail. */

export function PresetReadingIcon() {
  return (
    <Icon>
      <rect x="3" y="3.5" width="12" height="11" />
      <path d="M5.5 6.5h7M5.5 9h7M5.5 11.5h4.5" />
    </Icon>
  );
}

export function PresetStudyIcon() {
  return (
    <Icon>
      <rect x="3" y="3.5" width="12" height="11" />
      <path d="M9 3.5v11" />
    </Icon>
  );
}

/* Pane chrome. */

export function SplitHorizontalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" aria-hidden="true">
      <rect x="1.5" y="1.5" width="11" height="11" />
      <path d="M7 1.5v11" />
    </svg>
  );
}

export function SplitVerticalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" aria-hidden="true">
      <rect x="1.5" y="1.5" width="11" height="11" />
      <path d="M1.5 7h11" />
    </svg>
  );
}

/* Right dock tabs. */

export function CommentaryIcon() {
  return (
    <Icon>
      <path d="M3 3.5h12v8.5H8.5L5.5 15v-3H3z" />
      <path d="M5.5 6.5h7M5.5 9h4.5" />
    </Icon>
  );
}

export function LexiconIcon() {
  return (
    <Icon>
      <path d="M4 3.5h10v11H4z" />
      <path d="M6.5 6.5h5M6.5 9h5M6.5 11.5h3" />
    </Icon>
  );
}

export function CrossRefsIcon() {
  return (
    <Icon>
      <path d="M2.5 6h10l-2.2-2.2M15.5 12h-10l2.2 2.2" />
    </Icon>
  );
}

export function ScribeIcon() {
  return (
    <Icon>
      <path d="M14 4C9 5 5.5 9 4.5 14.5 10 13.5 13.5 9.5 14 4z" />
      <path d="M4.5 14.5C6.5 10.5 9 7.8 12.5 6.2" />
    </Icon>
  );
}
