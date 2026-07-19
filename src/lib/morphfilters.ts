/**
 * The morphology filter vocabulary, shared between the server engine
 * (src/lib/morphsearch.ts) and client surfaces (the /search page's original
 * mode and the workspace search pane). This module is client-safe: no data
 * files load here, only the option lists the filter selects offer.
 */

export interface MorphFilters {
  // Greek (Robinson)
  gpos?: string;
  gtense?: string;
  gvoice?: string;
  gmood?: string;
  gcase?: string;
  gperson?: string;
  gnumber?: string;
  ggender?: string;
  // Hebrew (ETCBC)
  hpos?: string;
  hstem?: string;
  haspect?: string;
  hstate?: string;
  hperson?: string;
  hnumber?: string;
  hgender?: string;
}

/** Every key a morph query accepts; the API route reads these off the URL. */
export const MORPH_FILTER_KEYS = [
  "gpos", "gtense", "gvoice", "gmood", "gcase", "gperson", "gnumber", "ggender",
  "hpos", "hstem", "haspect", "hstate", "hperson", "hnumber", "hgender",
] as const;

export interface FilterDef {
  key: keyof MorphFilters;
  label: string;
  options: string[];
}

export const GREEK_FILTER_DEFS: FilterDef[] = [
  { key: "gpos", label: "Part of speech", options: ["verb", "noun", "adjective", "definite article", "personal pronoun", "relative pronoun", "demonstrative pronoun", "reflexive pronoun", "possessive pronoun", "interrogative/indefinite pronoun", "indefinite pronoun", "correlative pronoun", "adverb", "conjunction", "preposition", "particle", "interjection", "numeral"] },
  { key: "gtense", label: "Tense", options: ["present", "imperfect", "future", "aorist", "perfect", "pluperfect", "2nd aorist", "2nd future", "2nd perfect"] },
  { key: "gvoice", label: "Voice", options: ["active", "middle", "passive", "middle/passive"] },
  { key: "gmood", label: "Mood", options: ["indicative", "subjunctive", "optative", "imperative", "infinitive", "participle"] },
  { key: "gcase", label: "Case", options: ["nominative", "genitive", "dative", "accusative", "vocative"] },
  { key: "gperson", label: "Person", options: ["1st person", "2nd person", "3rd person"] },
  { key: "gnumber", label: "Number", options: ["singular", "plural"] },
  { key: "ggender", label: "Gender", options: ["masculine", "feminine", "neuter"] },
];

export const HEBREW_FILTER_DEFS: FilterDef[] = [
  { key: "hpos", label: "Part of speech", options: ["verb", "noun", "proper noun", "adjective", "pronoun", "conjunction", "preposition", "adverb", "particle", "definite article", "object marker", "relative", "interjection", "interrogative", "negative"] },
  { key: "hstem", label: "Stem", options: ["qal", "niphal", "piel", "pual", "hiphil", "hophal", "hithpael", "peil", "ithpeel", "ithpaal", "aphel", "shaphel", "polel"] },
  { key: "haspect", label: "Aspect", options: ["perfect", "imperfect", "consecutive imperfect", "consecutive perfect", "imperative", "jussive", "cohortative", "infinitive construct", "infinitive absolute", "participle", "passive participle"] },
  { key: "hstate", label: "State", options: ["absolute", "construct", "determined"] },
  { key: "hperson", label: "Person", options: ["1st person", "2nd person", "3rd person"] },
  { key: "hnumber", label: "Number", options: ["singular", "plural", "dual"] },
  { key: "hgender", label: "Gender", options: ["masculine", "feminine", "common"] },
];
