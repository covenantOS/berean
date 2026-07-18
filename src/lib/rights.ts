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
    id: "strongs",
    title: "Strong's Exhaustive Concordance (lexical numbers and glosses)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "Public-domain text (Strong, 1890); digitization provenance to be documented",
    sourceRetrieved: "2026-07-18",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Shipped as the Strong's-tagged KJV (data/kjv-strongs) and the Hebrew and Greek dictionaries (data/lexicon/strongs-hebrew.json, strongs-greek.json) behind the reader word-tap and /lexicon. Each entry is aggregated with its TBESH/TBESG extended-Strong's variants by scripts/build-lexicons.mjs.",
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
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Abridged-BDB-style brief Hebrew lexicon keyed to extended Strong's numbers, aggregated onto every Hebrew base entry in data/lexicon/strongs-hebrew.json as a `tyndale` variant list (lemma, transliteration, part of speech, gloss, brief definition) and presented with attribution at /lexicon/[id]. Raw download kept under data/_sources/stepbible (out of git, see PROVENANCE.md); normalized by scripts/build-lexicons.mjs.",
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
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Abbott-Smith-based brief Greek lexicon keyed to extended Strong's numbers, aggregated onto every Greek base entry in data/lexicon/strongs-greek.json as a `tyndale` variant list (lemma, transliteration, part of speech, gloss, brief definition) and presented with attribution at /lexicon/[id]. Raw download kept under data/_sources/stepbible (out of git, see PROVENANCE.md); normalized by scripts/build-lexicons.mjs.",
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
    allowedUses: [],
    notes:
      "Attribution: Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Disambiguated people and places with exhaustive references and geodata; the planned Factbook backbone (Tier 1 item 6). Not yet downloaded or shipped.",
    status: "planned",
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
