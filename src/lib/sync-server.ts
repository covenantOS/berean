/**
 * Sync v1 server side: the store the API routes reconcile against.
 *
 * SyncStore is the seam between the route handlers and wherever rows live,
 * mirroring the SyncTransport seam on the client (src/lib/sync.ts). Two
 * drivers ship today. MemorySyncStore is the dev and test driver: a
 * namespaced port of MemoryTransport, correct for a single process and
 * honest about that limit. PgSyncStore is the real deployment driver over
 * Neon Postgres (db/migrations/0001_sync.sql), applying the same LWW merge
 * in JS inside a transaction so the SQL holds rows and the code arbitrates
 * them, one ruling in one place (lwwWinner).
 *
 * Namespaces: auth is not wired, so rows are scoped by a namespace slug the
 * caller supplies (a device-generated UUID until identity lands). The
 * schema's "userId" column carries this slug today and the identity subject
 * later; the auth wave swaps where the value comes from, not the shape.
 *
 * Driver selection is config-gated so a deploy with no sync configuration
 * behaves exactly as the app always has: SYNC_DRIVER=memory turns the
 * in-process store on, DATABASE_URL alone selects pg, and anything else
 * leaves the routes answering 503.
 */

import { GRAPH_KEYS, type Record_ } from "./store";
import {
  lwwWinner,
  mergeRows,
  type PullResponse,
  type PushResponse,
} from "./sync";

/* ------------------------------------------------------------------ */
/* The seam                                                            */
/* ------------------------------------------------------------------ */

/** What the routes need from a row store: apply a batch with LWW and stamp
 *  the commit sequence, and read back everything committed after a cursor. */
export interface SyncStore {
  push(
    namespace: string,
    collection: string,
    records: Record_[],
  ): Promise<PushResponse>;
  pull(
    namespace: string,
    collection: string,
    after: string | null,
  ): Promise<PullResponse>;
}

const COLLECTIONS = new Set<string>(GRAPH_KEYS);

/** The migration names tables by the collection key with every non
 *  alphanumeric character folded to an underscore. Names come only from
 *  GRAPH_KEYS, so the identifier interpolated into SQL is never attacker
 *  controlled. */
function syncTable(collection: string): string {
  if (!COLLECTIONS.has(collection)) {
    throw new Error(`Unknown collection: ${collection}`);
  }
  return "sync_" + collection.replace(/[^a-zA-Z0-9]/g, "_");
}

/* ------------------------------------------------------------------ */
/* Memory driver: a namespaced MemoryTransport                         */
/* ------------------------------------------------------------------ */

interface Table {
  rows: Record_[];
  /** Server bookkeeping, never written onto the records: the commit
   *  sequence each row was last written at. */
  seqById: Map<string, number>;
  counter: number;
}

/**
 * The reference SyncStore: every namespace is a whole MemoryTransport. It
 * reconciles with the same LWW merge the devices run and stamps every
 * accepted write with the next commit sequence, so behavior is identical to
 * the client-side reference and to the pg driver. Rows live in process
 * memory: fine for dev, tests, and a single self-hosted process, gone on
 * restart, and never shared across serverless instances.
 */
export class MemorySyncStore implements SyncStore {
  private namespaces = new Map<string, Map<string, Table>>();

  private table(namespace: string, collection: string): Table {
    let ns = this.namespaces.get(namespace);
    if (!ns) {
      ns = new Map();
      this.namespaces.set(namespace, ns);
    }
    let t = ns.get(collection);
    if (!t) {
      t = { rows: [], seqById: new Map(), counter: 0 };
      ns.set(collection, t);
    }
    return t;
  }

  async push(
    namespace: string,
    collection: string,
    records: Record_[],
  ): Promise<PushResponse> {
    const t = this.table(namespace, collection);
    const merged = mergeRows(t.rows, records);
    t.rows = merged.rows;
    for (const r of records) {
      const i = t.rows.findIndex((row) => row.id === r.id);
      if (i !== -1 && t.rows[i] === r) t.seqById.set(r.id, ++t.counter);
    }
    return { accepted: merged.changed };
  }

  async pull(
    namespace: string,
    collection: string,
    after: string | null,
  ): Promise<PullResponse> {
    const t = this.table(namespace, collection);
    const afterSeq = after === null ? 0 : Number(after);
    const records = t.rows
      .filter((r) => (t.seqById.get(r.id) ?? 0) > afterSeq)
      .sort((a, b) => (t.seqById.get(a.id) ?? 0) - (t.seqById.get(b.id) ?? 0));
    return { records, cursor: String(t.counter) };
  }
}

/* ------------------------------------------------------------------ */
/* Postgres driver                                                     */
/* ------------------------------------------------------------------ */

/**
 * The deployment driver, over Neon Postgres (ADR 0002). Each push batch runs
 * in one transaction: rows are locked with SELECT ... FOR UPDATE, the LWW
 * ruling is made by the same lwwWinner the devices run, and only winning or
 * new rows are written and stamped with the next sequence value. A push
 * retried after an interruption merges away idempotently, as on every other
 * side of the protocol. pg is imported lazily so memory-driver deployments
 * never load it.
 */
export class PgSyncStore implements SyncStore {
  private poolPromise: Promise<import("pg").Pool> | null = null;

  constructor(private connectionString: string) {}

  private pool(): Promise<import("pg").Pool> {
    if (!this.poolPromise) {
      this.poolPromise = import("pg").then(
        ({ Pool }) => new Pool({ connectionString: this.connectionString }),
      );
    }
    return this.poolPromise;
  }

