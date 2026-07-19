"use client";

import { useEffect, useState } from "react";

/**
 * Display preferences: candlelight and the global text multiplier. Both are
 * device-local scalars (not graph rows, so export leaves them on the device,
 * the same as the workspace session), applied to the document root so every
 * surface reads them, and shared by the site header's candle switch and the
 * workspace's Settings rail so the two surfaces write the same keys and
 * never drift apart.
 */

export const CANDLE_KEY = "berean.candle";
export const TEXT_SCALE_KEY = "berean.textScale.v1";

/** The global multiplier's steps; a pane's own A steppers ride on top of it. */
export const TEXT_SCALES: { value: number; label: string }[] = [
  { value: 0.9, label: "Small (90%)" },
  { value: 1, label: "Standard (100%)" },
  { value: 1.12, label: "Large (112%)" },
  { value: 1.25, label: "Largest (125%)" },
];

/* Same-tab change notice: the storage event only fires across tabs, and the
 * header's switch and the rail's panel can both be mounted at once. */
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function subscribeDisplay(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function candleLit(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(CANDLE_KEY) === "1";
}

export function textScale(): number {
  if (typeof window === "undefined") return 1;
  const v = Number(window.localStorage.getItem(TEXT_SCALE_KEY));
  return TEXT_SCALES.some((s) => s.value === v) ? v : 1;
}

/** Reads the stored prefs back onto the document root; every mount replays it. */
export function applyDisplayPrefs() {
  if (typeof window === "undefined") return;
  document.documentElement.toggleAttribute("data-candle", candleLit());
  document.documentElement.style.setProperty("--reader-base", String(textScale()));
}

export function setCandle(lit: boolean) {
  window.localStorage.setItem(CANDLE_KEY, lit ? "1" : "0");
  document.documentElement.toggleAttribute("data-candle", lit);
  notify();
}

export function setTextScale(v: number) {
  window.localStorage.setItem(TEXT_SCALE_KEY, String(v));
  document.documentElement.style.setProperty("--reader-base", String(v));
  notify();
}

/** The current prefs, hydrated after mount and re-read on every change. */
export function useDisplayPrefs() {
  const [prefs, setPrefs] = useState({ lit: false, scale: 1 });
  useEffect(() => {
    const read = () => setPrefs({ lit: candleLit(), scale: textScale() });
    read();
    return subscribeDisplay(read);
  }, []);
  return prefs;
}
