# Berean Workspace Rebuild Plan

Dated 2026-07-18. Supersedes the page-shaped UI, which the owner rejected. The
data layer, Scribe verification, rights registry, and all datasets are kept;
the shell is rebuilt as a workspace application. Research basis: five-agent
swarm, same date (Logos UX anatomy, SaaS architecture, stated-goals
extraction, codebase audit, study-app UX patterns).

## What was wrong

The app was built as pages: home page, top nav, URL-per-screen, full reloads.
Logos and every modern workspace app (VS Code, Linear, Obsidian) share one
structural decision: a persistent shell hosts changing content. The rebuild
adopts that grammar. The stack (Next.js 15, React 19, TypeScript) was never
the problem and stays.

## The five Logos mechanics to copy

1. Docked, tabbed, splittable panels; the user tiles the workspace.
2. Lettered link sets: panels in a set scroll to the same reference together.
3. A universal command box parsing references, words, and actions.
4. Named, savable layouts; continuous session persistence.
5. Selection-first context: tap a verse or word, every tool answers.

Plus the modern additions Logos lacks: Cmd+K palette, speed, opinionated
presets instead of clutter (the top Logos complaint is jam-packed menus).

## Architecture decisions (from research)

- Keep Next.js 15.x (OpenNext/Cloudflare adapter trap on 16 this quarter).
- Auth: better-auth, email + magic link, anonymous plugin for account-free
  first run, genericOAuth reserved for the Church Posting OIDC issuer.
- Database: Postgres (Supabase or Neon) as system of record; D1 rejected
  (no logical replication, write ceilings); better-auth's own tables plus
  one table per GRAPH_KEYS collection, indexed (userId, updatedAt).
- Sync v1: custom push/pull per ADR 0002 (envelope already on every record;
  add deletedAt tombstones, high-water marks, idempotent upsert, LWW).
  Sync v2 designated successor: Rocicorp Zero 1.0 (stable June 2026),
  tables stay Zero-compatible.
- Local substrate: SQLite (WASM+OPFS web, native in Tauri) behind the
  existing Collection interface; localStorage retired in Phase 2.
- Desktop: Tauri 2 (already scaffolded). Mobile: PWA baseline, Capacitor
  for store builds, Tauri mobile fallback. No React Native (forks the UI).
- The ~310 MB corpus becomes versioned content packs (R2/CDN): core pack
  (KJV + Strong's + lexica, ~20 MB) seeded; commentary/LXX/atlas/topical
  packs on demand, rights-gated by the registry.
- Rejected: Clerk/Firebase auth (custody + cost), Auth.js (declining),
  Electron (footprint), D1, Replicache (dead end), Convex/InstantDB,
  CRDTs as the graph backbone, bundling the corpus in any binary.

## UX skeleton (from pattern research)

- Icon rail: Read, Study, Search, Library, Documents, Almanac, Settings.
- Left sidebar: library tree + user notes/documents, inline filter.
- Center: tabbed pane grid, split horizontal/vertical, drag tabs.
- Right dock: commentary wall, lexicon, cross-refs, entities, Scribe.
- Status bar: current reference, translation, sync state.
- Cmd+K omnibox: references ("jn 3:16"), Strong's (G25), lemmas,
  morph queries, actions, recents. Every palette action also reachable
  by visible UI (no hidden keyboard-only power).
- Presets: Reading, Sermon prep, Word study, Original languages.
- Mobile mapping: rail to bottom tab bar, sidebars to drawers,
  tools to bottom sheets, reading-first. (Baseline shipped 2026-07-20:
  bottom bar, drawers, stacked panes behind a 767px breakpoint. Tools
  remain a right drawer until bottom sheets land; the device pass is
  pending.)
- Onboarding: translation preference, land in an open passage, seeded
  starter documents, no feature tour.

## Phases

- Phase 0: workspace shell (rail, sidebar, pane grid, right dock, status
  bar, omnibox, presets, session persistence) with the reader as the
  first real panel. Old routes remain reachable until Phase 1 completes.
- Phase 1: every shipped feature becomes a panel over the same data;
  link sets; old page routes and website chrome deleted. Deep links land
  in the shell as /workspace?ref= and ?tab= (src/components/shell/
  deep-link.ts); /read/[book]/[chapter] stays the citation scheme.
- Phase 2: better-auth + Postgres + sync v1 + SQLite substrate.
- Phase 3: Cloudflare deploy, Tauri Windows installer, PWA.
- Phase 4: mobile adaptation, content packs, Zero evaluation.

## Invariants (unchanged)

Rights first (registry gates every use), citations verified server-side,
the Scribe never writes the sermon, private by default, no engagement
mechanics, no ads, no unlicensed content, one knowledge graph by
reference never by copy.
