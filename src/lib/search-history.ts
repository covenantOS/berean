"use client";

import { useEffect, useState } from "react";
import type { SearchMode } from "@/components/shell/workspace-state";

/**
 * The concordance's memory: recent searches and pinned searches, persisted
 * on the device so any of them can be re-run from the Search rail. History
 * is newest first, deduped by query and mode (case-insensitive on the
 * query), and capped; pins live in their own list so a pinned search never
 * ages out of history. An entry's mode re-runs it against the engine that
 * answered it: the precise Bible concordance, the original-language morph
 * search, or search by meaning. Both keys follow the workspace's storage
 * naming ("berean.workspace.v1").
 */

export interface SearchEntry {
  q: string;
  /** The engine that answered the query; absent reads as "bible". */
  mode?: SearchMode;
  /** ISO timestamp of the last run (history) or the pinning (favorites). */
  at: string;
}

const HISTORY_KEY = "berean.search-history.v1";
const FAVORITES_KEY = "berean.search-favorites.v1";
const HISTORY_MAX = 50;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Re-renders a component whenever history or favorites change. */
export function subscribeSearchSaves(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function normalize(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

function load(key: string): SearchEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is SearchEntry => {
      if (typeof e !== "object" || e === null) return false;
      const entry = e as SearchEntry;
      if (typeof entry.q !== "string") return false;
      return (
        entry.mode === undefined ||
        entry.mode === "bible" ||
        entry.mode === "original" ||
        entry.mode === "semantic"
      );
    });
  } catch {
    return [];
  }
}

function save(key: string, rows: SearchEntry[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
    notify();
  } catch {
    // Storage unavailable; the search still runs, only the memory is lost.
  }
}

/** Two entries are the same search when query and engine both match. */
function sameEntry(e: SearchEntry, q: string, mode: SearchMode): boolean {
  return e.q.toLowerCase() === q.toLowerCase() && (e.mode ?? "bible") === mode;
}

export function loadHistory(): SearchEntry[] {
  return load(HISTORY_KEY).slice(0, HISTORY_MAX);
}

export function loadFavorites(): SearchEntry[] {
  return load(FAVORITES_KEY);
}

/** Records a run of the query: newest first, one row per query and mode, capped. */
export function recordSearch(q: string, mode: SearchMode = "bible") {
  const query = normalize(q);
  if (!query) return;
  const rest = load(HISTORY_KEY).filter((e) => !sameEntry(e, query, mode));
  const entry: SearchEntry = { q: query, at: new Date().toISOString() };
  if (mode !== "bible") entry.mode = mode;
  save(HISTORY_KEY, [entry, ...rest].slice(0, HISTORY_MAX));
}

export function isFavorite(q: string, mode: SearchMode = "bible"): boolean {
  const query = normalize(q);
  return load(FAVORITES_KEY).some((e) => sameEntry(e, query, mode));
}

/** Pins the query, or unpins it when already pinned. Returns the new state. */
export function toggleFavorite(q: string, mode: SearchMode = "bible"): boolean {
  const query = normalize(q);
  if (!query) return false;
  const rows = load(FAVORITES_KEY);
  if (rows.some((e) => sameEntry(e, query, mode))) {
    save(FAVORITES_KEY, rows.filter((e) => !sameEntry(e, query, mode)));
    return false;
  }
  const entry: SearchEntry = { q: query, at: new Date().toISOString() };
  if (mode !== "bible") entry.mode = mode;
  save(FAVORITES_KEY, [entry, ...rows]);
  return true;
}

/** The rail's view of both lists; re-reads on every write. */
export function useSearchSaves(): { history: SearchEntry[]; favorites: SearchEntry[] } {
  const [state, setState] = useState<{ history: SearchEntry[]; favorites: SearchEntry[] }>({
    history: [],
    favorites: [],
  });
  useEffect(() => {
    const reload = () => setState({ history: loadHistory(), favorites: loadFavorites() });
    reload();
    return subscribeSearchSaves(reload);
  }, []);
  return state;
}
