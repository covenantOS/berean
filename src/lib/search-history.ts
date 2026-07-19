"use client";

import { useEffect, useState } from "react";

/**
 * The concordance's memory: recent searches and pinned searches, persisted
 * on the device so any of them can be re-run from the Search rail. History
 * is newest first, deduped by query (case-insensitive), and capped; pins
 * live in their own list so a pinned search never ages out of history.
 * Both keys follow the workspace's storage naming ("berean.workspace.v1").
 */

export interface SearchEntry {
  q: string;
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
    return parsed.filter(
      (e): e is SearchEntry =>
        typeof e === "object" && e !== null && typeof (e as SearchEntry).q === "string"
    );
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

function sameQuery(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function loadHistory(): SearchEntry[] {
  return load(HISTORY_KEY).slice(0, HISTORY_MAX);
}

export function loadFavorites(): SearchEntry[] {
  return load(FAVORITES_KEY);
}

/** Records a run of the query: newest first, one row per query, capped. */
export function recordSearch(q: string) {
  const query = normalize(q);
  if (!query) return;
  const rest = load(HISTORY_KEY).filter((e) => !sameQuery(e.q, query));
  save(HISTORY_KEY, [{ q: query, at: new Date().toISOString() }, ...rest].slice(0, HISTORY_MAX));
}

export function isFavorite(q: string): boolean {
  const query = normalize(q);
  return load(FAVORITES_KEY).some((e) => sameQuery(e.q, query));
}

/** Pins the query, or unpins it when already pinned. Returns the new state. */
export function toggleFavorite(q: string): boolean {
  const query = normalize(q);
  if (!query) return false;
  const rows = load(FAVORITES_KEY);
  if (rows.some((e) => sameQuery(e.q, query))) {
    save(FAVORITES_KEY, rows.filter((e) => !sameQuery(e.q, query)));
    return false;
  }
  save(FAVORITES_KEY, [{ q: query, at: new Date().toISOString() }, ...rows]);
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