  async push(
    namespace: string,
    collection: string,
    records: Record_[],
  ): Promise<PushResponse> {
    const table = syncTable(collection);
    const client = await (await this.pool()).connect();
    let accepted = 0;
    try {
      await client.query("BEGIN");
      for (const r of records) {
        const cur = await client.query(
          `SELECT record FROM ${table} WHERE "userId" = $1 AND id = $2 FOR UPDATE`,
          [namespace, r.id],
        );
        if (cur.rowCount === 0) {
          await client.query(
            `INSERT INTO ${table} ("userId", id, record, "updatedAt", seq)
             VALUES ($1, $2, $3, $4, nextval('sync_commit_seq'))`,
            [namespace, r.id, JSON.stringify(r), r.updatedAt],
          );
          accepted++;
          continue;
        }
        const existing = cur.rows[0].record as Record_;
        // lwwWinner returns the current row unless the incoming record
        // genuinely wins, so a losing or identical push writes nothing and
        // keeps the row's existing commit stamp, matching mergeRows.
        const winner = lwwWinner(existing, r);
        if (winner === r) {
          await client.query(
            `UPDATE ${table} SET record = $3, "updatedAt" = $4, seq = nextval('sync_commit_seq')
             WHERE "userId" = $1 AND id = $2`,
            [namespace, r.id, JSON.stringify(r), r.updatedAt],
          );
          accepted++;
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    return { accepted };
  }

  async pull(
    namespace: string,
    collection: string,
    after: string | null,
  ): Promise<PullResponse> {
    const table = syncTable(collection);
    const afterSeq = after === null ? 0 : Number(after);
    const client = await (await this.pool()).connect();
    try {
      await client.query("BEGIN");
      // The cursor is the highest commit stamp this namespace has in the
      // collection, whether or not any row is newer than after. A commit
      // racing the two statements can return a row past the cursor; the next
      // pull refetches it and the merge absorbs the repeat.
      const cur = await client.query(
        `SELECT COALESCE(MAX(seq), 0) AS cursor FROM ${table} WHERE "userId" = $1`,
        [namespace],
      );
      const rows = await client.query(
        `SELECT record FROM ${table} WHERE "userId" = $1 AND seq > $2 ORDER BY seq`,
        [namespace, afterSeq],
      );
      await client.query("COMMIT");
      return {
        records: rows.rows.map((row) => row.record as Record_),
        cursor: String(cur.rows[0].cursor),
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Request validation                                                  */
/* ------------------------------------------------------------------ */

/** One push batch never carries more than this many records; larger graphs
 *  sync in cycles, per collection. */
export const MAX_BATCH = 500;

/** The pre-auth namespace is a slug: safe as a URL segment, a DNS label,
 *  and a table value. A UUID qualifies. */
const NAMESPACE_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function parseNamespace(value: unknown): string | null {
  return typeof value === "string" && NAMESPACE_RE.test(value) ? value : null;
}

export function isCollection(value: unknown): value is string {
  return typeof value === "string" && COLLECTIONS.has(value);
}

const VISIBILITIES = new Set(["private", "personal", "church", "public"]);

function isStamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    !Number.isNaN(Date.parse(value))
  );
}

/** The envelope fields sync depends on. Collection-specific payload rides
 *  along unchecked; the store owns the shape of its own records. */
function isEnvelope(value: unknown): value is Record_ {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.id.length >= 1 &&
    r.id.length <= 100 &&
    typeof r.visibility === "string" &&
    VISIBILITIES.has(r.visibility) &&
    isStamp(r.createdAt) &&
    isStamp(r.updatedAt) &&
    (r.deletedAt === undefined || isStamp(r.deletedAt))
  );
}

/** Validate a push batch: an array of one to MAX_BATCH well-formed
 *  envelopes. Returns null on the first violation. */
export function parseRecords(value: unknown): Record_[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BATCH) {
    return null;
  }
  return value.every(isEnvelope) ? (value as Record_[]) : null;
}

/** Validate a pull cursor: null for a full fetch, or a non-negative integer
 *  string held verbatim from an earlier PullResponse. undefined means the
 *  value was present but malformed. */
export function parseCursor(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) ? value : undefined;
}

/* ------------------------------------------------------------------ */
/* Driver selection                                                    */
/* ------------------------------------------------------------------ */

export type SyncDriver = "memory" | "pg" | "off";

/** SYNC_DRIVER decides when set; otherwise a DATABASE_URL implies pg and
 *  its absence leaves sync off. */
export function syncDriver(): SyncDriver {
  const d = (process.env.SYNC_DRIVER ?? "").toLowerCase();
  if (d === "memory" || d === "pg" || d === "off") return d;
  return process.env.DATABASE_URL ? "pg" : "off";
}

// Cached on globalThis so dev hot-reloads keep one store and one pg pool.
const globalForSync = globalThis as unknown as {
  __bereanSyncStore?: SyncStore | null;
};

/** The store for this process, or null when sync is not configured; the
 *  routes answer 503 in that case, which is the pre-sync behavior. */
export function getSyncStore(): SyncStore | null {
  if (globalForSync.__bereanSyncStore !== undefined) {
    return globalForSync.__bereanSyncStore;
  }
  const driver = syncDriver();
  let store: SyncStore | null = null;
  if (driver === "memory") {
    store = new MemorySyncStore();
  } else if (driver === "pg" && process.env.DATABASE_URL) {
    store = new PgSyncStore(process.env.DATABASE_URL);
  }
  globalForSync.__bereanSyncStore = store;
  return store;
}
