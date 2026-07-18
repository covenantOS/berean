"use client";

import { useState, type ReactNode } from "react";

/**
 * One collapsible guide section: a small-caps header on a border rule, a
 * quiet count or source hint at the right edge, and the body beneath. The
 * header itself is the toggle, the way Logos sections fold.
 */
export default function GuideSection({
  title,
  hint,
  defaultOpen = true,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-baseline gap-2 border-b border-rule pb-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        <span className="small-caps text-xs font-semibold text-muted">{title}</span>
        {hint && <span className="text-[0.68rem] text-muted">{hint}</span>}
        <span aria-hidden="true" className="ml-auto text-xs text-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="pt-3">{children}</div>}
    </section>
  );
}
