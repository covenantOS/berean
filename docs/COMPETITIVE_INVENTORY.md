# Competitive Inventory and Build Roadmap

Dated 2026-07-18. This document records a deep feature inventory of the six
products that define Bible software, a gap analysis against Berean's current
rooms, and the tiered roadmap that falls out of both. It honors the standing
rules in `CLAUDE.md`: rights first, citations load-bearing, no engagement
mechanics, one knowledge graph.

Method: each product was researched against its own feature pages, help
documentation, independent reviews, and licensing statements. Every feature
below carries a licensing class:

- **OPEN**: rebuildable from public-domain or open-license data.
- **LICENSED**: requires a paid publisher license; out of scope by charter.
- **SOFTWARE**: a pure software feature; the only cost is engineering.

---

## 1. Logos Bible Software

The deepest feature set in the category. Engine plus a licensed library of
120,000+ titles from 500+ publishers; one-time libraries ($300 to $10,000+)
plus Premium/Pro/Max subscriptions. (Sources: logos.com/features, Wikipedia,
Themelios 45.2 review, biblebuyingguide.com Logos 10 review.)

### Crown jewels

1. **Reverse interlinear.** English words aligned to Greek/Hebrew lemma and
   morphology. Depends on hand-built Lexham alignment datasets. Class:
   OPEN in principle; open alignments exist (OSHB Westminster morphology,
   morphgnt for SBLGNT, STEPBible TAHOT/TAGNT), but the alignment labor is
   the moat.
2. **Bible Word Study guide.** One-click lemma report: translation rings,
   syntactic usage, LXX equivalences. Class: SOFTWARE over open lexical
   data. Berean's `/lexicon/[id]` is the seed.
3. **Factbook.** Knowledge-graph entries for people, places, events, topics,
   passages. Proprietary datasets. Class: OPEN if rebuilt from ISBE,
   Easton's, Smith's (all public domain) plus STEPBible TIPNR (CC BY 4.0).
4. **Passage Guide.** Meta-search that aggregates your whole library per
   passage. Class: SOFTWARE; value scales with the shelf. Berean's Scribe
   brief plus the reader apparatus panel is the honest analog.
5. **Smart Search and Synopsis.** Semantic/AI search with footnoted
   summaries anchored in the library. Class: SOFTWARE over whatever corpus
   the rights registry admits.
6. **Sermon Manager/Builder.** Class: SOFTWARE. Berean's Pulpit pipeline
   already matches the shape and exceeds it with citation verification.
7. **Morphological and clause search** with lay-language templates. Class:
   OPEN via TAHOT (ETCBC morphology) and TAGNT (Robinson morphology), both
   CC BY 4.0.
8. **Timeline and Atlas.** Carta maps are LICENSED; an open timeline is
   buildable from public-domain chronologies and TIPNR geodata.
9. **Multi-panel linked layouts, visual filters.** Class: SOFTWARE.
10. **Library scale and dynamic pricing.** LICENSED content; permanently out
    of reach and not the fight Berean should pick.

### What Logos proves

The winning shape is a knowledge graph with an engine on top, which is
already Berean's architecture. Logos' genuine moats are licensed content and
two decades of hand-built alignment data. The open-data ecosystem
(STEPBible, OSHB, morphgnt) now covers most of the alignment layer.

---

## 2. Blue Letter Bible

Free, donor-funded, no ads, no paywall. The closest product to Berean's open
stack. (Sources: blueletterbible.org/help, Wikipedia, Christian Bytes
review, jeanwilund.com review.)

### Crown jewels

1. **Verse-tools drawer.** Tap any verse; interlinear, translations,
   cross-refs, commentaries, dictionaries, and notes fan out in place.
   Class: SOFTWARE. Berean's four-tab apparatus panel already has this
   shape; BLB's lesson is that everything is indexed per verse, never
   browsed as a separate library.
