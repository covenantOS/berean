"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { playSound } from "@/lib/sound";

/**
 * One collapsible guide section: a small-caps header on a border rule, a
 * quiet count or source hint at the right edge, and the body beneath. The
 * header itself is the toggle, the way Logos sections fold. The fold chimes
 * (a rising figure opens, a falling one closes), the body crossfades in,
 * and a parent running fx-stagger names this section's place in the
 * entrance cascade with stagger.
 */
export default function GuideSection({
  title,
  hint,
  defaultOpen = true,
  stagger,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  /** Order in the parent's entrance cascade (fx-stagger's --i). */
  stagger?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      style={stagger !== undefined ? ({ "--i": stagger } as CSSProperties) : undefined}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          playSound(open ? "close" : "open");
        }}
        className="fx-press flex w-full items-baseline gap-2 border-b border-rule pb-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        <span className="small-caps text-xs font-semibold text-muted">{title}</span>
        {hint && <span className="text-[0.68rem] text-muted">{hint}</span>}
        <span aria-hidden="true" className="ml-auto text-xs text-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="fx-fade pt-3">{children}</div>}
    </section>
  );
}
