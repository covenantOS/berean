/**
 * Sync v1 — the provider-agnostic half of ADR 0002.
 *
 * The device store stays authoritative for the user's own work and the
 * server reconciles, so everything here is built from pieces that need no
 * server to be correct: last-writer-wins merge at updatedAt granularity,
 * an idempotent upsert, and per-collection high-water marks. The protocol
 * envelopes below are the wire shapes the hosted service speaks;
 * SyncTransport is the seam, MemoryTransport is the reference
 * implementation, and HttpTransport carries the envelopes to the API routes
 * (src/app/api/sync) backed by the server store (src/lib/sync-server.ts).
 * There is no provider SDK in this module. Like store.ts it carries no
 * "use client" directive: the server half reuses lwwWinner and mergeRows,
 * so the merge ruling lives in exactly one place.
 *
 * One subtlety, learned from walking the conflict cases: the pull cursor
 * is the server's commit sequence, not a client updatedAt. A record pushed
 * late with a stamp older than a device's cursor would otherwise never
 * reach that device. updatedAt still decides every merge; the sequence
 * only decides what has been seen.
 *
 * Cursors persist per device under their own localStorage key, outside
 * GRAPH_KEYS: they are device bookkeeping, not user data, so export never
 * carries them, and importGraph clears them because a full import replaces
 * every record and both sides must start over.
 */

import { collection, GRAPH_KEYS, SYNC_CURSOR_KEY, type Record_ } from "./store";

/* ------------------------------------------------------------------ */
/* Protocol envelopes                                                  */
/* ------------------------------------------------------------------ */

export interface PullRequest {
  collection: string;
  /** The high-water mark from the last PullResponse; only rows the server
   *  committed after it come back. Null asks for the whole collection,
   *  tombstones included. Opaque to the device: never parsed, only held. */
  after: string | null;
}

export interface PullResponse {
  records: Record_[];
  /** The server's current commit mark for this collection: the cursor the
   *  next pull resumes from. */
  cursor: string;
}

export interface PushRequest {
  collection: string;
  records: Record_[];
}

export interface PushResponse {
  /** Rows the server actually wrote after its own merge; a pushed row is
   *  skipped when the server already holds its content or a newer stamp. */
  accepted: number;
}

/** The seam between the engine and whatever carries the envelopes: the
 *  in-memory reference below today, an HTTP route handler tomorrow. */
export interface SyncTransport {
  push(req: PushRequest): Promise<PushResponse>;
  pull(req: PullRequest): Promise<PullResponse>;
}

/* ------------------------------------------------------------------ */
/* Merge                                                               */
/* ------------------------------------------------------------------ */

/** Plain deep equality for the JSON-shaped records the store holds. */
function recordsEqual(a: Record_, b: Record_): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Canonical form with sorted keys, so a same-stamp tie between differing
 *  records resolves identically on every device. */
function canonical(row: Record_): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return JSON.stringify(sort(row));
}

/**
 * Last-writer-wins at updatedAt granularity (ADR 0002); ISO stamps compare
 * as strings. Ties break deterministically so both sides converge without
 * talking: a tombstone beats a live edit stamped in the same instant (the
 * delete is the harder fact to recover), and a live-versus-live tie keeps
 * the canonically greater record. Identical records are a no-op either way.
 */
export function lwwWinner<T extends Record_>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  const aDead = Boolean(a.deletedAt);
  const bDead = Boolean(b.deletedAt);
  if (aDead !== bDead) return aDead ? a : b;
  return canonical(a) >= canonical(b) ? a : b;
}

export interface MergeResult<T extends Record_> {
  /** The merged row set: existing order preserved, genuinely new remote
   *  records appended in the order they arrived. */
  rows: T[];
  /** Rows written because the remote side won or was new. Zero on a
   *  repeated application, which is what makes the upsert idempotent. */
  changed: number;
}

/**
 * Idempotent upsert: apply remote rows into a local row set by LWW.
 * Applying the same remote set twice is a no-op the second time, so a push
 * or pull retried after an interruption costs nothing and changes nothing.
 */
