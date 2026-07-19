"use client";

/**
 * The one knowledge graph — shared client-side substrate for every room.
 *
 * The rooms (Chapel, Reading Desk, Library, Writing Desk, Pulpit, Almanac)
 * are wayfinding over this single store, never separate silos. Records are
 * device-local (see docs/adr/0001 §3 and docs/adr/0002): identity and the
 * server database remain open decisions, so persistence is localStorage
 * behind this one interface. Every record carries the sync envelope fields
 * (id, visibility, createdAt, updatedAt) so the Cloudflare sync layer in
 * ADR 0002 can adopt these collections without a data migration.
 */

export type Visibility = "private" | "personal" | "church" | "public";

export interface Record_ {
  id: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
}

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export class Collection<T extends Record_> {
  constructor(public readonly key: string) {}

  private read(): T[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(this.key) ?? "[]") as T[];
    } catch {
      return [];
    }
  }

  private write(rows: T[]) {
    window.localStorage.setItem(this.key, JSON.stringify(rows));
    notify(this.key);
  }

  list(filter?: (row: T) => boolean): T[] {
    const rows = this.read();
    return filter ? rows.filter(filter) : rows;
  }

  get(id: string): T | undefined {
    return this.read().find((r) => r.id === id);
  }

  create(data: Omit<T, keyof Record_> & { visibility?: Visibility }): T {
    const now = new Date().toISOString();
    const row = {
      ...data,
      id: crypto.randomUUID(),
      visibility: data.visibility ?? "private",
      createdAt: now,
      updatedAt: now,
    } as T;
    const rows = this.read();
    rows.push(row);
    this.write(rows);
    return row;
  }

  update(id: string, patch: Partial<Omit<T, "id" | "createdAt">>): T | undefined {
    const rows = this.read();
    const row = rows.find((r) => r.id === id);
    if (!row) return undefined;
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    this.write(rows);
    return row;
  }

  remove(id: string) {
    this.write(this.read().filter((r) => r.id !== id));
  }

  removeAll() {
    this.write([]);
  }

  subscribe(fn: Listener): () => void {
    let set = listeners.get(this.key);
    if (!set) {
      set = new Set();
      listeners.set(this.key, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }
}

/**
 * Every collection in the knowledge graph, registered here so export,
 * delete, and (eventually) sync see the whole graph, not per-room lists.
 */
const registry = new Map<string, Collection<Record_>>();

export function collection<T extends Record_>(key: string): Collection<T> {
  let c = registry.get(key);
  if (!c) {
    c = new Collection(key);
    registry.set(key, c);
  }
  return c as unknown as Collection<T>;
}

export const GRAPH_KEYS = [
  "berean.marginalia.v1",
  "berean.highlights.v1",
  "berean.highlightstyles.v1",
  "berean.copystyles.v1",
  "berean.visualfilters.v1",
  "berean.librarymeta.v1",
  "berean.projects.v1",
  "berean.documents.v1",
  "berean.listdocs.v1",
  "berean.liturgies.v1",
  "berean.liturgy-templates.v1",
  "berean.plans.v1",
  "berean.prayers.v1",
  "berean.memory.v1",
  "berean.calendar.v1",
  "berean.rule.v1",
  "berean.settings.v1",
  "berean.layouts.v1",
  "berean.favorites.v1",
  "berean.guides.v1",
  "berean.collections.v1",
  "berean.active-collection.v1",
  "berean.workflows.v1",
  "berean.canvases.v1",
  "berean.diagrams.v1",
  "berean.personalbooks.v1",
] as const;

/** Export the entire knowledge graph as one JSON document. */
export function exportGraph(): string {
  const out: Record<string, unknown> = {
    product: "berean",
    exportedAt: new Date().toISOString(),
    format: 1,
  };
  for (const key of GRAPH_KEYS) {
    try {
      out[key] = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    } catch {
      out[key] = [];
    }
  }
  return JSON.stringify(out, null, 2);
}

/** Import a previously exported graph (replaces current device data). */
export function importGraph(json: string): { ok: boolean; error?: string } {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (parsed.product !== "berean") return { ok: false, error: "Not a Berean export file." };
    for (const key of GRAPH_KEYS) {
      if (key in parsed) {
        window.localStorage.setItem(key, JSON.stringify(parsed[key]));
        notify(key);
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "The file could not be read as JSON." };
  }
}

/** Delete everything on this device. */
export function deleteGraph() {
  for (const key of GRAPH_KEYS) {
    window.localStorage.removeItem(key);
    notify(key);
  }
}
