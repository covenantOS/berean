import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";

/** One ordered token of tagged text: a word/phrase with its Strong's numbers. */
export interface TaggedWord {
  t: string;
  s?: string[];
}

export interface TaggedVerse {
  verse: number;
  words: TaggedWord[];
}

interface RawTaggedBook {
  book: string;
  chapters: { chapter: string; verses: { verse: string; words: TaggedWord[] }[] }[];
}

const cache = new Map<string, RawTaggedBook | null>();

async function loadTaggedBook(book: Book): Promise<RawTaggedBook | null> {
  const hit = cache.get(book.file);
  if (hit !== undefined) return hit;
  try {
    const file = path.join(process.cwd(), "data", "kjv-strongs", `${book.file}.json`);
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawTaggedBook;
    cache.set(book.file, raw);
    return raw;
  } catch {
    cache.set(book.file, null);
    return null;
  }
}

/** Strong's-tagged KJV chapter, or null when the apparatus is not furnished. */
export async function getTaggedChapter(slug: string, chapter: number): Promise<TaggedVerse[] | null> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  const raw = await loadTaggedBook(book);
  if (!raw) return null;
  const ch = raw.chapters[chapter - 1];
  if (!ch) return null;
  return ch.verses.map((v) => ({ verse: Number(v.verse), words: v.words }));
}

export interface StrongsOccurrence {
  book: Book;
  chapter: number;
  verse: number;
  text: string;
}

/**
 * Function words carry the highest Strong's frequencies in any chapter and
 * would crowd out the words worth studying. A small stoplist: the article,
 * common pronouns, the copula, high-frequency conjunctions, prepositions,
 * and speech verbs. The guides skip these when ranking significant words.
 */
export const STOP_STRONGS = new Set([
  // Greek
  "G3588", // the
  "G2532", // and
  "G1161", // but, and
  "G846", // he, him, they
  "G1473", // I
  "G4771", // thou, you
  "G1510", // to be
  "G2258", // was
  "G1722", // in
  "G3756", // not
  "G3754", // that
  "G1063", // for
  "G3778", // this
  "G2036", // said
  "G3004", // say
  // Hebrew
  "H853", // eth (object marker)
  "H834", // which, that
  "H3588", // ki (for, that)
  "H413", // el (to)
  "H5921", // al (upon)
  "H4480", // min (from)
]);

/** Every canon occurrence of a Strong's number, from the tagged KJV. */
export async function findOccurrences(
  strongs: string,
  limit = 500
): Promise<{ occurrences: StrongsOccurrence[]; total: number; byBook: { book: Book; count: number }[] }> {
  const { CANON } = await import("./canon");
  const occurrences: StrongsOccurrence[] = [];
  const byBook: { book: Book; count: number }[] = [];
  let total = 0;
  for (const book of CANON) {
    const raw = await loadTaggedBook(book);
    if (!raw) continue;
    let count = 0;
    for (const ch of raw.chapters) {
      for (const v of ch.verses) {
        if (v.words.some((w) => w.s?.includes(strongs))) {
          total++;
          count++;
          if (occurrences.length < limit) {
            occurrences.push({
              book,
              chapter: Number(ch.chapter),
              verse: Number(v.verse),
              text: v.words.map((w) => w.t).join(" ").replace(/\s+([.,;:!?])/g, "$1"),
            });
          }
        }
      }
    }
    if (count > 0) byBook.push({ book, count });
  }
  return { occurrences, total, byBook };
}

export interface KjvRendering {
  /** The English rendering, lowercased and stripped of punctuation. */
  word: string;
  count: number;
}

/**
 * Every distinct English rendering of a Strong's number in the tagged KJV,
 * ranked by count. Where findOccurrences counts verses, this counts tokens:
 * a verse carrying the lemma twice contributes two. Token text is normalized
 * (lowercased, punctuation stripped) so "Love," and "love" fold together.
 */
