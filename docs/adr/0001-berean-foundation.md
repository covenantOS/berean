# ADR 0001 — Berean foundation: framework, runtime, data boundary, identity, and content assumptions

Status: accepted · Date: 2026-07-18

Per the handoff in `docs/BEREAN_INTEGRATION_BRIEF.md` (Covenant OS revision
`460c77b`), this records the foundation decisions made before scaffolding
features.

## 1. Separate, independently deployable application

Berean is a self-contained application with its own `package.json`,
dependencies, and docs. It imports nothing from the Covenant OS codebase,
shares no database, schema, session cookie, or credential with it, and adds
no Covenant integration endpoints. It currently lives in the `berean/`
directory of this repository **only because this session's tooling is scoped
to this repository** — the directory is structured to be lifted verbatim
into its own repository, which remains the required end state.

## 2. Framework and runtime

Next.js (App Router, TypeScript, Tailwind v4), matching the family's stack
so the eventual OpenNext/Cloudflare Workers path used by Covenant OS applies
to Berean without a rewrite. Nothing in the code assumes Node-only APIs
beyond filesystem reads of bundled canon data, which `outputFileTracingIncludes`
carries into serverless output.

## 3. Data boundary: no database yet, visibility scoped from day one

Neon/Postgres ownership, tenancy, and the identity issuer are open decisions
in the brief. Rather than prejudge them, user-authored data (marginalia,
study projects) persists client-side (localStorage) with explicit
`visibility` scope fields (`private` today; `personal`/`church`/`public`
reserved) and export/delete controls. When the identity and database
decisions land, the storage layer swaps behind the same interfaces without a
data-model change. Nothing a user writes leaves the device today, and the UI
says so.

## 4. Identity placeholder

No accounts. No cookie is set. The stable-subject OIDC model described in the
brief is expected to arrive as a first-party issuer shared with Covenant OS;
Berean will consume it rather than invent a parallel account system.

## 5. Content licensing assumptions

Only content with documented rights ships. The rights/provenance registry
(`src/lib/rights.ts`, surfaced at `/sources`) is the gate: a resource absent
from the registry, or whose entry does not allow a use, is not presented,
searched, quoted, exported, or AI-indexed. Initial shipped content is the
public-domain KJV (source and retrieval date recorded). Commentaries,
lexica, modern translations, hymnals, and a licensed reading typeface are
registered as planned/pending and are not implied anywhere in the UI.

## 6. The Scribe

The cited exegetical brief is the founding Scribe labor. It runs server-side
against the Anthropic API only when an operator supplies a key; without one
the feature reports itself unfurnished rather than pretending. The brief is
schema-constrained, cites only the provided chapter text, and every
quotation is verified server-side against the actual verse before display —
failed verifications are visibly flagged, never hidden. No user notes or
project content are sent to the model; only the public-domain chapter text
is.

## 7. Covenant OS integration

Deferred entirely, per the brief: no integration endpoints exist and none
will be added before versioned contract schemas and fixtures are proposed
and reviewed in the Covenant OS repository.
