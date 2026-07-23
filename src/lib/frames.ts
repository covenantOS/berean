import { promises as fs } from "fs";
import path from "path";
import { getBook } from "./canon";

/**
 * The semantic frames and participant referents behind the Exegetical
 * Guide's Who Does What section and the original-language search's role
 * filter: per chapter and verse, the Clear annotations of the MACULA
 * lowfat files (Clear Bible / Biblica, CC BY 4.0; rights ids `macula-greek`
 * and `macula-hebrew`), built by scripts/build-frames.mjs.
 *
 * A frame is verb-centered: the annotated verb with its semantic
 * arguments, each labeled agent (the doer), patient (the one affected),
 * recipient, causer (Hebrew causative stems), or experiencer (Greek
 * impersonal verbs), and resolved to the participant's head word with its
 * gloss and base Strong's id. An argument the source leaves unexpressed
 * carries `implied`. A referent row resolves a mention (a pronoun, a
 * Hebrew pronominal suffix) to its antecedent words, answering who "he"
 * or "it" is here. Verses follow the shipped TAHOT/TAGNT English
 * numbering; the Hebrew-numbered WLC refs were mapped through the TAHOT
 * alt table at build time.
 */

export interface FrameArg {
  /** The semantic role: agent, patient, recipient, causer, experiencer. */
  role: string;
  /** The participant's head word; absent when the argument is implied. */
  text?: string;
  gloss?: string;
  /** Padded base Strong's id ("G0846", "H0430"); absent for implied
   *  arguments and Hebrew private prefix/suffix numbers. */
  strongs?: string;
  /** The participant's chapter and verse when it sits outside the
   *  frame's own location (c only when the chapter differs). */
  c?: number;
  v?: number;
  /** The source leaves the argument unexpressed (an all-zeros target, an
   *  empty target list, or a null node the lowfat stream drops). */
  implied?: boolean;
}

export interface VerbFrame {
  verb: string;
  gloss?: string;
  strongs?: string;
  args: FrameArg[];
}

export interface ReferentTarget {
  text?: string;
  gloss?: string;
  strongs?: string;
  c?: number;
  v?: number;
}

export interface ReferentRow {
  word: string;
  gloss?: string;
  strongs?: string;
  /** The antecedent words the mention refers to. */
  of: ReferentTarget[];
}

export interface VerseRoles {
  frames: VerbFrame[];
  referents: ReferentRow[];
}

interface RawFramesBook {
  book: string;
  chapters: {
    chapter: string;
    verses: { verse: string; frames?: VerbFrame[]; referents?: ReferentRow[] }[];
  }[];
}

const cache = new Map<string, Promise<RawFramesBook | null>>();

async function loadBook(file: string): Promise<RawFramesBook | null> {
  let hit = cache.get(file);
  if (!hit) {
    hit = (async () => {
      try {
        const target = path.join(process.cwd(), "data", "frames", `${file}.json`);
        return JSON.parse(await fs.readFile(target, "utf8")) as RawFramesBook;
      } catch {
        return null;
      }
    })();
    cache.set(file, hit);
  }
  return hit;
}

/**
 * One chapter's frames and referents: verse number to the verse's verb
 * frames and referent rows, in source order. Null when the book is not
 * furnished, so the guide drops the section rather than stubbing it.
 */
export async function getFrames(
  slug: string,
  chapter: number
): Promise<Record<number, VerseRoles> | null> {
  const book = getBook(slug);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  const raw = await loadBook(book.file);
  if (!raw) return null;
  const ch = raw.chapters.find((c) => Number(c.chapter) === chapter);
  if (!ch) return null;
  const out: Record<number, VerseRoles> = {};
  for (const v of ch.verses) {
    out[Number(v.verse)] = { frames: v.frames ?? [], referents: v.referents ?? [] };
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * The search side of the frames: for one book, a map of "chapter.verse"
 * to the Strong's ids carrying each semantic role THERE, anchored at the
 * participant's own verse (a verb in verse 11 whose agent is expressed in
 * verse 9 indexes the agent's Strong's id under 1.9). The role filter in
 * morphsearch joins a matched word's base Strong's id against this map.
 */
export type RoleIndex = Map<string, Map<string, Set<string>>>;

const roleIndexes = new Map<string, Promise<RoleIndex | null>>();

export async function getRoleIndex(file: string): Promise<RoleIndex | null> {
  let hit = roleIndexes.get(file);
  if (!hit) {
    hit = (async () => {
      const raw = await loadBook(file);
      if (!raw) return null;
      const index: RoleIndex = new Map();
      for (const ch of raw.chapters) {
        const chapter = Number(ch.chapter);
        for (const v of ch.verses) {
          const verse = Number(v.verse);
          for (const f of v.frames ?? []) {
            for (const a of f.args) {
              if (a.implied || !a.strongs) continue;
              const key = `${a.c ?? chapter}.${a.v ?? verse}`;
              if (!index.has(key)) index.set(key, new Map());
              const atVerse = index.get(key)!;
              if (!atVerse.has(a.strongs)) atVerse.set(a.strongs, new Set());
              atVerse.get(a.strongs)!.add(a.role);
            }
          }
        }
      }
      return index;
    })();
    roleIndexes.set(file, hit);
  }
  return hit;
}