export async function countRenderings(strongs: string): Promise<KjvRendering[]> {
  const { CANON } = await import("./canon");
  const counts = new Map<string, number>();
  for (const book of CANON) {
    const raw = await loadTaggedBook(book);
    if (!raw) continue;
    for (const ch of raw.chapters) {
      for (const v of ch.verses) {
        for (const w of v.words) {
          if (!w.s?.includes(strongs)) continue;
          const word = w.t
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (!word) continue;
          counts.set(word, (counts.get(word) ?? 0) + 1);
        }
      }
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/* ------------------------------------------------------------------ */
/* Original-language apparatus: TAHOT (Hebrew OT) and TAGNT (Greek NT) */
/* ------------------------------------------------------------------ */

/**
 * One word of tagged original text, as built by scripts/build-step.mjs.
 * Keys stay short because there are ~450,000 of these on disk.
 */
export interface OriginalWord {
  /** Surface text (Hebrew or Greek). */
  t: string;
  /** Extended (disambiguated) Strong's numbers, prefixes then root. */
  s: string[];
  /** Morphology code: ETCBC/OpenScriptures for Hebrew, Robinson for Greek. */
  m: string;
  /** Text-type flag: L/Q/K/R/X (TAHOT) or N/K/O combinations (TAGNT). */
  type: string;
  /** Transliteration. */
  x?: string;
  /** Contextual English gloss. */
  g?: string;
  /** Lemma (dictionary form). */
  l?: string;
  /** Root Strong's number (TAHOT). */
  r?: string;
  /** Dictionary gloss (TAGNT, when distinct from the contextual gloss). */
  dg?: string;
  /** Editions containing this word (TAGNT): NA28, NA27, Tyn, SBL, WH, Treg, TR, Byz. */
  e?: string[];
}

export interface OriginalVerse {
  verse: number;
  words: OriginalWord[];
  /** Hebrew (TAHOT) or KJV/other-edition (TAGNT) chapter.verse when different. */
  alt?: string;
}

interface RawOriginalBook {
  book: string;
  chapters: { chapter: string; verses: { verse: string; alt?: string; words: OriginalWord[] }[] }[];
}

const originalCache = new Map<string, RawOriginalBook | null>();

export async function loadOriginalBook(book: Book, dir: "tahot" | "tagnt"): Promise<RawOriginalBook | null> {
  const key = `${dir}/${book.file}`;
  const hit = originalCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const file = path.join(process.cwd(), "data", dir, `${book.file}.json`);
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawOriginalBook;
    originalCache.set(key, raw);
    return raw;
  } catch {
    originalCache.set(key, null);
    return null;
  }
}

/**
 * Tagged original-language chapter: TAHOT for Old Testament books, TAGNT
 * for New Testament books, or null when the apparatus is not furnished.
 * Verse numbering follows the source (English numbering; Psalm titles are
 * verse 0, and `alt` records Hebrew or KJV numbering where it differs).
 */
export async function getOriginalChapter(slug: string, chapter: number): Promise<OriginalVerse[] | null> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  const raw = await loadOriginalBook(book, book.testament === "OT" ? "tahot" : "tagnt");
  if (!raw) return null;
  const ch = raw.chapters.find((c) => Number(c.chapter) === chapter);
  if (!ch) return null;
  return ch.verses.map((v) => ({ verse: Number(v.verse), alt: v.alt, words: v.words }));
}

/* ------------------------- morphology decoding ------------------------- */

const HEB_POS: Record<string, string> = {
  A: "adjective", C: "conjunction", D: "adverb", N: "noun", P: "pronoun",
  R: "preposition", S: "pronominal suffix", T: "particle", V: "verb",
};
const HEB_STEM: Record<string, string> = {
  q: "qal", N: "niphal", p: "piel", P: "pual", h: "hiphil", H: "hophal", t: "hithpael",
  // Aramaic stems
  l: "peil", u: "ithpeel", U: "ithpaal", a: "aphel", S: "shaphel", o: "polel",
};
const HEB_CONJ: Record<string, string> = {
  p: "perfect", i: "imperfect", w: "consecutive imperfect", u: "consecutive perfect",
  v: "imperative", j: "jussive", h: "cohortative",
  c: "infinitive construct", a: "infinitive absolute",
  r: "participle", s: "passive participle",
};
const HEB_GENDER: Record<string, string> = { c: "common", m: "masculine", f: "feminine", b: "common" };
const HEB_NUMBER: Record<string, string> = { s: "singular", p: "plural", d: "dual" };
const HEB_STATE: Record<string, string> = { a: "absolute", c: "construct", d: "determined" };
const HEB_PERSON: Record<string, string> = { "1": "1st person", "2": "2nd person", "3": "3rd person" };
const HEB_T_SUB: Record<string, string> = {
  d: "definite article", o: "object marker", r: "relative", j: "interjection",
  i: "interrogative", c: "conjunction", m: "demonstrative", n: "negative", a: "definite article (Aramaic)",
};

function hebPGN(rest: string): string[] {
  const out: string[] = [];
  if (HEB_PERSON[rest[0]]) out.push(HEB_PERSON[rest[0]]);
  if (HEB_GENDER[rest[1]]) out.push(HEB_GENDER[rest[1]]);
  if (HEB_NUMBER[rest[2]]) out.push(HEB_NUMBER[rest[2]]);
  return out;
}

/** Decode one ETCBC/OpenScriptures segment (without its H/A language prefix). */
function decodeHebrewSegment(seg: string): string {
  const pos = seg[0];
  const rest = seg.slice(1);
  switch (pos) {
    case "V": {
      const stem = HEB_STEM[rest[0]] ?? rest[0];
      const conj = HEB_CONJ[rest[1]] ?? rest[1];
      const parts = ["verb", stem, conj];
      if (rest[1] === "r" || rest[1] === "s") {
        // participle: gender, number, state
        if (HEB_GENDER[rest[2]]) parts.push(HEB_GENDER[rest[2]]);
        if (HEB_NUMBER[rest[3]]) parts.push(HEB_NUMBER[rest[3]]);
        if (HEB_STATE[rest[4]]) parts.push(HEB_STATE[rest[4]]);
      } else if (rest[1] !== "c" && rest[1] !== "a") {
        parts.push(...hebPGN(rest.slice(2)));
      }
      return parts.join(" ");
    }
    case "N":
    case "A": {
      // {c common | p proper | g gentilic | t ...} then gender, number, state
      const typeMap: Record<string, string> = { c: pos === "N" ? "common noun" : "adjective", p: "proper noun", g: "gentilic" };
      const out = [typeMap[rest[0]] ?? HEB_POS[pos]];
      if (HEB_GENDER[rest[1]]) out.push(HEB_GENDER[rest[1]]);
      if (HEB_NUMBER[rest[2]]) out.push(HEB_NUMBER[rest[2]]);
      if (HEB_STATE[rest[3]]) out.push(HEB_STATE[rest[3]]);
      return out.join(" ");
    }
    case "S":
    case "P": {
      const out = [HEB_POS[pos]];
      let i = 0;
      if (rest[0] === "p") i = 1; // personal/pronominal marker
      if (rest[i] === "d") return `${out[0]} demonstrative`;
      if (rest[i] === "h") return `${out[0]} interrogative`;
      if (rest[i] === "n") return `${out[0]} indefinite`;
      return [...out, ...hebPGN(rest.slice(i))].join(" ");
    }
    case "c":
      return "conjunction";
    case "T":
      return `${HEB_POS[pos]} ${HEB_T_SUB[rest[0]] ?? rest}`.trim();
    case "C":
    case "D":
    case "R":
      return HEB_POS[pos] + (rest ? ` ${rest}` : "");
    default:
      return seg;
  }
}

const GK_POS: Record<string, string> = {
  N: "noun", A: "adjective", T: "definite article", P: "personal pronoun",
  R: "relative pronoun", C: "reciprocal pronoun", D: "demonstrative pronoun",
  F: "reflexive pronoun", S: "possessive pronoun", I: "interrogative/indefinite pronoun",
  X: "indefinite pronoun", Q: "correlative/interrogative pronoun", K: "correlative pronoun",
  V: "verb",
};
const GK_STANDALONE: Record<string, string> = {
  ADV: "adverb", CONJ: "conjunction", PREP: "preposition", PRT: "particle",
  INJ: "interjection", ARAM: "Aramaic transliterated word", HEB: "Hebrew transliterated word",
  NUI: "numeral", COND: "conditional particle",
};
const GK_TENSE: Record<string, string> = {
  P: "present", I: "imperfect", F: "future", A: "aorist", X: "perfect", Y: "pluperfect",
  "2A": "2nd aorist", "2F": "2nd future", "2X": "2nd perfect", "2Y": "2nd pluperfect", "2P": "2nd present",
};
const GK_VOICE: Record<string, string> = {
  A: "active", M: "middle", P: "passive", E: "middle/passive", D: "middle deponent",
  O: "passive deponent", N: "middle/passive deponent",
};
const GK_MOOD: Record<string, string> = {
  I: "indicative", S: "subjunctive", O: "optative", M: "imperative", N: "infinitive", P: "participle",
};
const GK_CASE: Record<string, string> = { N: "nominative", G: "genitive", D: "dative", A: "accusative", V: "vocative" };
const GK_NUMBER: Record<string, string> = { S: "singular", P: "plural" };
const GK_GENDER: Record<string, string> = { M: "masculine", F: "feminine", N: "neuter" };

/** Decode one Robinson morphology code, e.g. "V-2AAI-3S" or "N-GSF". */
function decodeGreek(code: string): string {
  if (GK_STANDALONE[code]) return GK_STANDALONE[code];
  const segs = code.split("-");
  const pos = segs[0];
  const posName = GK_POS[pos];
  if (!posName) return code;
  if (pos === "V") {
    // V-{tense}{voice}{mood}[-{person}{number}] or participle V-{t}{v}P-{case}{number}{gender}
    const tv = segs[1] ?? "";
    const tenseKey = tv.startsWith("2") ? tv.slice(0, 2) : tv.slice(0, 1);
    const rest = tv.slice(tenseKey.length);
    const parts = ["verb", GK_TENSE[tenseKey] ?? tenseKey, GK_VOICE[rest[0]] ?? rest[0] ?? "", GK_MOOD[rest[1]] ?? rest[1] ?? ""];
    const tail = segs[2] ?? "";
    if (rest[1] === "P") {
      if (GK_CASE[tail[0]]) parts.push(GK_CASE[tail[0]]);
      if (GK_NUMBER[tail[1]]) parts.push(GK_NUMBER[tail[1]]);
      if (GK_GENDER[tail[2]]) parts.push(GK_GENDER[tail[2]]);
    } else if (rest[1] !== "N" && tail) {
      if (/^[123]/.test(tail[0])) parts.push(`${tail[0]}${tail[0] === "1" ? "st" : tail[0] === "2" ? "nd" : "rd"} person`);
      if (GK_NUMBER[tail[1]]) parts.push(GK_NUMBER[tail[1]]);
    }
    return parts.filter(Boolean).join(" ");
  }
  // Noun-like: X-{case}{number}{gender}; pronouns may lead with a person digit (P-1GS, F-2APM).
  const tail = segs[1] ?? "";
  const parts = [posName];
  let i = 0;
  if (/^[123]/.test(tail)) {
    parts.push(`${tail[0]}${tail[0] === "1" ? "st" : tail[0] === "2" ? "nd" : "rd"} person`);
    i = 1;
  }
  if (GK_CASE[tail[i]]) parts.push(GK_CASE[tail[i]]);
  if (GK_NUMBER[tail[i + 1]]) parts.push(GK_NUMBER[tail[i + 1]]);
  if (GK_GENDER[tail[i + 2]]) parts.push(GK_GENDER[tail[i + 2]]);
  return parts.join(" ");
}

/* ------------------- structured parsing (for search filters) ------------------- */

export interface GreekMorph {
  pos: string;
  tense?: string;
  voice?: string;
  mood?: string;
  case?: string;
  person?: string;
  number?: string;
  gender?: string;
}

/** Parse one Robinson code into fields, using the same labels as decodeGreek. */
export function parseRobinson(code: string): GreekMorph | null {
  if (!code) return null;
  if (GK_STANDALONE[code]) return { pos: GK_STANDALONE[code] };
  const segs = code.split("-");
  const pos = segs[0];
  const posName = GK_POS[pos];
  if (!posName) return null;
  if (pos === "V") {
    const tv = segs[1] ?? "";
    const tenseKey = tv.startsWith("2") ? tv.slice(0, 2) : tv.slice(0, 1);
    const rest = tv.slice(tenseKey.length);
    const out: GreekMorph = {
      pos: "verb",
      tense: GK_TENSE[tenseKey],
      voice: GK_VOICE[rest[0]],
      mood: GK_MOOD[rest[1]],
    };
    const tail = segs[2] ?? "";
    if (rest[1] === "P") {
      out.case = GK_CASE[tail[0]];
      out.number = GK_NUMBER[tail[1]];
      out.gender = GK_GENDER[tail[2]];
    } else if (rest[1] !== "N" && /^[123]/.test(tail[0] ?? "")) {
      out.person = `${tail[0]}${tail[0] === "1" ? "st" : tail[0] === "2" ? "nd" : "rd"} person`;
      out.number = GK_NUMBER[tail[1]];
    }
    return out;
  }
  const tail = segs[1] ?? "";
  const out: GreekMorph = { pos: posName };
  let i = 0;
  if (/^[123]/.test(tail)) {
    out.person = `${tail[0]}${tail[0] === "1" ? "st" : tail[0] === "2" ? "nd" : "rd"} person`;
    i = 1;
  }
  out.case = GK_CASE[tail[i]];
  out.number = GK_NUMBER[tail[i + 1]];
  out.gender = GK_GENDER[tail[i + 2]];
  return out;
}

export interface HebrewMorph {
  pos: string;
  stem?: string;
  /** Conjugation/aspect: perfect, imperfect, participle, and so on. */
  aspect?: string;
  person?: string;
  gender?: string;
  number?: string;
  state?: string;
}

function parseHebrewSegment(seg: string): HebrewMorph | null {
  const pos = seg[0];
  const rest = seg.slice(1);
  switch (pos) {
    case "V": {
      const out: HebrewMorph = {
        pos: "verb",
        stem: HEB_STEM[rest[0]],
        aspect: HEB_CONJ[rest[1]],
      };
      if (rest[1] === "r" || rest[1] === "s") {
        out.gender = HEB_GENDER[rest[2]];
        out.number = HEB_NUMBER[rest[3]];
        out.state = HEB_STATE[rest[4]];
      } else if (rest[1] !== "c" && rest[1] !== "a") {
        out.person = HEB_PERSON[rest[2]];
        out.gender = HEB_GENDER[rest[3]];
        out.number = HEB_NUMBER[rest[4]];
      }
      return out;
    }
    case "N":
      return {
        pos: rest[0] === "p" ? "proper noun" : "noun",
        gender: HEB_GENDER[rest[1]],
        number: HEB_NUMBER[rest[2]],
        state: HEB_STATE[rest[3]],
      };
    case "A":
      return {
        pos: "adjective",
        gender: HEB_GENDER[rest[1]],
        number: HEB_NUMBER[rest[2]],
        state: HEB_STATE[rest[3]],
      };
    case "S":
    case "P": {
      const out: HebrewMorph = { pos: HEB_POS[pos] };
      let i = 0;
      if (rest[0] === "p") i = 1;
      if (rest[i] === "d") return { pos: "demonstrative pronoun" };
      if (rest[i] === "h") return { pos: "interrogative pronoun" };
      if (rest[i] === "n") return { pos: "indefinite pronoun" };
      out.person = HEB_PERSON[rest[i]];
      out.gender = HEB_GENDER[rest[i + 1]];
      out.number = HEB_NUMBER[rest[i + 2]];
      return out;
    }
    case "c":
    case "C":
      return { pos: "conjunction" };
    case "T":
      return { pos: HEB_T_SUB[rest[0]] ?? "particle" };
    case "D":
      return { pos: "adverb" };
    case "R":
      return { pos: "preposition" };
    default:
      return null;
  }
}

/**
 * Parse one TAHOT morphology code into per-segment fields, one entry per
 * "/" word segment (prefix segments included), labels matching decodeMorph.
 */
export function parseHebrewMorph(code: string): HebrewMorph[] {
  if (!code) return [];
  return code
    .split("/")
    .map((seg) => parseHebrewSegment(seg.replace(/^[HA]/, "")))
    .filter((m): m is HebrewMorph => m !== null);
}

/**
 * Human-readable expansion of a morphology code. Hebrew codes (TAHOT) are
 * ETCBC/OpenScriptures-style with an H/A language prefix and "/"-separated
 * word segments; Greek codes (TAGNT) are Robinson-style. Unknown fragments
 * are passed through verbatim rather than guessed.
 */
export function decodeMorph(code: string, lang: "hebrew" | "greek"): string {
  if (!code) return "";
  if (lang === "greek") return decodeGreek(code);
  return code
    .split("/")
    .map((seg) => decodeHebrewSegment(seg.replace(/^[HA]/, "")))
    .join("; ");
}