export function mergeRows<T extends Record_>(local: T[], remote: T[]): MergeResult<T> {
  const rows = local.slice();
  const indexById = new Map(rows.map((r, i) => [r.id, i]));
  let changed = 0;
  for (const r of remote) {
    const i = indexById.get(r.id);
    if (i === undefined) {
      indexById.set(r.id, rows.length);
      rows.push(r);
      changed++;
      continue;
    }
    const cur = rows[i];
    if (recordsEqual(cur, r)) continue;
    const winner = lwwWinner(cur, r);
    if (winner !== cur) {
      rows[i] = winner;
      changed++;
    }
  }
  return { rows, changed };
}

/**
 * The push cursor: the greatest updatedAt in a row set, or null when the
 * set is empty. A device pushes rows stamped after the cursor and advances
 * it past everything it has sent, so each local row crosses the wire once.
 * (The pull cursor is the server's mark and lives on the envelopes; it is
 * never computed from record stamps.)
 */
export function highWater(rows: Record_[]): string | null {
  let max: string | null = null;
  for (const r of rows) {
    if (max === null || r.updatedAt > max) max = r.updatedAt;
  }
  return max;
}

/* ------------------------------------------------------------------ */
/* Reference transport: a fake server in memory                        */
/* ------------------------------------------------------------------ */

interface Table {
  rows: Record_[];
  /** Server bookkeeping, never written onto the records: the commit
   *  sequence each row was last written at. */
  seqById: Map<string, number>;
  counter: number;
}

/**
 * The reference SyncTransport: a whole server in one Map. It reconciles
 * with the same LWW merge the devices run, so pushes are idempotent, and
 * it stamps every accepted write with the next commit sequence, which is
 * what pulls resume from. Two engines pointed at one MemoryTransport
 * behave as two devices sharing one account.
 */
export class MemoryTransport implements SyncTransport {
  private tables = new Map<string, Table>();

  private table(collection: string): Table {
    let t = this.tables.get(collection);
    if (!t) {
      t = { rows: [], seqById: new Map(), counter: 0 };
      this.tables.set(collection, t);
    }
    return t;
  }

  async push(req: PushRequest): Promise<PushResponse> {
    const t = this.table(req.collection);
    const merged = mergeRows(t.rows, req.records);
    t.rows = merged.rows;
    for (const r of req.records) {
      const i = t.rows.findIndex((row) => row.id === r.id);
      if (i !== -1 && t.rows[i] === r) t.seqById.set(r.id, ++t.counter);
    }
    return { accepted: merged.changed };
  }

  async pull(req: PullRequest): Promise<PullResponse> {
    const t = this.table(req.collection);
    const after = req.after === null ? 0 : Number(req.after);
    const records = t.rows
      .filter((r) => (t.seqById.get(r.id) ?? 0) > after)
      .sort((a, b) => (t.seqById.get(a.id) ?? 0) - (t.seqById.get(b.id) ?? 0));
    return { records, cursor: String(t.counter) };
  }
}

/* ------------------------------------------------------------------ */
/* HTTP transport: the envelopes over the API routes                   */
/* ------------------------------------------------------------------ */

/** Where the pre-auth namespace slug persists on this device. Device
 *  bookkeeping, not user data; the auth wave replaces the slug with the
 *  identity subject and retires this key. */
export const SYNC_NAMESPACE_KEY = "berean.sync.namespace.v1";

/** The namespace this device syncs under until identity lands: a UUID
 *  minted once and held in localStorage, stable across sessions so every
 *  device the user signs onto the same slug converges. */
export function deviceNamespace(): string {
  const existing = window.localStorage.getItem(SYNC_NAMESPACE_KEY);
  if (existing) return existing;
  const minted = crypto.randomUUID();
  window.localStorage.setItem(SYNC_NAMESPACE_KEY, minted);
  return minted;
}

/**
 * The SyncTransport that speaks to the API routes. The namespace rides in
 * the request body (the pre-auth shape, documented in
 * src/lib/sync-server.ts); baseUrl defaults to same-origin. A failed
 * response or a network error rejects, so a sync cycle that cannot reach
 * the server changes nothing and retries whole next time: both sides merge
 * idempotently, so repetition is safe.
 */
