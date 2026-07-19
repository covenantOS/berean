"use client";

import { useRef } from "react";

/**
 * The print action shared by the report panes. Clicking marks the enclosing
 * [data-print-root] as the active print root; the print rules in globals.css
 * then hide the workspace chrome and paginate that report alone. The mark
 * lifts on afterprint, with a timeout backstop for browsers that never fire
 * it.
 */
export default function PrintButton({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  const print = () => {
    const root = ref.current?.closest("[data-print-root]");
    if (!(root instanceof HTMLElement)) {
      window.print();
      return;
    }
    root.setAttribute("data-print-active", "");
    const done = () => root.removeAttribute("data-print-active");
    window.addEventListener("afterprint", done, { once: true });
    window.setTimeout(done, 60_000);
    window.print();
  };

  return (
    <button
      ref={ref}
      type="button"
      title="Print this report"
      onClick={print}
      className={`no-print text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${className}`}
    >
      Print
    </button>
  );
}
