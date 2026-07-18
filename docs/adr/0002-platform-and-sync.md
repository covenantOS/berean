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