export class HttpTransport implements SyncTransport {
  constructor(
    private namespace: string,
    private baseUrl: string = "",
    private fetchFn: typeof fetch = fetch,
  ) {}

  private async call<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sync ${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  push(req: PushRequest): Promise<PushResponse> {
    return this.call("/api/sync/push", { namespace: this.namespace, ...req });
  }

  pull(req: PullRequest): Promise<PullResponse> {
    return this.call("/api/sync/pull", { namespace: this.namespace, ...req });
  }
}

/**
 * The config gate for live sync: an HttpTransport for this device's
 * namespace when NEXT_PUBLIC_BEREAN_SYNC is set, null otherwise. Nothing in
 * the app calls this yet; the settings surface that wires the engine to a
 * transport arrives with the auth wave, and deployments without the flag
 * behave exactly as before.
 */
export function configuredTransport(): SyncTransport | null {
  if (typeof window === "undefined") return null;
  const flag = process.env.NEXT_PUBLIC_BEREAN_SYNC ?? "";
  if (flag !== "1" && flag !== "true") return null;
  return new HttpTransport(deviceNamespace(), process.env.NEXT_PUBLIC_BEREAN_SYNC_URL ?? "");
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

interface Cursors {
  /** Greatest local updatedAt known to have reached the server. */
  push: string | null;
  /** The server's commit mark, held verbatim from the last PullResponse. */
  pull: string | null;
}

export interface SyncSummary {
  /** Rows sent to the server this cycle. */
  pushed: number;
  /** Rows the merge actually wrote into the device store. */
  pulled: number;
}

/**
 * Runs one push then one pull per collection against a transport. Cursors
 * save after each collection, so a sync interrupted mid-stream resumes
 * where it stopped; anything refetched or repushed after a crash merges
 * away idempotently on both sides. After the push phase every local row is
 * on the server, so the push cursor may also advance over the stamps a
 * pull brings home without stranding a local write. The engine never
 * touches read paths: it merges through listIncludingDeleted/replaceAll
 * and the app keeps seeing live rows only.
 */
export class SyncEngine {
  private cursors = new Map<string, Cursors>();

  constructor(
    private transport: SyncTransport,
    private keys: readonly string[] = GRAPH_KEYS,
    private storageKey: string = SYNC_CURSOR_KEY,
  ) {
    this.load();
  }

  private load() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      for (const [key, c] of Object.entries(JSON.parse(raw) as Record<string, Cursors>)) {
        this.cursors.set(key, { push: c.push ?? null, pull: c.pull ?? null });
      }
    } catch {
      // Corrupt cursor state is recoverable: null cursors refetch and the
      // merges on both sides absorb the repetition.
    }
  }

  private save() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      this.storageKey,
      JSON.stringify(Object.fromEntries(this.cursors)),
    );
  }

  private cursorFor(key: string): Cursors {
    let c = this.cursors.get(key);
    if (!c) {
      c = { push: null, pull: null };
      this.cursors.set(key, c);
    }
    return c;
  }

  /** Push every local change since the last push, then pull and merge
   *  everything the server committed past the pull cursor. */
  async sync(): Promise<SyncSummary> {
    let pushed = 0;
    let pulled = 0;
    for (const key of this.keys) {
      const col = collection(key);
      const c = this.cursorFor(key);

      const local = col.listIncludingDeleted();
      const outgoing =
        c.push === null ? local : local.filter((r) => r.updatedAt > c.push!);
      if (outgoing.length > 0) {
        await this.transport.push({ collection: key, records: outgoing });
        pushed += outgoing.length;
        const hw = highWater(local);
        if (hw !== null && (c.push === null || hw > c.push)) c.push = hw;
      }

      const res = await this.transport.pull({ collection: key, after: c.pull });
      if (res.records.length > 0) {
        const merged = mergeRows(col.listIncludingDeleted(), res.records);
        if (merged.changed > 0) col.replaceAll(merged.rows);
        pulled += merged.changed;
        const hw = highWater(res.records);
        if (hw !== null && (c.push === null || hw > c.push)) c.push = hw;
      }
      c.pull = res.cursor;
      this.save();
    }
    return { pushed, pulled };
  }
}
