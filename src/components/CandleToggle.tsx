"use client";

import { useEffect } from "react";
import { applyDisplayPrefs, setCandle, useDisplayPrefs } from "@/lib/display";

/**
 * Candlelight switch — renders the whole study by lamplight (plan §3). The
 * workspace's Settings rail writes the same key through src/lib/display.ts,
 * so the two surfaces never disagree; this mount also replays the display
 * prefs onto the document root for whichever surface is showing.
 */
export default function CandleToggle() {
  const { lit } = useDisplayPrefs();

  useEffect(() => {
    applyDisplayPrefs();
  }, []);

  return (
    <button
      type="button"
      onClick={() => setCandle(!lit)}
      title={lit ? "Daylight" : "Candlelight"}
      aria-label={lit ? "Switch to daylight" : "Switch to candlelight"}
      className="rounded-[4px] px-2 py-1.5 text-sm text-muted hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
    >
      {lit ? "☀" : "🕯"}
    </button>
  );
}
