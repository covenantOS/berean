"use client";

import { useRef } from "react";
import { playSound, setSoundEnabled, setSoundVolume, useSoundPrefs } from "@/lib/sound";

/**
 * The sound control for Settings: a switch for the chimes and a slider for
 * their loudness. Turning the chimes off plays the off figure first, the
 * last sound the study makes; moving the slider answers with a single soft
 * note, throttled so a drag does not trill.
 */
export default function SoundToggle() {
  const { enabled, volume } = useSoundPrefs();
  const lastPreview = useRef(0);

  const toggle = (on: boolean) => {
    if (!on) playSound("toggle-off");
    setSoundEnabled(on);
    if (on) playSound("toggle-on");
  };

  const slide = (v: number) => {
    setSoundVolume(v);
    const now = Date.now();
    if (now - lastPreview.current > 150) {
      lastPreview.current = now;
      playSound("navigate");
    }
  };

  return (
    <div className="grid gap-3">
      <label className="switch text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span className="switch-track" aria-hidden="true" />
        <span>
          Chimes
          <span className="block text-xs text-muted">
            Small bells mark what opens, closes, and finishes.
          </span>
        </span>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="flex max-w-56 items-baseline justify-between">
          <span className="font-medium">Loudness</span>
          <span className="text-xs text-muted">{Math.round(volume * 100)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={!enabled}
          aria-label="Chime loudness"
          onChange={(e) => slide(Number(e.target.value))}
          className="w-full max-w-56 disabled:opacity-40"
          style={{ accentColor: "var(--stained-sapphire)" }}
        />
      </label>
    </div>
  );
}
