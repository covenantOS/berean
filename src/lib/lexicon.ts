import { promises as fs } from "fs";
import path from "path";

export interface LexiconEntry {
  lemma?: string;
  xlit?: string;
  pron?: string;
  derivation?: string;
  strongs_def?: string;
  kjv_def?: string;
}

type Dictionary = Record<string, LexiconEntry>;

const dicts = new Map<string, Dictionary | null>();

async function loadDict(which: "hebrew" | "greek"): Promise<Dictionary | null> {
  const hit = dicts.get(which);
  if (hit !== undefined) return hit;
  try {
    const file = path.join(process.cwd(), "data", "lexicon", `strongs-${which}.json`);
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as Dictionary;
    dicts.set(which, raw);
    return raw;
  } catch {
    dicts.set(which, null);
    return null;
  }
}

/** Normalize a Strong's ref like "g26", "G0026", "H1" → "G26" / "H1". */
export function normalizeStrongs(id: string): string | null {
  const m = id.trim().toUpperCase().match(/^([GH])0*(\d+)$/);
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
