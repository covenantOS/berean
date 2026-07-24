"use client";

import { usePhoneViewport } from "./viewport";

/**
 * An honest word at phone width over a desktop-first surface (the canvas's
 * drag, the diagram's drag): the surface reads best on a larger screen, and
 * its contents stay reachable here. Renders nothing at desktop width.
 */
export default function PhoneSurfaceNote({ text }: { text: string }) {
  const phone = usePhoneViewport();
  if (!phone) return null;
  return (
    <p className="shrink-0 border-b border-rule bg-paper px-3 py-2 text-[0.68rem] leading-relaxed text-muted">
      {text}
    </p>
  );
}
