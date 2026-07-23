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
    id: "macula-hebrew",
    title: "MACULA Hebrew Linguistic Datasets (Septuagint alignment, WLC syntax trees, and Clear annotations)",
    kind: "dataset",
    rightsHolder: "Biblica, Inc. (Clear Bible)",
    license: "CC BY 4.0",
    source:
      "https://github.com/Clear-Bible/macula-hebrew (sources/Clear/annotations/annotations.xml)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Attribution: MACULA Hebrew Linguistic Datasets, available at https://github.com/Clear-Bible/macula-hebrew/ (CC BY 4.0). Three layers ship. The word-level alignment behind the Word Study guide's Septuagint Translation section: each Hebrew morpheme carries its Hebrew Strong's id and the Greek equivalent the LXX translators used, with that Greek word's Strong's id, aggregated as data/lxx-strongs/hebrew-greek.json by scripts/build-lxx-strongs.mjs; both sides use standard Strong's numbering, so no cross-system mapping is built, and MACULA's private prefix/suffix numbers (which collide with real Strong's entries) are excluded by an empirical rule recorded in data/lxx-strongs/_meta.json. The Clear Bible syntax trees (Westminster trees, Groves Center CC BY 4.0, combined with OpenScriptures morphology CC BY 4.0) behind the Exegetical Guide's Constructions section: clause-level grammatical functions per verse, stored per-book under data/constructions and built by scripts/build-constructions.mjs from WLC/lowfat, with Hebrew verse numbering mapped onto TAHOT English numbering through the alt table. The semantic frames and participant referents the same files carry, both named in the repository's LICENSE.md under the CC BY 4.0 grant, sit behind the guide's Who Does What section and the original-language search's role: filter: per-verse verb frames naming each annotated verb's agent, patient, recipient, and causer arguments, and per-verse referent rows resolving pronominal mentions to their antecedents, stored per-book under data/frames and built by scripts/build-frames.mjs; the frames build excludes the private letter-suffixed Strong's numbers on the same rule as the LXX equivalents build. The word-level SDBH attributes (@sdbh, @lexdomain) are UBS data stated as used with permission and are excluded; Hebrew semantic domains ship from the UBS open-license dictionary (rights id ubs-dictionaries). Chosen after every Strong's-tagged LXX text traced back to restricted sources (CCAT/CATSS user agreement, CrossWire LXX and ABPGrk modules, eliranwong's CC BY-NC-SA and GPL repos); the full audit is in data/_sources/macula-hebrew/PROVENANCE.md. The raw annotations and lowfat files are kept out of git; the repository's LICENSE.md is kept as the license evidence.",
    status: "shipped",
  },
  {
    id: "macula-greek",
    title: "MACULA Greek Linguistic Datasets (Nestle 1904 syntax trees and Clear annotations)",
    kind: "dataset",
    rightsHolder: "Biblica, Inc. (Clear Bible)",
    license: "CC BY 4.0",
    source:
      "https://github.com/Clear-Bible/macula-greek (Nestle1904/lowfat/*.xml)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Attribution: MACULA Greek Linguistic Datasets, available at https://github.com/Clear-Bible/macula-greek/ (CC BY 4.0). Two layers of the Clear Bible syntax trees over the public-domain Nestle 1904 text ship. The clause-level grammatical constructions (Subject, Verb, Copula, Object, Second Object, Indirect Object, Predicate, Adverbial, plus the trees' auxiliary attachment role) sit behind the Exegetical Guide's Constructions section, per-verse clause records stored per-book under data/constructions and built by scripts/build-constructions.mjs. The semantic frames and participant referents, both named in the repository's LICENSE.md under the same CC BY 4.0 grant, sit behind the guide's Who Does What section and the original-language search's role: filter: per-verse verb frames naming each annotated verb's agent, patient, recipient, and experiencer arguments with their surface text and base Strong's ids, and per-verse referent rows resolving pronouns to their antecedent words, stored per-book under data/frames and built by scripts/build-frames.mjs. The MARBLE word-sense attributes the same files carry (@ln, @domain) are UBS data stated as used with permission, with no downstream grant, so they are excluded; semantic domains ship from the UBS open-license dictionaries instead (rights id ubs-dictionaries). The repository's LICENSE.md is kept as the license evidence; the raw XML is kept out of git; provenance in data/_sources/macula-greek/PROVENANCE.md.",
    status: "shipped",
  },
  {
    id: "ubs-dictionaries",
    title: "UBS Dictionary of the Greek New Testament and UBS Dictionary of Biblical Hebrew (semantic domains)",
    kind: "lexicon",
    rightsHolder: "United Bible Societies",
    license: "CC BY-SA 4.0",
    source:
      "https://github.com/ubsicap/ubs-open-license (dictionaries/greek/JSON/UBSGreekNTDic-v1.1-en.JSON v1.1; dictionaries/hebrew/JSON/UBSHebrewDic-v0.9.2-en.JSON v0.9.2)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Attribution: UBS Dictionary of the Greek New Testament and UBS Dictionary of Biblical Hebrew, © United Bible Societies 2023 (CC BY-SA 4.0), available at https://github.com/ubsicap/ubs-open-license. The Greek dictionary adapts Louw and Nida's Greek-English Lexicon of the New Testament Based on Semantic Domains and carries each lemma's Louw-Nida entry codes, domain and subdomain names, definitions, glosses, and attestation counts; the Hebrew dictionary carries the SDBH domain taxonomy, a different system, named as SDBH wherever presented. The lemma-keyed aggregates ship as data/domains/greek.json and hebrew.json behind the Word Study guide's Semantic Domains section, built by scripts/build-domains.mjs; as ShareAlike adaptations the aggregates carry the same CC BY-SA 4.0 license and attribution. Strong's id collisions resolve against the shipped Strong's lexicons by lemma skeleton, recorded in data/domains/_meta.json. Chosen over the same assignments carried in the MACULA trees as MARBLE attributes, which state only used with permission and grant no downstream license. The repository's dictionaries LICENSE.md is kept as the license evidence; the raw JSON is kept out of git; provenance in data/_sources/ubs-dictionaries/PROVENANCE.md.",
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
    id: "web-redletter",
    title: "Words-of-Christ verse flags (from the World English Bible USFM)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain (trademark on the name held by eBible.org)",
    source: "https://ebible.org/Scriptures/eng-web_usfm.zip (details: https://ebible.org/find/details.php?id=eng-web)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Dominical verse flags extracted from the World English Bible USFM \\wj spans, the 2020 stable text edition, dedicated to the public domain per its copr page. Only the flags ship, not another copy of the WEB text: per-chapter verse lists stored per-book as JSON under data/redletter, worn by every furnished translation since the flags anchor by canon reference. The granularity is the verse because span offsets belong to the WEB wording; 2,059 verses flagged across Matthew, Mark, Luke, John, Acts, 1 and 2 Corinthians, 1 Timothy, and Revelation (the source's full markup coverage). Raw USFM kept out of git; provenance in data/_sources/web-usfm/PROVENANCE.md; built by scripts/build-redletter.mjs.",
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
    id: "wesley",
    title: "John Wesley, Explanatory Notes on the Bible",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public Domain (module .conf)",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Wesley.zip (CrossWire SWORD module 1.1)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Whole-Bible notes (New Testament 1755, Old Testament 1765), stored per-book as JSON under data/commentary/wesley. The source module lacks 1 Kings and Philemon entirely and carries production damage: Judges and Jonah are flooded by neighboring notes and are dropped at build time, and multi-verse notes flooded across lost text are kept only at their first verse when the catch-phrase verifies against the KJV text (10 unverifiable runs dropped; counts in the build output). Raw module kept out of git; provenance in data/_sources/wesley/PROVENANCE.md; normalized by scripts/build-commentary-wesley.mjs.",
    status: "shipped",
  },
  {
    id: "tdavid",
    title: "C. H. Spurgeon, The Treasury of David",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public Domain (module .conf; seven volumes 1865-1885)",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/TDavid.zip (CrossWire SWORD module 2.1, text via archive.spurgeon.org/treasury/)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Spurgeon's commentary on the Psalms: overview, title, and division per psalm, verse-by-verse exposition, explanatory notes and quaint sayings gathered from older divines, and hints to the village preacher. Stored as data/commentary/tdavid/Psalms.json. The per-psalm WORKS UPON bibliographies are apparatus and are omitted (29 parts); Psalm 119's first-verse exposition is absent from the source. Raw module kept out of git; provenance in data/_sources/tdavid/PROVENANCE.md; normalized by scripts/build-commentary-tdavid.mjs.",
    status: "shipped",
  },
  {
    id: "scofield",
    title: "C. I. Scofield, Scofield Reference Notes (1917 edition)",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public Domain (module .conf; the 1917 edition)",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Scofield.zip (CrossWire SWORD module 2.1, text via Wikisource)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The 1917 Scofield Reference Bible notes across the whole Bible, with book introductions shipped as intro sections; verses without a note simply do not appear. Stored per-book as JSON under data/commentary/scofield. Raw module kept out of git; provenance in data/_sources/scofield/PROVENANCE.md; normalized by scripts/build-commentary-scofield.mjs.",
    status: "shipped",
  },
  {
    id: "catena",
    title: "Thomas Aquinas, Catena Aurea (John Henry Newman's English translation)",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public Domain (module .conf; Newman's translation 1841-1845)",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Catena.zip (CrossWire SWORD module 1.0.1, text via github.com/lemtom/catena)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Aquinas's golden chain of patristic comments on the four Gospels in Newman's English translation, stored per-book as JSON under data/commentary/catena. Gospels only: 821 entries keyed by the module's own lemma headers (ranges included), patristic attributions intact, Newman's 266 editorial footnotes moved to section ends; 3,708 of 3,779 Gospel verses covered, uncovered verses simply do not appear. Raw module kept out of git; provenance in data/_sources/catena/PROVENANCE.md; normalized by scripts/build-commentary-catena.mjs.",
    status: "shipped",
  },
  {
    id: "pnt",
    title: "B. W. Johnson, The People's New Testament",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public Domain (module .conf; two volumes 1889-1891)",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/PNT.zip (CrossWire SWORD module 1.1)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Johnson's explanatory notes on the New Testament, stored per-book as JSON under data/commentary/pnt. Chapter headings and summaries ship as intro sections (258 chapters). Production artifacts repaired and documented: 16 spurious introduction-slot duplicates of previous-book notes dropped, 10 records running past their verse split at their embedded markers with 12 duplicated slots dropped, the Matthew 8/9 summary swap undone, and Matthew 8:1's note recorded as absent from the module. Philemon has no content in the module, so no Philemon volume ships. Raw module kept out of git; provenance in data/_sources/pnt/PROVENANCE.md; normalized by scripts/build-commentary-pnt.mjs.",
    status: "shipped",
  },
  {
    id: "burkitt",
    title: "William Burkitt, Expository Notes on the New Testament",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public Domain (module .conf; Gospels 1700, Acts to Revelation 1703)",
    source: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Burkitt.zip (CrossWire SWORD module 1.0)",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "Burkitt's verse-by-verse expository notes with practical observations on the New Testament, stored per-book as JSON under data/commentary/burkitt. Verses he passes over simply do not appear (3,276 notes); one duplicated span note (Hebrews 9:9-10) merges into a range section. Raw module kept out of git; provenance in data/_sources/burkitt/PROVENANCE.md; normalized by scripts/build-commentary-burkitt.mjs.",
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
      "Confessional shelf priority. Registered as planned; the text ships only once a verified, openly licensed digitization is vendored. Rechecked 2026-07-23: the Internet Sacred Text Archive transcription is served behind a bot wall and carries a non-commercial reuse condition, e-Sword module conversions are unlicensed, and no CCEL, CrossWire, or Project Gutenberg edition exists. Still no shippable digitization.",
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
    notes:
      "Confessional shelf priority. Registered as planned until a verified digitization is vendored. Rechecked 2026-07-23: the only machine-readable transcriptions are BibleHub's and StudyLight's copyrighted digitizations; archive.org holds the 1840 edition in scan OCR with dense Latin and Greek marginalia. Still no shippable digitization.",
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
    notes:
      "Registered as planned until a verified digitization is vendored. Rechecked 2026-07-23: BibleHub and StudyLight carry copyrighted digitizations; archive.org holds scans only. No CCEL or CrossWire edition exists.",
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
    notes:
      "Registered as planned until a verified digitization is vendored. Rechecked 2026-07-23: StudyLight's transcription is a copyrighted digitization; archive.org holds scans only. No CCEL or CrossWire edition exists.",
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
    notes:
      "Registered as planned until a verified digitization of the notes is vendored. Rechecked 2026-07-23: the CrossWire \"Geneva\" zCom module (Geneva Bible Translation Notes) carries no DistributionLicense or TextSource in its .conf, and its modernized-spelling text matches the Tolle Lege Press 1599 edition (copyright 2006-2007 per Bible Gateway's version information), so the module fails the rights-first bar. The 1560/1599 notes themselves are public domain, but no verified clean digitization was found.",
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
    id: "apostles-creed",
    title: "The Apostles' Creed (received form)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source:
      "Philip Schaff, The Creeds of Christendom, vol. II (1877), via CCEL: https://www.ccel.org/ccel/schaff/creeds2/cache/creeds2.txt",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The baptismal creed of the Western church in its received form, transcribed from Schaff's received text with his editorial brackets removed (data/_sources/confessions/schaff-creeds2.txt, lines 3084-3096; see PROVENANCE.md). Ships in the workspace's confessions reader. The creed carries no received proof-text apparatus, so its sections hold no proof list.",
    status: "shipped",
  },
  {
    id: "nicene-creed",
    title: "The Nicene Creed (325/381)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source:
      "Philip Schaff, The Creeds of Christendom, vol. II (1877), via CCEL: https://www.ccel.org/ccel/schaff/creeds2/cache/creeds2.txt",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The creed of Nicaea as received at Constantinople in 381, transcribed from Schaff (his Epiphanius formula agrees with the 381 text word for word except three retained 325 clauses, which are removed; the 325 form and anathema ride as back matter). The Western filioque is a later addition and does not appear. Ships in the confessions reader without a proof apparatus, the received form carrying none.",
    status: "shipped",
  },
  {
    id: "chalcedon-definition",
    title: "The Definition of Chalcedon (451)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source:
      "Philip Schaff, The Creeds of Christendom, vol. II (1877), via CCEL: https://www.ccel.org/ccel/schaff/creeds2/cache/creeds2.txt",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The fourth ecumenical council's definition of the one Christ in two natures, transcribed from Schaff's English text (vendored lines 4044-4061) with his bracketed alternatives removed. Ships in the confessions reader; like the other ecumenical creeds it carries no received proof-text apparatus.",
    status: "shipped",
  },
  {
    id: "westminster-shorter",
    title: "The Westminster Shorter Catechism (1647) with the Assembly's proof texts",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "Reformed Standards digitization: https://reformedstandards.com/westminster/wsc.html",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The Assembly's catechism of 1647 with the proof texts printed by order of the House of Commons (1648), all 107 questions with their lettered proofs parsed and validated against the canon (447 references; question 8 carries no proofs in this edition). Ships in the confessions reader, the Passage Guide's Confessional Documents section, and the Topic Guide's confessional join. Vendored source at data/_sources/confessions/wsc.html (see PROVENANCE.md); built by scripts/build-confessions.mjs into data/confessions/wsc.json. The Heidelberg and Keach's remain planned for the catechesis track.",
    status: "shipped",
  },
  {
    id: "lbc-1689",
    title: "The 1689 London Baptist Confession of Faith with scripture proofs",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "Christian Classics Ethereal Library plain text: https://www.ccel.org/ccel/a/anonymous/bcf/cache/bcf.txt",
    sourceRetrieved: "2026-07-23",
    allowedUses: ["presentation", "search", "quotation", "export", "ai-indexing", "offline"],
    notes:
      "The Second London Confession (composed 1677, adopted 1689): the epistle to the reader, thirty-two chapters with 495 numbered proofs (1,272 references parsed and validated against the canon), the appendix, and the subscription statement, from CCEL's public-domain digitization. CCEL's modern BCF Assistant editorial material (M. T. Smith 1994-1999, with Waldron, Nichols, and Renihan content) is copyrighted and excluded; the mangled subscriber name table is omitted and recorded. Two proofs print verses the canon lacks (Acts 12:29-30, Luke 13:36, documented errors in the original printing): their display strings stay as printed, the verses sit out of the index, and data/confessions/_meta.json records them. Vendored source at data/_sources/confessions/bcf.txt (see PROVENANCE.md); built by scripts/build-confessions.mjs. Ships in the confessions reader, the Passage Guide's Confessional Documents section, and the Topic Guide's confessional join.",
    status: "shipped",
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
