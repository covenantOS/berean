"use client";

import { useEffect, useState } from "react";
import type { VerseCardSize, VerseCardTheme } from "@/lib/verseCard";

/**
 * The Media studio's memory: cards composed and downloaded, persisted on
 * the device so any of them can be downloaded again or restored into the
 * composer. History is newest first, deduped by passage and style, and
 * capped. The verse text rides along, so a re-download never refetches.
 * The key follows the workspace's storage naming ("berean.workspace.v1").
 */

export interface CardEntry {
  book: string;
  bookName: string;
  chapter: number;
  from: number;
  to: number;
  /** The verse text as composed, so a re-download never refetches. */
  text: string;
  size: VerseCardSize;
  theme: VerseCardTheme;
  reference: boolean;
  translation: boolean;
  /** ISO timestamp of the download. */
  at: string;
}

const HISTORY_KEY = "berean.card-history.v1";
const HISTORY_MAX = 20;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Re-renders a component whenever the history changes. */
export function subscribeCardHistory(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The display reference of an entry: "John 3:16" or "John 3:16-18". */
export function cardReference(e: CardEntry): string {
  return `${e.bookName} ${e.chapter}:${e.from}${e.to !== e.from ? `-${e.to}` : ""}`;
}

/** Two entries are the same card when passage and style all match. */
function sameCard(a: CardEntry, b: Omit<CardEntry, "at">): boolean {
  return (
    a.book === b.book &&
    a.chapter === b.chapter &&
    a.from === b.from &&
    a.to === b.to &&
    a.size === b.size &&
    a.theme === b.theme &&
    a.reference === b.reference &&
    a.translation === b.translation
  );
}

function load(): CardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is CardEntry => {
      if (typeof e !== "object" || e === null) return false;
      const entry = e as CardEntry;
      return (
        typeof entry.book === "string" &&
        typeof entry.bookName === "string" &&
        typeof entry.chapter === "number" &&
        typeof entry.from === "number" &&
        typeof entry.to === "number" &&
        typeof entry.text === "string" &&
        (entry.size === "auto" ||
          entry.size === "square" ||
          entry.size === "landscape" ||
          entry.size === "story") &&
        (entry.theme === "paper" || entry.theme === "candlelight") &&
        typeof entry.reference === "boolean" &&
        typeof entry.translation === "boolean"
      );
    });
  } catch {
    return [];
  }
}

function save(rows: CardEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(rows));
    notify();
  } catch {
    // Storage unavailable; the card still downloads, only the memory is lost.
  }
}

export function loadCardHistory(): CardEntry[] {
  return load().slice(0, HISTORY_MAX);
}

/** Records a download: newest first, one row per passage and style, capped. */
export function recordCard(entry: Omit<CardEntry, "at">) {
  if (!entry.text.trim()) return;
  const rest = load().filter((e) => !sameCard(e, entry));
  save([{ ...entry, at: new Date().toISOString() }, ...rest].slice(0, HISTORY_MAX));
}

/** The studio's view of the list; re-reads on every write. */
export function useCardHistory(): CardEntry[] {
  const [state, setState] = useState<CardEntry[]>([]);
  useEffect(() => {
    const reload = () => setState(loadCardHistory());
    reload();
    return subscribeCardHistory(reload);
  }, []);
  return state;
}