2. **Strong's interlinear with Thayer's and Gesenius.** Class: OPEN
   (Strong's, Thayer's, Gesenius all public domain). Berean ships Strong's;
   Thayer's and Gesenius/BDB are the upgrade.
3. **David Guzik commentary.** The most praised single resource. LICENSED;
   not reproducible without permission.
4. **TSK cross-references per verse.** OPEN. Berean ships this.
5. **Audio Bibles and passage-linked audio sermons.** Mixed licensing; PD
   recordings (LibriVox KJV) or TTS are the open path.
6. **Categorized color highlights with notebooks.** SOFTWARE.
7. **Breadth of modern translations.** LICENSED.
8. **Boolean/wildcard search with range filters.** SOFTWARE; Berean's
   concordance matches the core, and operators are a cheap upgrade.

### BLB's weaknesses (Berean's openings)

No cloud sync, no topical or semantic search, thin reading plans, dated UX,
no study workflow linking notes to output. Berean already exceeds it on
plans, memory work, and the Scribe.

---

## 3. Bible Gateway

Highest-traffic Bible site on the web. Zondervan-owned, ad-supported, Plus
subscription ($9.99/mo). (Sources: biblegateway.com/about, /plus, /resources,
support docs.)

### Crown jewels

1. **200+ versions in 70+ languages.** LICENSED. This is a licensing
   operation, not a software feature. Out of scope.
2. **Plus study library** (NIV/ESV study Bibles, modern commentaries).
   LICENSED.
3. **Multi-version keyword search** with phrase matching and range
   restriction. SOFTWARE; Berean's search is equivalent for admitted texts.
4. **Verse of the Day with shareable image cards.** SOFTWARE. Note: image
   cards edge toward engagement mechanics; a quiet daily verse fits the
   charter, share-bait styling does not.
5. **Verse-synced audio Bibles.** LICENSED recordings; PD recordings or TTS
   are the open path.
6. **Parallel translation columns.** SOFTWARE; already shipped in Berean's
   uncommitted reader work (`?p=`).
7. **Topical index.** Curated verses by topic. OPEN via Nave's Topical
   Bible and Torrey's Topical Textbook (public domain). A real Berean gap.
8. **Verse-synchronized PD reference shelf.** Berean parity path; MHC
   already shipped.

### What Bible Gateway proves

Its moat is licensing breadth, and its ad clutter is the most common user
complaint. Berean's no-ads charter and free open shelf is a direct counter-
position. Take the software features (parallel, topical index, audio); leave
the licensing race alone.

---

## 4. STEP Bible (Tyndale House, Cambridge)

Free, no login, no ads, UK charity. Built on CrossWire SWORD modules. The
single most important finding of this inventory: **the STEPBible datasets
are CC BY 4.0 and downloadable as plain TSV**, and they are the de facto
open standard for tagged original-language text. (Sources:
stepbible.github.io/STEPBible-Data, STEP user guide, stepbibleguide
copyrights page.)

### Crown jewels

1. **Hover quick-lexicon on any word.** Greek/Hebrew, parsing, and gloss
   with zero language knowledge required. Powered by TAHOT/TAGNT + TBESH/
   TBESG. OPEN.
2. **Configurable word-by-word interlinear.** Toggleable lines: original,
   transliteration, morphology, Strong's, gloss. OPEN.
3. **TAGNT amalgamated Greek NT.** One text flagging every word by edition
   (NA27/28, TR, SBLGNT, WH, Byz, THGNT), with Robinson morphology and
   context-sensitive glosses. A free manuscript apparatus. OPEN. Directly
   serves the LXX/textual commitments in the product vision.
4. **TAHOT Hebrew OT.** Leningrad-based, ETCBC morphology, Ketiv/Qere,
   semantic tagging of prefixes/suffixes. OPEN.
5. **Extended/disambiguated Strong's.** Splits merged Strong's numbers into
   distinct lemmas, backward compatible. A drop-in upgrade to Berean's
   existing stack.
