# Berean implementation context

Berean is Church Posting's Scripture-study sibling product to Covenant OS.
It must remain an independently deployable application: no imports from the
Covenant OS codebase, no shared database, sessions, or credentials, and no
Covenant integration endpoints before versioned contracts are reviewed in
the Covenant OS repository.

Before changing product behavior, read:

1. `docs/BEREAN_INTEGRATION_BRIEF.md` — the authoritative handoff (copied from Covenant OS revision `460c77b`); it defines ownership, identity, contracts, agent boundaries, rights requirements, and the build order.
2. `docs/COVENANT_DESIGN_LANGUAGE.md` — the shared family design standard.
3. `docs/adr/0001-berean-foundation.md` — the foundation decisions (framework, data boundary, identity placeholder, licensing assumptions).

## Standing rules

- **Rights first.** Nothing is presented, searched, quoted, exported, or AI-indexed without a registry entry in `src/lib/rights.ts` permitting that exact use. Never imply an unlicensed resource is included.
- **Citations are load-bearing.** The Scribe cites only text it was given; every quotation is verified against the actual verse server-side and failures are flagged visibly. A fabricated citation is the gravest failure in the product.
- **The Scribe prepares the study; it never writes the sermon** and never speaks on its own authority. It does not render verdicts on disputed doctrine.
- **User work is private by default.** Marginalia and projects carry explicit visibility scopes and full export/delete controls. Do not add telemetry, harvesting, or engagement mechanics (no streaks, badges, confetti, notifications).
- **Design:** bright, legible, print-and-architecture. Work surfaces white/light cool paper; stained-glass color (`--stained-*` tokens) as restrained signal, never wallpaper; no tan/brown app chrome; square-ish corners; borders before shadows. Warm paper and candlelight modes exist **inside the reader surface only**. The rooms (Chapel, Reading Desk, Library, Pulpit, Almanac) are wayfinding language over one knowledge model — do not build six data silos or scaffold empty rooms.
- **One knowledge graph.** Passages, sources, notes, projects, documents, calendars — a note appears in multiple contexts by reference, never by copy.

## Layout

- `data/kjv/` — 66 KJV book JSONs (public domain; provenance in the rights registry)
- `src/lib/canon.ts` — canonical book/chapter identifiers (slugs are the passage-reference scheme)
- `src/lib/bible.ts` — text loading and whole-canon search
- `src/lib/rights.ts` — rights & provenance registry (surfaced at `/sources`)
- `src/lib/marginalia.ts`, `src/lib/projects.ts` — client-side stores (placeholder persistence; see ADR 0001 §3)
- `src/app/read/…` — the reader; `src/app/study/…` — study projects + brief; `src/app/api/brief` — the Scribe
- `npm run dev` / `npm run build` from this directory

## Current status

Foundation + first pastoral job are built (reader, marginalia, concordance,
rights registry, appointed-text-to-cited-brief). Not yet built: database and
identity (open decisions), original-language apparatus (needs verified
datasets), commentary shelf (needs sourced texts), all Covenant OS
integration, and the Chapel/Pulpit/Writing Desk/Almanac expansions.
