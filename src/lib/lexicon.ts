import { promises as fs } from "fs";
import path from "path";

/** One extended (disambiguated) Strong's variant from TBESH/TBESG. */
export interface TyndaleVariant {
  /** Extended Strong's id (H7225G) or padded base id (G0025). */
  id: string;
  /** Unified Strong's id linking related variants. */
  u: string;
  lemma: string;
  xlit: string;
  /** Part-of-speech tag as tagged in the Tyndale House texts. */
  pos: string;
  /** Tyndale scholars' gloss. */
  gloss: string;
  /** Brief definition, source markup flattened to plain text. */
  def: string;
  /** Relation the extended id bears to its unified id, when stated. */
  rel?: string;
}

export interface LexiconEntry {
  lemma?: string;
  xlit?: string;
  pron?: string;
  derivation?: string;
  strongs_def?: string;
  kjv_def?: string;
  tyndale?: TyndaleVariant[];
}

type Dictionary = Record<string, LexiconEntry>;

const dicts = new Map<string, Promise<Dictionary | null>>();

async function loadDict(which: "hebrew" | "greek"): Promise<Dictionary | null> {
  const hit = dicts.get(which);
  if (hit !== undefined) return hit;
  // The in-flight promise is cached: concurrent lookups share the one read.
  const job = (async (): Promise<Dictionary | null> => {
    try {
      const file = path.join(process.cwd(), "data", "lexicon", `strongs-${which}.json`);
      return JSON.parse(await fs.readFile(file, "utf8")) as Dictionary;
    } catch {
      return null;
    }
  })();
  dicts.set(which, job);
  return job;
}

/**
 * Normalize a Strong's ref like "g26", "G0026", "H1", or an extended id
 * like "H7225G" → "G26" / "H1" (extended ids resolve to their base entry).
 */
export function normalizeStrongs(id: string): string | null {
  const m = id.trim().toUpperCase().match(/^([GH])0*(\d+)[A-Z]?$/);
  if (!m) return null;
  return `${m[1]}${m[2]}`;
}

export async function getLexiconEntry(id: string): Promise<{ id: string; entry: LexiconEntry } | null> {
  const norm = normalizeStrongs(id);
  if (!norm) return null;
  const dict = await loadDict(norm.startsWith("H") ? "hebrew" : "greek");
  if (!dict) return null;
  const entry = dict[norm];
  if (!entry) return null;
  return { id: norm, entry };
}

/** True when at least one Strong's dictionary is furnished on disk. */
export async function lexiconAvailable(): Promise<boolean> {
  return (await loadDict("greek")) !== null || (await loadDict("hebrew")) !== null;
}