6. **Morphology-aware original-language search.** Logos territory, free.
   SOFTWARE over TAHOT/TAGNT.
7. **TIPNR proper-names dataset.** Every person and place individualized,
   with family relationships, geolocation, exhaustive references. CC BY
   4.0. The backbone of a Factbook-class feature.
8. **TVTMS versification mapping.** Aligns divergent versification across
   traditions. Needed once Berean carries the LXX or Vulgate in parallel.
9. **Lexicons: TBESH (abridged BDB), TBESG (corrected Abbott-Smith), TFLSJ
   (full LSJ).** CC BY 4.0 with attribution.
10. **Multi-panel workspaces.** SOFTWARE.

### What STEP proves

Everything STEP does is legally reproducible with attribution. Berean's
rights registry can admit STEPBible-Data wholesale, which upgrades the
Reading Desk from Strong's-tagged KJV to a genuinely tagged Hebrew and
Greek text with morphology, and hands the Library a Factbook backbone.

---

## 5. BibleHub

Free, no login, donor-funded with modest ads. Nearly everything it displays
is public domain. (Sources: biblehub.com verse pages, topical index, atlas,
learnofchrist.com and scripturespy.com reviews.)

### Crown jewels

1. **The verse page.** 30+ translations stacked, then interlinear,
   cross-refs, TSK, commentaries, and context on one page, under stable
   predictable URLs. SOFTWARE over OPEN data.
2. **Interlinear with full morphology per verse.** OPEN data.
3. **Aggregated lexicon pages.** Strong's + Thayer's + BDB + HELPS
   Word-studies in one entry, plus every canonical occurrence. OPEN. The
   exact upgrade path for `/lexicon/[id]`.
4. **The commentary wall.** Per-verse excerpts from Matthew Henry, Pulpit
   Commentary, Barnes, Gill, JFB, Adam Clarke, Ellicott, Cambridge Bible,
   Geneva notes. All public domain. The model for Berean's Library shelf.
5. **One-page density.** Every study aid one click from the verse. Berean's
   apparatus panel already embodies this; BibleHub confirms the pattern.
6. **Nave's and Torrey's topical layer** integrated with concordance and
   encyclopedia. OPEN.
7. **Atlas with a map for every location.** PD maps plus modern rendering.
8. **Zero friction.** No account, no paywall. Matches Berean's charter.

### BibleHub's structural gap (Berean's ground)

No accounts, notes, highlights, or workspace of any kind. BibleHub is a
reference site. Berean's marginalia, memory work, Writing Desk, and Pulpit
occupy exactly the quadrant BibleHub refuses.

---

## 6. YouVersion

One billion installs. Free, no ads, donor-funded by Life.Church. (Sources:
bible.com/app, American Bible Society, growthcasestudies.com,
ChurchTechToday.)

### Crown jewels

1. **Translation and language breadth** (2,500+ versions, 2,100+ languages
   via the Digital Bible Library). LICENSED. Out of scope.
2. **Free audio Bibles.** LICENSED recordings.
3. **Reading-plan ecosystem with Plans with Friends.** Contributed content
   plus group discussion. The plan engine is SOFTWARE; the marketplace and
   social layer conflict with the charter's shape for community, and the
   content is licensed.
4. **Verse of the Day, streaks, badges.** SOFTWARE, and explicitly
   off-limits: streaks and badges are engagement mechanics, banned by the
   charter. A quiet daily verse is fine; the habit engine is not.
5. **Verse Images.** Text-on-photo art generator. SOFTWARE; permissible if
   kept as a print/export aid rather than a share-bait loop.
6. **Offline mode.** License-gated for them; free for Berean since every
   admitted text is open. The Tauri shell (ADR 0002) already points here.
7. **Cross-device sync of highlights and notes.** SOFTWARE plus sync infra;
   ADR 0002's local-first sync covers it.
8. **Completely free, no ads.** Berean matches this by charter.

### What YouVersion proves

