# Berean

> "Now these Jews were more noble than those in Thessalonica; they received
> the word with all eagerness, examining the Scriptures daily to see if
> these things were so." — Acts 17:11

Berean is software for Scripture study and authored knowledge, by Church
Posting — the study-side sibling product to Covenant OS. This is the
foundation release: the reader, private marginalia, a whole-canon
concordance, the rights & provenance registry, and the first pastoral job —
an appointed text carried to a cited exegetical brief.

## What is here

- **The reader** (`/read/[book]/[chapter]`, the citation scheme; pickers redirect into `/workspace`) — the complete KJV canon set with typographic care: poetry as poetry, prose as flowing paragraphs, illuminated drop capitals, and paper / warm / evening reading modes (reader surface only; the shell stays bright).
- **Marginalia** — notes in the margin, attached to verses. Private, stored on-device, exportable and deletable. Visibility scopes are in the data model from day one.
- **Concordance** (`/search`) — whole-canon text search; every hit opens the passage at the verse.
- **Study projects** (`/study`) — appoint a passage, keep your notes, and request the Scribe's exegetical brief: schema-constrained, citing only the chapter text, with every quotation verified server-side against the actual verse (failures flagged, never hidden).
- **Sources** (`/sources`) — the rights registry. Every shipped text documents its source, license, and allowed uses; unlicensed resources are never implied.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

The Scribe's brief requires an Anthropic API key on the server:

```bash
ANTHROPIC_API_KEY=... npm run dev
```

Without a key, everything else works; the brief reports itself unfurnished.

## Documents

- `docs/BEREAN_INTEGRATION_BRIEF.md` — the authoritative product/integration handoff
- `docs/COVENANT_DESIGN_LANGUAGE.md` — the shared family design standard
- `docs/adr/0001-berean-foundation.md` — foundation decisions
- `CLAUDE.md` — implementation context and standing rules

Berean is designed to be an independently deployable application and is
slated for its own repository; it shares no code, database, or session state
with Covenant OS.
