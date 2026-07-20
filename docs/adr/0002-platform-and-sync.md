# ADR 0002 — Platform targets, Cloudflare deployment, and cloud sync

Status: accepted · July 2026 · extends ADR 0001

## Decision

Berean is **one Next.js application** delivered to four surfaces in this order:

1. **Web app** (now) — the canonical build, deployable today with `npm run build`.
2. **Desktop, Mac and Windows** (now, thin; full later) — a Tauri shell in
   `desktop/` wrapping the application. First iteration points at the hosted
   deployment; a later iteration bundles a static export plus a local passage
   API for full offline study.
3. **Mobile** (later) — the same core via Tauri Mobile (iOS/Android) once the
   desktop shell has proven the packaging; the responsive layouts and 44px
   touch targets required by the design language are built in from the start.
4. **Self-hosted** (always) — `npm run build && npm start` on any hardware,
   per the open-source conviction in the product vision.

No surface forks the product: rooms, stores, and the Scribe are identical
everywhere. The only per-surface code allowed is packaging (`desktop/`) and,
later, a sync transport toggle.

## Cloudflare

The hosted service runs entirely on Cloudflare, matching the Covenant OS
platform direction (`docs/BEREAN_INTEGRATION_BRIEF.md`, LAUNCH_PLAN):

- **Workers via OpenNext** — the Next.js app (reader, APIs, the Scribe routes).
- **Neon Postgres via Hyperdrive** — Berean's own database when identity lands
  (ADR 0001 §3 still governs: no database until the identity decision).
  Strictly separate from the Covenant OS database — no shared credentials.
- **R2** — exported artifacts (briefs, manuscripts, orders of service) with
  short-lived signed access; never the system of record for private notes.
- **Queues** — the versioned Covenant OS event contracts when integration
  begins (contract fixtures first, per the brief).
- **KV/Cache** — canon text is static and ships with the app; no per-user data
  in KV.

Deployment is not wired in this repository yet because it requires account
credentials and a named production gate; nothing in the codebase blocks it —
the app has no server state outside request scope.

## Cloud sync

Sync is **local-first**: the device store is authoritative for the user's own
work, and the server reconciles.

- Every record already carries the sync envelope: `id` (UUID), `visibility`,
  `createdAt`, `updatedAt` (see `src/lib/store.ts`). Collections are named and
  registered in `GRAPH_KEYS`.
- Sync protocol (when identity lands): per-collection push/pull of records
  newer than a high-water mark, last-writer-wins per record at `updatedAt`
  granularity, tombstones for deletes (`deletedAt` field to be added at sync
  time — additive, no migration).
- Visibility scopes gate what may ever leave the device: `private` records
  sync only to the owner's own devices; `church`/`public` sharing requires the
  explicit flows in the integration brief.
- Until then, the **whole-graph export/import** in Settings is the manual
  bridge between devices; the export format (`format: 1`) is the same shape
  sync will speak.

## Identity

Unchanged from ADR 0001: a Church Posting OIDC issuer is the target; no
accounts exist today, so no data leaves the device. The sync design above is
deliberately account-shaped (subject-scoped high-water marks) so identity can
land without reworking the stores.

## The Scribe's engine

The hosted service furnishes the Scribe (`/api/brief`, `/api/liturgy`,
`/api/critique`) with `ANTHROPIC_API_KEY` server-side. Self-hosted
installations furnish their own key. Without one, every route degrades
honestly: deterministic verification (quotation checks, reference validation)
still runs; nothing pretends to be intelligent.

## Implementation notes

*2026-07-19 — sync v1 client groundwork landed, provider-agnostic as designed.*

- `deletedAt` tombstones are on the envelope (`src/lib/store.ts`): `remove()`
  and `removeAll()` stamp rather than drop, read paths hide tombstones,
  `purgeTombstones()` reclaims them, and `listIncludingDeleted()` /
  `replaceAll()` are the sync layer's raw access. Records written before
  this change load unchanged.
- The merge (`src/lib/sync.ts`) is last-writer-wins at `updatedAt`
  granularity with deterministic tie-breaking (a tombstone beats a
  same-stamp edit), an idempotent upsert, and per-collection high-water
  marks. Whole-graph export carries tombstones, since format 1 is the
  shape sync speaks; a full import resets the sync cursors so both sides
  reconcile from the beginning.
- One refinement over the sketch above: the pull cursor is a server
  commit sequence, not a client `updatedAt`. A record pushed late with a
  stamp older than a device's cursor would otherwise never reach that
  device. `updatedAt` still decides every merge; the sequence only
  decides what a device has seen. The Postgres implementation satisfies
  this with an ordinary sequence column.
