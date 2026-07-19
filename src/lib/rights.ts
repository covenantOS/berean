/**
 * Rights and provenance registry.
 *
 * Every resource Berean ships must have a documented rights entry before it is
 * presented, searched, quoted, exported, or indexed for AI use
 * (docs/BEREAN_INTEGRATION_BRIEF.md, "Licensing is a core system").
 */

export type AllowedUse =
  | "presentation"
  | "search"
  | "quotation"
  | "export"
  | "ai-indexing"
  | "offline";

export interface RightsEntry {
  id: string;
  title: string;
  kind: "bible-translation" | "commentary" | "lexicon" | "hymnal" | "font" | "dataset";
  rightsHolder: string;
  license: string;
  territoryNotes?: string;
  source: string;
  sourceRetrieved: string;
  allowedUses: AllowedUse[];
  notes?: string;
  status: "shipped" | "pending-license" | "planned";
}

export const RIGHTS_REGISTRY: RightsEntry[] = [
  {
    id: "kjv-1769",
    title: "The Holy Bible, King James Version (1769 Blayney text)",
    kind: "bible-translation",
    rightsHolder: "Public domain",
    license: "Public domain",
    territoryNotes:
      "In the United Kingdom, printing rights are governed by Crown letters patent; Berean's hosted and self-hosted use is outside that printing monopoly, but UK print publication should be reviewed.",
    source: "https://github.com/aruljohn/Bible-kjv",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Complete 66-book canon, stored per-book as JSON under data/kjv. This is the only Scripture text Berean currently ships; modern translations require signed licenses before any use is implied.",
    status: "shipped",
  },
  {
    id: "web",
    title: "World English Bible",
    kind: "bible-translation",
    rightsHolder: "Public domain",
    license: "Public domain (trademark on the name held by eBible.org)",
    source: "https://worldenglish.bible",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes: "Shipped as a parallel translation, stored per-book as JSON under data/translations/web.",
    status: "shipped",
  },
  {
    id: "asv",
    title: "American Standard Version (1901)",
    kind: "bible-translation",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://ebible.org/asv/",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes: "Shipped as a parallel translation, stored per-book as JSON under data/translations/asv.",
    status: "shipped",
  },
  {
    id: "bbe",
    title: "Bible in Basic English (1949)",
    kind: "bible-translation",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://ebible.org/bbe/",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes: "Shipped as a parallel translation, stored per-book as JSON under data/translations/bbe.",
    status: "shipped",
  },
  {
    id: "darby",
    title: "Darby Translation (1890)",
    kind: "bible-translation",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://ebible.org/eng-darby/",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes: "Shipped as a parallel translation, stored per-book as JSON under data/translations/darby.",
    status: "shipped",
  },
  {
    id: "ylt",
    title: "Young's Literal Translation (1898)",
    kind: "bible-translation",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://ebible.org/ylt/",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes: "Shipped as a parallel translation, stored per-book as JSON under data/translations/ylt.",
    status: "shipped",
  },
  {
    id: "brenton-lxx-english",
    title: "Brenton's English Septuagint (1851)",
    kind: "bible-translation",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://eBible.org/Scriptures/eng-Brenton_usfm.zip (details: https://ebible.org/find/details.php?id=eng-Brenton)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Sir Lancelot C. L. Brenton's translation of the Greek Septuagint, published 1851 and marked public domain by eBible.org. Old Testament only. Stored per-book as JSON under data/translations/brenton with LXX verse numbering kept as-is (Psalms numbered per the LXX, Esther carrying the additions as lettered verses, Malachi ending at chapter 3); the reader shows a numbering notice on divergent books instead of silently realigning. Raw USFM kept out of git; provenance in data/_sources/brenton/PROVENANCE.md; normalized by scripts/build-brenton.mjs.",
    status: "shipped",
  },
  {
    id: "lxx-greek-brenton",
    title: "Greek Septuagint (Brenton diglot text, 1851)",
    kind: "bible-translation",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://eBible.org/Scriptures/grcbrent_usfm.zip (details: https://ebible.org/find/details.php?id=grcbrent)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The Greek Septuagint text printed in Brenton's 1851 diglot (principally Codex Vaticanus), marked public domain by eBible.org. Old Testament only, with the same LXX versification as the English Brenton column. Chosen over the CrossWire SWORD LXX module (CCAT/Rahlfs), which is restricted to free non-commercial distribution, and over unlicensed or GPL repository mirrors. Stored per-book as JSON under data/lxx. Raw USFM kept out of git; provenance in data/_sources/lxx/PROVENANCE.md; normalized by scripts/build-lxx.mjs.",
    status: "shipped",
  },
  {
    id: "bsb-paratext",
    title: "Berean Standard Bible paratext (pericope headings and parallel references)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://eBible.org/Scriptures/engbsb_usfm.zip (details: https://ebible.org/find/details.php?id=engbsb)",
    sourceRetrieved: "2026-07-19",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Section headings and parallel-passage references extracted from the Berean Standard Bible USFM, marked public domain by eBible.org (contributor BSB Publishing, LLC). Only the paratext ships, not the BSB text: pericope boundaries with headings stored per-book as JSON under data/pericopes, worn by every furnished translation since the boundaries anchor by canon reference. Raw USFM kept out of git; provenance in data/_sources/bsb-usfm/PROVENANCE.md; built by scripts/build-pericopes.mjs.",
    status: "shipped",
  },
  {
    id: "matthew-henry",
    title: "Matthew Henry, Concise Commentary on the Whole Bible",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain (source edition marked CC0-1.0 by the digitizer)",
    source: "https://github.com/lyteword/mhenry-concise",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Concise edition (work name \"mhc\"), stored per-book as JSON under data/commentary/mhc. Covers all 66 books (1188 chapters; 2 Kings 1 is absent from the source edition). Raw download kept under data/_sources/mhc for provenance; normalized by scripts/build-commentary-mhc.mjs.",
    status: "shipped",
  },
  {
    id: "matthew-henry-full",
    title: "Matthew Henry, Commentary on the Whole Bible (complete, unabridged)",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain (source edition released CC0-1.0 by the digitizer)",
    source: "https://github.com/lyteword/mhenry-complete",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The complete six-volume commentary (work name \"mhenry\"), stored per-book as JSON under data/commentary/mhenry. Henry comments in verse-range blocks; sections carry the covered range. Raw markdown edition kept under data/_sources/mhenry (see PROVENANCE.md); normalized by scripts/build-commentary-mhenry.mjs.",
    status: "shipped",
  },
  {
    id: "jfb",
    title: "Jamieson, Fausset & Brown, Commentary Critical and Explanatory on the Whole Bible (1871)",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://ccel.org/ccel/jamieson/jfb.xml (Christian Classics Ethereal Library ThML export)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Whole-Bible commentary stored per-book as JSON under data/commentary/jfb. Raw ThML kept out of git; provenance in data/_sources/jfb/PROVENANCE.md; normalized by scripts/build-commentary-jfb.mjs.",
    status: "shipped",
  },
  {
    id: "clarke",
    title: "Adam Clarke, Commentary and Critical Notes on the Bible",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Clarke.zip (CrossWire SWORD module 2.0, text via Wikisource)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Whole-Bible commentary stored per-book as JSON under data/commentary/clarke. Raw module kept out of git; provenance in data/_sources/clarke/PROVENANCE.md; normalized by scripts/build-commentary-clarke.mjs.",
    status: "shipped",
  },
  {
    id: "barnes",
    title: "Albert Barnes, Notes on the New Testament",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Barnes.zip (CrossWire SWORD module 1.1)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "New Testament only: the CrossWire module contains no Old Testament volumes, and CCEL's Barnes ThML exports ship title pages without the commentary body, so no clean OT digitization was vendored. Stored per-book as JSON under data/commentary/barnes. Raw module kept out of git; provenance in data/_sources/barnes/PROVENANCE.md; normalized by scripts/build-commentary-barnes.mjs.",
    status: "shipped",
  },
  {
    id: "calvin",
    title: "John Calvin, Commentaries",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain (JSON conversion MIT-licensed by the digitizer)",
    source: "https://github.com/thefrenchpressed/pillar-commentary-data (from the CrossWire SWORD CalvinCommentaries module, digitized by CCEL from the Calvin Translation Society editions)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Covers the 47 books Calvin commented on (no Samuel/Kings/Chronicles, Job, Proverbs, Acts, Revelation, among others); a few front-matter verses are absent from the source module, and the source conversion is partial within some books (Isaiah ends at chapter 48, Ezekiel at 21, Jeremiah at 51), so uncovered passages simply do not appear. Stored per-book as JSON under data/commentary/calvin. Raw JSON tree kept under data/_sources/calvin-src (see PROVENANCE.md); normalized by scripts/build-commentary-calvin.mjs.",
    status: "shipped",
  },
  {
    id: "gill",
    title: "John Gill, Exposition of the Entire Bible",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be sourced: no clean machine-readable digitization found yet (not on CCEL, no CrossWire SWORD module, Project Gutenberg lacks it)",
    sourceRetrieved: "—",
    allowedUses: [],
    notes:
      "Confessional shelf priority. Registered as planned; the text ships only once a verified, openly licensed digitization is vendored.",
    status: "planned",
  },
  {
    id: "poole",
    title: "Matthew Poole, Annotations upon the Holy Bible",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be sourced: no clean machine-readable digitization found yet",
    sourceRetrieved: "—",
    allowedUses: [],
    notes: "Confessional shelf priority. Registered as planned until a verified digitization is vendored.",
    status: "planned",
  },
  {
    id: "pulpit-commentary",
    title: "The Pulpit Commentary (Spence & Exell, eds.)",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be sourced: no clean machine-readable digitization found yet",
    sourceRetrieved: "—",
    allowedUses: [],
    notes: "Registered as planned until a verified digitization is vendored.",
    status: "planned",
  },
  {
    id: "ellicott",
    title: "Charles Ellicott, Commentary for English Readers",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be sourced: no clean machine-readable digitization found yet",
    sourceRetrieved: "—",
    allowedUses: [],
    notes: "Registered as planned until a verified digitization is vendored.",
    status: "planned",
  },
  {
    id: "geneva-notes",
    title: "Geneva Bible marginal notes (1599)",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be sourced: a verified notes-bearing edition is needed (scrollmapper's Geneva1599 is the text without notes)",
    sourceRetrieved: "—",
    allowedUses: [],
    notes: "Registered as planned until a verified digitization of the notes is vendored.",
    status: "planned",
  },
  {
    id: "tsk-crossrefs",
    title: "Treasury of Scripture Knowledge (cross-references)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://github.com/ariseshinestudio/TSK (tskxref.txt, via JustVerses.com)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "~376,000 cross-references across all 66 books, stored per-book as JSON under data/crossrefs. TSK carries no popularity votes, so the votes field is 0. Raw download kept as data/_sources/tskxref.txt (format documented in data/_sources/tsk-readme.txt); normalized by scripts/build-crossrefs.mjs, which drops refs pointing at chapters/verses not present in the shipped KJV text.",
    status: "shipped",
  },
  {
    id: "naves-topical",
    title: "Orville J. Nave, Nave's Topical Bible",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Nave.zip (CrossWire SWORD module 3.0, from the CCEL digitization)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Topical index with nested sub-topics and ~100,000 scripture references, stored as data/topics/naves.json behind /topics and the workspace's topic guides (/topics/[work]/[id] redirects there). References are normalized to canonical slugs; entries whose references cannot be mapped are counted at build time. Raw module kept under data/_sources/naves (see PROVENANCE.md); normalized by scripts/build-topics.mjs.",
    status: "shipped",
  },
  {
    id: "torreys-topical",
    title: "R. A. Torrey, The New Topical Text Book (1897)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Torrey.zip (CrossWire SWORD module 1.3, via Bible Foundation)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Topical textbook with sub-topics and scripture proofs, stored as data/topics/torreys.json behind /topics and the workspace's topic guides (/topics/[work]/[id] redirects there). References are normalized to canonical slugs; unmappable references are counted at build time. Raw module kept under data/_sources/torreys (see PROVENANCE.md); normalized by scripts/build-topics.mjs.",
    status: "shipped",
  },
  {
    id: "strongs",
    title: "Strong's Exhaustive Concordance (lexical numbers and glosses)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "Public-domain text (Strong, 1890); digitization provenance to be documented",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Shipped as the Strong's-tagged KJV (data/kjv-strongs) and the Hebrew and Greek dictionaries (data/lexicon/strongs-hebrew.json, strongs-greek.json) behind the reader word-tap and the workspace's lexicon tab (/lexicon/[id] redirects there). Each entry is aggregated with its TBESH/TBESG extended-Strong's variants by scripts/build-lexicons.mjs.",
    status: "shipped",
  },
  {
    id: "tahot",
    title: "TAHOT: Translators Amalgamated Hebrew OT",
    kind: "dataset",
    rightsHolder: "Tyndale House Cambridge (STEPBible.org)",
    license: "CC BY 4.0",
    source: "https://github.com/STEPBible/STEPBible-Data (Translators Amalgamated OT+NT/)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Hebrew OT (corrected BHS/Leningrad base, Qere followed) with disambiguated extended Strong's tags and ETCBC morphology, stored per-book as JSON under data/tahot. Raw TSVs kept out of git; sources and retrieval documented in data/_sources/stepbible/PROVENANCE.md; normalized by scripts/build-step.mjs.",
    status: "shipped",
  },
  {
    id: "tagnt",
    title: "TAGNT: Translators Amalgamated Greek NT",
    kind: "dataset",
    rightsHolder: "Tyndale House Cambridge (STEPBible.org)",
    license: "CC BY 4.0",
    source: "https://github.com/STEPBible/STEPBible-Data (Translators Amalgamated OT+NT/)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Greek NT amalgamating NA27/28, TR, SBL, Tyndale House, WH, Tregelles, and Byzantine editions, with extended Strong's tags, Robinson morphology, and per-word edition flags, stored per-book as JSON under data/tagnt. Raw TSVs kept out of git; sources and retrieval documented in data/_sources/stepbible/PROVENANCE.md; normalized by scripts/build-step.mjs.",
    status: "shipped",
  },
  {
    id: "tbesh",
    title: "TBESH: Tyndale Brief lexicon of Extended Strongs for Hebrew",
    kind: "lexicon",
    rightsHolder: "Tyndale House Cambridge (STEPBible.org)",
    license: "CC BY 4.0",
    source: "https://github.com/STEPBible/STEPBible-Data (Lexicons/)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Abridged-BDB-style brief Hebrew lexicon keyed to extended Strong's numbers, aggregated onto every Hebrew base entry in data/lexicon/strongs-hebrew.json as a `tyndale` variant list (lemma, transliteration, part of speech, gloss, brief definition) and presented with attribution in the workspace's lexicon tab (/lexicon/[id] redirects there). Raw download kept under data/_sources/stepbible (out of git, see PROVENANCE.md); normalized by scripts/build-lexicons.mjs.",
    status: "shipped",
  },
  {
    id: "tbesg",
    title: "TBESG: Tyndale Brief lexicon of Extended Strongs for Greek",
    kind: "lexicon",
    rightsHolder: "Tyndale House Cambridge (STEPBible.org)",
    license: "CC BY 4.0",
    source: "https://github.com/STEPBible/STEPBible-Data (Lexicons/)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Abbott-Smith-based brief Greek lexicon keyed to extended Strong's numbers, aggregated onto every Greek base entry in data/lexicon/strongs-greek.json as a `tyndale` variant list (lemma, transliteration, part of speech, gloss, brief definition) and presented with attribution in the workspace's lexicon tab (/lexicon/[id] redirects there). Raw download kept under data/_sources/stepbible (out of git, see PROVENANCE.md); normalized by scripts/build-lexicons.mjs.",
    status: "shipped",
  },
  {
    id: "tipnr",
    title: "TIPNR: Translators Individualised Proper Names with all References",
    kind: "dataset",
    rightsHolder: "Tyndale House Cambridge (STEPBible.org)",
    license: "CC BY 4.0",
    source: "https://github.com/STEPBible/STEPBible-Data (Proper Nouns/)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). The Factbook backbone: 4,247 individualised people, places, and other proper names with family relationships, geolocation, and 31,974 mapped references (24 LXX-only and 6 unparsable source refs skipped and counted), stored as an index, per-letter detail shards, and per-book verse maps under data/entities. Presented in the workspace's factbook tab (/library/entity/[id] redirects in), indexed in /search and the Library, and linked from the reader apparatus, the Atlas, and the Timeline. Raw download kept under data/_sources/stepbible (out of git, see PROVENANCE.md); normalized by scripts/build-entities.mjs.",
    status: "shipped",
  },
  {
    id: "naturalearth",
    title: "Natural Earth, 1:110m Land (vector coastline/land dataset)",
    kind: "dataset",
    rightsHolder: "Public domain (Natural Earth)",
    license: "Public domain",
    source: "https://github.com/nvkelso/natural-earth-vector (geojson/ne_110m_land.geojson; terms: https://www.naturalearthdata.com/about/terms-of-use/)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "export", "offline"],
    notes:
      "The land base under the workspace's atlas tab (/library/atlas redirects in) and the locator maps in the Factbook's Location section. Vendored as GeoJSON under data/_sources/naturalearth (see PROVENANCE.md), projected and rendered to SVG by src/lib/atlas.ts at request time; no tile server and no mapping library is used.",
    status: "shipped",
  },
  {
    id: "ussher-chronology",
    title: "James Ussher, The Annals of the World (1658) — chronology framework",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "James Ussher, Annals of the World (1658, public domain); hand-curated event list at data/timeline/events.json",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The dated backbone of the workspace's timeline tab (/almanac/timeline redirects in): a hand-curated event list (creation to AD 95) following Ussher's public-domain chronology for the OT and standard conservative NT dates, cross-linked to TIPNR entities and canonical passages. Every entry is flagged as approximate where Ussher himself or modern scholarship diverges; ancient dates before the divided kingdom are conventional, not certain, and the data file's header says so plainly. The curation itself is Berean's own work from public-domain sources.",
    status: "shipped",
  },
  {
    id: "tvtms",
    title: "TVTMS: Translators Versification Traditions with Methodology for Standardisation",
    kind: "dataset",
    rightsHolder: "Tyndale House Cambridge (STEPBible.org)",
    license: "CC BY 4.0",
    source: "https://github.com/STEPBible/STEPBible-Data (Versification/)",
    sourceRetrieved: "2026-07-18",
    allowedUses: [],
    notes:
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Versification mapping across English, Hebrew, Latin, and Greek traditions; needed for the Tier 2 LXX parallel column and for aligning TAHOT Hebrew verse numbering. Not yet downloaded or shipped.",
    status: "planned",
  },
  {
    id: "mcheyne-calendar",
    title: "Robert Murray M'Cheyne, Daily Bread reading calendar (1842)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be transcribed from a verified edition of the original calendar",
    sourceRetrieved: "—",
    allowedUses: [],
    notes:
      "The named historic plan most readers ask for. Berean's shipped reading plans are generated algorithmically from the canon; M'Cheyne's actual table joins them only once transcribed from a verified source, never reconstructed from memory.",
    status: "planned",
  },
  {
    id: "westminster-shorter",
    title: "The Westminster Shorter Catechism (1647)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be sourced from a verified critical text",
    sourceRetrieved: "—",
    allowedUses: [],
    notes:
      "First catechism planned for family worship and the catechesis track, followed by the Heidelberg and Keach's. Question text ships only from a verified edition.",
    status: "planned",
  },
  {
    id: "psalter-1650",
    title: "The Psalms of David in Metre (Scottish Psalter, 1650)",
    kind: "hymnal",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be sourced from a verified edition with meters and tune pairings",
    sourceRetrieved: "—",
    allowedUses: [],
    notes:
      "First psalter planned for the Chapel. Until it ships, sung elements in the liturgy composer carry title/meter/tune/key metadata only.",
    status: "planned",
  },
  {
    id: "librivox-kjv-audio",
    title: "LibriVox King James Version recordings (chapter audio)",
    kind: "dataset",
    rightsHolder: "Public domain (LibriVox volunteers)",
    license: "Public domain (CC0 / CC Public Domain Mark per each archive.org item)",
    source: "https://archive.org (LibriVox KJV book projects; identifiers per recording in data/audio/manifest.json, e.g. https://archive.org/details/matthew_kjv_mp_librivox)",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation"],
    notes:
      "Chapter-synced audio for the reader's Listen control. All LibriVox recordings are public domain; scripts/build-audio.mjs only admits archive.org items whose metadata carries an explicit public-domain license URL (publicdomain/zero, publicdomain/mark, or licenses/publicdomain), and only files that map to exactly one chapter, so coverage is partial and honest: 383 of 1189 chapters across 22 of 66 books (multi-chapter-per-file LibriVox projects and items without a stated license, e.g. daniel_kjv_1112_librivox, are excluded). Audio is streamed from archive.org at listen time; no audio is vendored or redistributed.",
    status: "shipped",
  },
  {
    id: "reader-typeface",
    title: "Dedicated Scripture reading typeface",
    kind: "font",
    rightsHolder: "To be selected",
    license: "To be licensed",
    source: "—",
    sourceRetrieved: "—",
    allowedUses: [],
    notes:
      "Berean currently renders Scripture with system serif faces so no font license is implied. A purpose-chosen, properly licensed reading face (with Greek/Hebrew coverage) is an open decision per the integration brief.",
    status: "pending-license",
  },
];

export function getRights(id: string): RightsEntry | undefined {
  return RIGHTS_REGISTRY.find((r) => r.id === id);
}
