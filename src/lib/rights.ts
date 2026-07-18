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
    allowedUses: [],
    notes: "Planned second public-domain translation.",
    status: "planned",
  },
  {
    id: "matthew-henry",
    title: "Matthew Henry, Commentary on the Whole Bible",
    kind: "commentary",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be digitized from a verified public-domain edition",
    sourceRetrieved: "—",
    allowedUses: [],
    notes:
      "First public-domain commentary planned for the shelf. Not shipped until the text is sourced from a verified edition — Berean does not present commentary text it cannot trace to a source.",
    status: "planned",
  },
  {
    id: "strongs",
    title: "Strong's Exhaustive Concordance (lexical numbers and glosses)",
    kind: "dataset",
    rightsHolder: "Public domain",
    license: "Public domain",
    source: "To be sourced from a verified public-domain dataset",
    sourceRetrieved: "—",
    allowedUses: [],
    notes:
      "Foundation for the original-language apparatus. Original-language depth ships only to the extent supported by verified datasets.",
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