Its depth is deliberately thin: no interlinear, no lexicon, no commentary,
no cross-references. Berean already exceeds it in every study dimension.
The only things worth taking are reader polish, sync, offline, and audio.

---

## 7. Gap analysis against Berean's rooms

Current state per the codebase inventory (2026-07-18): the reader ships
KJV with marginalia, five PD translations with parallel view, Strong's
tagged text, TSK cross-refs, and MHC concise in a four-tab apparatus;
`/lexicon` does Strong's lookup with occurrence lists; `/search` covers the
canon; plans, memory work, Pulpit, Chapel, Writing Desk, and Almanac are
all live on one store; the Scribe briefs and critiques with server-side
citation verification.

| Capability | Best in class | Berean today | Verdict |
|---|---|---|---|
| Tagged Hebrew/Greek with morphology | Logos, STEP | Strong's numbers only | **Gap. Tier 1.** |
| Interlinear display | STEP | Word-tap Strong's popup | **Gap. Tier 1.** |
| Lexicon depth | BibleHub (Strong's+Thayer's+BDB+HELPS) | Strong's defs only | **Gap. Tier 1.** |
| Commentary shelf breadth | BibleHub wall, BLB | MHC concise only | **Gap. Tier 1.** |
| Topical index | Bible Gateway, BibleHub (Nave's/Torrey's) | None | **Gap. Tier 1.** |
| People/places knowledge graph | Logos Factbook | None | **Gap. Tier 1 via TIPNR.** |
| Per-verse tools density | BLB drawer, BibleHub page | Four-tab apparatus | Parity, extend with above |
| Morphology-aware search | STEP, Logos | Substring search | **Gap. Tier 2.** |
| Sermon pipeline | Logos Sermon Manager | Pulpit, five stages | **Berean leads** (citation verification) |
| Notes/marginalia/workspace | Logos | Marginalia + documents | Parity, better privacy |
| Reading plans | YouVersion marketplace | Five algorithmic generators | Parity for charter scope |
| Daily verse | Bible Gateway, YouVersion | None | Small Tier 2 addition |
| Audio | Bible Gateway, YouVersion | None | **Gap. Tier 2 (PD recordings/TTS).** |
| Atlas/maps | Logos, STEP | None | Tier 2 via TIPNR geodata |
| Timeline | Logos | None | Tier 2 |
| Offline/desktop | YouVersion, Logos | Tauri scaffold | In progress per ADR 0002 |
| Sync | Logos, YouVersion | Export/import bridge | Designed in ADR 0002 |
| Modern translations | All three giants | None | **Never chase. LICENSED.** |
| AI study assistance | Logos Smart Search | Scribe briefs/critiques | **Berean leads** (verification, confession governance) |

Registry hygiene flags found during the inventory, to fix alongside any of
the below: ASV, BBE, Darby, YLT are served but unregistered; WEB is served
while still marked planned; the Strong's lexicons and tagged KJV are served
while marked planned; `ChapterReader.tsx:578` credits cross-refs to
OpenBible.info (CC-BY) while the registry and data say TSK.

---

## 8. The roadmap

### Tier 1: build now, all from open data

Ordered by leverage. Each item names its data source, license, and the repo
surfaces it touches.

**1. Admit STEPBible-Data to the rights registry (CC BY 4.0, attribution
required).** This one act unblocks items 2 through 6. Add entries for
TAHOT, TAGNT, TBESH, TBESG, TIPNR, TVTMS with source URLs
(stepbible.github.io/STEPBible-Data) and the CC BY 4.0 attribution text.
File: `src/lib/rights.ts`.

