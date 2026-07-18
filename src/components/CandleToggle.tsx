"use client";

import { useEffect, useState } from "react";

const KEY = "berean.candle";

/** Candlelight switch — renders the whole study by lamplight (plan §3). */
export default function CandleToggle() {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY) === "1";
    setLit(stored);
    document.documentElement.toggleAttribute("data-candle", stored);
  }, []);

  const toggle = () => {
    const next = !lit;
    setLit(next);
    document.documentElement.toggleAttribute("data-candle", next);
    localStorage.setItem(KEY, next ? "1" : "0");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={lit ? "Daylight" : "Candlelight"}
      aria-label={lit ? "Switch to daylight" : "Switch to candlelight"}
      className="rounded-[4px] px-2 py-1.5 text-sm text-muted hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
    >
      {lit ? "☀" : "🕯"}
    </button>
  );
}
