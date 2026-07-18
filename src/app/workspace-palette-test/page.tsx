"use client";

import { useEffect } from "react";
import Omnibox from "@/components/palette/Omnibox";
import { parseInput } from "@/components/palette/parse";

/**
 * Scratch mount for the command omnibox while the workspace shell is built.
 * Palette events log to the console; the parse probe renders below so the
 * client-side parser can be checked without opening the palette. The shell
 * agent replaces this with the real mount.
 */

const PROBES = ["jn 3:16", "gen 1", "romans 8:28-31", "G25", "H7225", "abraham"];

const PALETTE_EVENTS = [
  "berean:open-ref",
  "berean:open-lexicon",
  "berean:search",
  "berean:apply-preset",
  "berean:toggle-right-dock",
];

export default function WorkspacePaletteTest() {
  useEffect(() => {
    const handlers = PALETTE_EVENTS.map((name) => {
      const log = (e: Event) =>
        console.log(`[palette-test] ${name}`, (e as CustomEvent).detail);
      window.addEventListener(name, log);
      return { name, log };
    });
    return () => handlers.forEach(({ name, log }) => window.removeEventListener(name, log));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-editorial mb-2 text-2xl font-bold">Palette test mount</h1>
      <p className="mb-8 text-sm text-muted">
        Press Ctrl/Cmd+K, or dispatch berean:omnibox-toggle on window, to open
        the command omnibox. Selections log their events to the console.
      </p>
      <p className="small-caps mb-3 border-b border-rule pb-2 text-sm text-muted">Parse probe</p>
      <pre className="mb-8 overflow-x-auto rounded-[4px] border border-rule bg-surface p-4 text-xs leading-relaxed">
        {PROBES.map((p) => `${p} → ${JSON.stringify(parseInput(p))}`).join("\n")}
      </pre>
      <Omnibox />
    </main>
  );
}