**2. True original-language texts under the Reading Desk.** Ship TAHOT
(Hebrew OT, ETCBC morphology) and TAGNT (Greek NT, Robinson morphology,
edition flags) as tagged per-book JSON, with a build script in the pattern
of `scripts/build-crossrefs.mjs`. The reader gains an original-text mode
and a word-tap that shows lemma, parsing, and gloss, replacing the
Strong's-number indirection. Files: `scripts/build-step.mjs` (new),
`data/tahot/`, `data/tagnt/`, `src/lib/tagged.ts`, `src/lib/bible.ts`,
`src/components/ChapterReader.tsx`. This is the Logos reverse-interlinear
and STEP hover-lexicon crown jewel, legally free.

**3. Lexicon depth upgrade.** Extend `/lexicon/[id]` entries to aggregate
TBESH (abridged BDB) and TBESG (Abbott-Smith) alongside the existing
Strong's definitions, with Thayer's and full BDB (public domain) as
alternates. Files: `data/lexicon/`, `src/lib/lexicon.ts`,
`src/app/lexicon/[id]/page.tsx`, `src/app/api/lexicon/`. This is the
BibleHub aggregated-lexicon crown jewel.

**4. Morphology-aware concordance.** Add lemma and parsing search
("every aorist imperative of πιστεύω") on top of TAGNT/TAHOT, surfaced as
an advanced mode of `/search` and from any lexicon page. Files:
`src/lib/bible.ts` (searchCanon extension), `src/app/search/page.tsx`.
Logos morph search, free.

**5. The commentary wall.** Extend the Shelf tab from MHC concise to a
per-verse wall: Matthew Henry full, Gill, Barnes, JFB, Adam Clarke, Pulpit
Commentary, Ellicott, Geneva notes. All public domain; CCEL and similar
hold clean digitizations. Files: `scripts/build-commentary-*.mjs` (new per
source), `data/commentary/<work>/`, `src/lib/commentary.ts`,
`src/components/ChapterReader.tsx` (Shelf tab). Register each work in
`rights.ts` before it ships. This is BibleHub's most-copied feature and
the Library's confessional shelf (Calvin, Poole, Gill, Owen, Henry per the
vision).

**6. Factbook backbone from TIPNR.** Import TIPNR (CC BY 4.0) into a
people/places dataset; render entity pages (names, relationships,
geolocation, exhaustive references) in the Library and link them from the
reader apparatus. Files: `scripts/build-entities.mjs`, `data/entities/`,
new `src/lib/entities.ts`, new `/library/[entity]` routes,
`ChapterReader.tsx`. This is the Logos Factbook crown jewel at zero
licensing cost.

**7. Topical index.** Build Nave's Topical Bible and Torrey's Topical
Textbook (public domain) into a `/topics` surface: topic pages listing
verses with text, linked from search and the reader. Files:
`scripts/build-topics.mjs`, `data/topics/`, `src/lib/topics.ts`, new
`/topics` routes. Covers the Bible Gateway/BibleHub topical gap.

**8. Registry hygiene.** Register ASV, BBE, Darby, YLT (all public domain)
and promote WEB and Strong's from planned to shipped; fix the stale
OpenBible attribution in `ChapterReader.tsx`. File: `src/lib/rights.ts`.

### Tier 2: build later, after Tier 1 lands

- **Audio.** LibriVox KJV recordings (public domain) or a quality TTS pass,
  chapter-synced in the reader. Confirm recording licenses individually in
  the registry. SHIPPED 2026-07: LibriVox recordings chapter-synced in the
  reader, 383 chapters mapped in `data/audio/manifest.json`.
- **Atlas.** TIPNR geodata rendered on open map tiles; PD historical atlas
  scans as overlays. SHIPPED 2026-07: `/library/atlas`, TIPNR geography on a
  Natural Earth base, SVG, no dependencies.
- **Timeline.** Public-domain chronology data, filterable, linked to
  Factbook entities and the Almanac. SHIPPED 2026-07: `/almanac/timeline`,
  curated chronology with era bands, reader and Factbook links.
- **LXX as a first-class parallel column.** Brenton's English Septuagint
  (public domain) plus the Greek LXX (CCAT/Tauber open texts), with TVTMS
  handling versification drift. Direct from the product vision's textual
  commitments. SHIPPED 2026-07: Brenton English and Greek LXX as OT-only
  parallel columns, LXX versification kept with divergence notices.