- `SyncTransport` is the seam between the engine and the wire. The
  reference implementation is in-memory; the two-device convergence proof
  (creates, edits, deletes, and conflicts on both sides) ran in a
  throwaway harness against it, 38 checks green. No network, no route, no
  provider SDK; the sync matrix rows stay unchecked until a server exists.

*2026-07-20 — sync v1 server half landed: schema, drivers, routes, transport.*

- `db/migrations/0001_sync.sql`: one table per GRAPH_KEYS collection keyed
  ("userId", id), the whole envelope as jsonb (tombstones ride along),
  "updatedAt" mirrored and indexed, and seq from one shared
  `sync_commit_seq` sequence as the commit stamp the pull cursor names.
  Indexed ("userId", seq), which is the whole pull pattern. `userId`
  carries the pre-auth namespace slug today and the identity subject when
  accounts land; the shape does not change at that point.
- `src/lib/sync-server.ts`: SyncStore, the server-side seam, with two
  drivers. MemorySyncStore ports MemoryTransport behind namespaces (dev,
  tests, single-process self-hosting). PgSyncStore runs the same LWW ruling
  in JS inside a transaction over Neon Postgres, stamping seq only on
  writes that win, so the merge semantics live in one module
  (src/lib/sync.ts) shared by both sides; store.ts and sync.ts dropped
  their "use client" directives to make that sharing possible.
- `src/app/api/sync/push` and `/api/sync/pull`: the protocol envelopes
  plus a namespace slug (a device-generated UUID until identity lands).
  Collections validate against GRAPH_KEYS, envelopes validate, batches cap
  at 500. With no SYNC_DRIVER and no DATABASE_URL the routes answer 503:
  an unconfigured deployment behaves exactly as before.
- `HttpTransport` in src/lib/sync.ts carries the envelopes to the routes,
  gated by NEXT_PUBLIC_BEREAN_SYNC so nothing user-facing changes. Verified
  against a live server on the memory driver with a throwaway harness:
  round trips, idempotent re-push, every LWW ruling (same-instant tombstone
  beats edit, later edit resurrects, canonical tie), cursor monotonicity
  and resume including the late old-stamped record, caps and rejections,
  and two SyncEngine instances converging through HttpTransport. PgSyncStore
  is verified by SQL review only; no live Postgres was available.
- Remaining for the auth wave: swap the namespace slug for the identity
  subject, provision Neon, and wire a settings surface to
  `configuredTransport()`.

*2026-07-20, auth wave: better-auth accounts landed, with magic links and anonymous sessions.*

- `src/lib/auth.ts`: better-auth 1.6 with the magicLink and anonymous
  plugins, nothing else. genericOAuth stays reserved and unwired per the
  plan. The database dialect follows DATABASE_URL: a pg Pool against Neon
  when set, a better-sqlite3 file at data/auth.db (gitignored) when not, so
  the full sign-in flow verifies locally with zero servers. better-auth
  drives both through its Kysely adapter; the schema is one shape either
  way. Delivery is a plain POST to the Resend API when RESEND_API_KEY and
  RESEND_FROM are set; without them the link prints to the server log and
  the flow completes, the documented dev mode.
- The handler mounts at `src/app/api/auth/[...all]`; `src/lib/auth-client.ts`
  is the browser half. The Settings tab gains the Account section
  (`src/components/shell/AccountSection.tsx`): email field and send-link,
  an anonymous-session option, sign-out, and the sync namespace the current
  identity resolves to. No header or status-bar presence; the surface stays
  quiet.
- The identity swap is `resolveNamespace` in `src/lib/sync-server.ts`: a
  valid session's user id wins and is never slug-validated (account ids are
  not slugs), the caller's slug decides otherwise, and both sync routes
  resolve through it. `configuredTransport(accountId)` on the client mirrors
  the choice, and the server's session ruling wins any disagreement, so a
  stale client value cannot write to the wrong namespace. Signed-out
  behavior everywhere is unchanged; no surface requires an account.
- `db/migrations/0002_auth.sql` carries the better-auth tables (user,
  session, account, verification) translated to pg types from the CLI's own
  generated schema. The sync "userId" column intentionally holds no foreign
  key to it: a slug and an account id share the column by design. The sqlite
  dialect creates its tables automatically on first use; the CLI migrate
  path remains for the pg side.
- Remaining: provision Neon (apply 0001 and 0002), set the auth env vars
  (DEPLOY.md), verify a Resend domain, and wire the Settings surface to run
  sync cycles through `configuredTransport()`.

