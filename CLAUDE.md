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
- `src/lib/bible.ts` — text loading, whole-canon search, word study
- `src/lib/store.ts` — the one knowledge-graph substrate (all collections, export/import/delete; sync envelope per ADR 0002)
- `src/lib/rights.ts` — rights & provenance registry (surfaced at `/sources`)
- `src/lib/refs.ts` — server-side reference parsing and quotation verification
- Room models on the store: `marginalia.ts`, `projects.ts` (study+sermon pipeline), `documents.ts`, `liturgy.ts`, `plans.ts`, `memory.ts`, `almanac.ts`, `settings.ts`
- Rooms: `/read` (+ `/plans`, `/memory`, `/search`), `/pulpit`, `/chapel`, `/desk`, `/library`, `/almanac`, `/study`, `/settings`, `/sources`
- The Scribe: `src/app/api/brief`, `api/liturgy`, `api/critique` (all citation-verified server-side; honest degradation without a key); `api/passage` serves verse text to editors
- `desktop/` — Tauri shell for Mac/Windows (ADR 0002)
- `npm run dev` / `npm run build` from this directory

## Current status

All six rooms are working on the one knowledge graph: reader with marginalia,
plans, and memory work; Pulpit pipeline and archive; Chapel liturgy composer
with settled forms, print, and family worship; Writing Desk with verified
Scripture insertion and the Scribe as critic; Library word study; Almanac
calendar and rule of life; settings with governed Scribe memory and
whole-graph export/import/delete. Original-language apparatus shipped: TAHOT
(Hebrew OT) and TAGNT (Greek NT) under the reader, lexicon aggregation at
`/lexicon/[id]`, and morphology-aware lemma/parsing search as a mode of
`/search`. The Factbook backbone shipped: TIPNR people and places under
`data/entities` (scripts/build-entities.mjs, src/lib/entities.ts), entity
pages at `/library/entity/[id]`, a people-and-places index and filter in the
Library, an entity group in `/search`, and verse-level mentions in the
reader margin. Platform decisions in ADR 0002 (Cloudflare,
desktop/mobile/web, local-first sync). The reader's Shelf tab is now a
commentary wall: Matthew Henry complete and concise, Calvin, JFB, Clarke, and
Barnes (NT) ship as per-book JSON under `data/commentary/<work>/`, each with a
build script, a vendored source with PROVENANCE.md, and a shipped rights
entry; Gill, Poole, the Pulpit Commentary, Ellicott, and the Geneva notes are
registered as planned pending clean digitizations. Not yet built: database and
identity (open decisions — data is device-local), psalter/catechism texts
(need verified datasets; registered as planned in rights), and all Covenant
OS integration (contracts first).