- **Daily verse** on the home page, quiet, no streak, no badge. SHIPPED
  2026-07.
- **Semantic concordance.** Scribe-assisted search over the admitted corpus
  ("find passages about covenant faithfulness"), every result a real verse
  reference verified against the canon, in the pattern of the existing
  brief verification. Logos Smart Search, charter-shaped. SHIPPED 2026-07.
- **Sync.** ADR 0002 local-first sync, replacing export/import as the
  bridge.
- **Verse-image export** for the Writing Desk, as a print/share aid only.
  SHIPPED 2026-07: the reader margin exports a selected verse as a
  letterpress SVG card (print/export aid, no share mechanics); the Writing
  Desk hook remains open.

### Tier 3: never build

Each of these violates the charter or copyright, whatever the competition
does:

- Streaks, badges, notifications-as-habit-engine, activity feeds, any
  engagement mechanic (YouVersion's core loop).
- Ads anywhere in the product (Bible Gateway's model).
- Modern translations (NIV, ESV, NASB, NLT, CSB, NKJV, LSB) without a
  signed publisher license registered in `rights.ts` first.
- Licensed commentaries and study Bibles (Guzik, ESV Study Bible, Zondervan
  library) without licenses.
- Commercial audio Bible recordings.
- Scraped content of any kind. Every dataset enters through the registry
  with a documented license and retrieval date, per ADR 0001.
- A social graph inside the app. Community belongs to the church, and
  church features belong to Covenant OS after contract review.

---

## 9. Data source register

| Dataset | License | Covers roadmap items |
|---|---|---|
| STEPBible-Data: TAHOT, TAGNT, TBESH, TBESG, TFLSJ, TIPNR, TVTMS | CC BY 4.0 (attribution) | 1, 2, 3, 4, 6, LXX/Tier 2 |
| Strong's Hebrew/Greek dictionaries | Public domain | shipped; 3 |
| Thayer's Greek Lexicon | Public domain | 3 |
| Brown-Driver-Briggs | Public domain | 3 |
| Treasury of Scripture Knowledge | Public domain | shipped |
| Matthew Henry (concise and full), Gill, Barnes, JFB, Clarke, Ellicott, Pulpit Commentary, Geneva notes | Public domain (CCEL digitizations; verify per-source terms) | 5 |
| Nave's Topical Bible, Torrey's Topical Textbook | Public domain | 7 |
| ISBE, Easton's, Smith's, Hitchcock's | Public domain | 6, Library dictionaries |
| KJV 1769, ASV, WEB, YLT, BBE, Darby | Public domain | shipped (register the four stragglers) |
| Brenton's English Septuagint, CCAT LXX | Public domain / open | Tier 2 LXX |
| LibriVox KJV recordings | Public domain | Tier 2 audio |
| OSHB (Open Scriptures Hebrew Bible), morphgnt | CC licenses (verify per-repo) | alternate to TAHOT/TAGNT |

Every row must become a rights-registry entry with holder, license text,
source URL, retrieval date, and allowed uses before its data is presented,
searched, quoted, exported, or AI-indexed. That is the gate, per ADR 0001.

## 10. What this means in one paragraph

The category's crown jewels split cleanly. Everything licensed (modern
translations, premium study libraries, commercial audio, Guzik) stays on
the far side of a wall Berean should not assault. Everything great that
remains (reverse interlinear, morphology search, lexicon aggregation,
commentary wall, factbook, topical index, atlas, timeline) is buildable
from CC BY 4.0 Tyndale House data and public-domain scholarship, and
Berean already leads the category in the two places that matter most for
its market: a private, verified, confession-governed Scribe, and a working
pipeline from text to sermon on one knowledge graph. Tier 1 closes the
study-depth gap with open data alone. That is the whole plan.
