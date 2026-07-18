import { promises as fs } from "fs";
import path from "path";

export interface Translation {
  id: string;
  name: string;
  abbrev: string;
  year: string;
  /** Directory under data/ holding per-book JSON files. */
  dir: string;
  license: string;
  /** True when the text covers only the Old Testament (e.g. the LXX). */
  otOnly?: boolean;
  /** File probed to decide whether the data directory is furnished. */
  probe?: string;
}

/**
 * The translation shelf. Every entry is public domain or freely
 * redistributable; provenance is recorded in the rights registry.
 */
export const TRANSLATIONS: Translation[] = [
  { id: "kjv", name: "King James Version", abbrev: "KJV", year: "1611/1769", dir: "kjv", license: "Public domain" },
  { id: "asv", name: "American Standard Version", abbrev: "ASV", year: "1901", dir: "translations/asv", license: "Public domain" },
  { id: "web", name: "World English Bible", abbrev: "WEB", year: "2000", dir: "translations/web", license: "Public domain" },
  { id: "ylt", name: "Young's Literal Translation", abbrev: "YLT", year: "1898", dir: "translations/ylt", license: "Public domain" },
  { id: "bbe", name: "Bible in Basic English", abbrev: "BBE", year: "1949", dir: "translations/bbe", license: "Public domain" },
  { id: "darby", name: "Darby Translation", abbrev: "DARBY", year: "1890", dir: "translations/darby", license: "Public domain" },
  { id: "brenton", name: "Brenton English Septuagint", abbrev: "BRENTON", year: "1851", dir: "translations/brenton", license: "Public domain", otOnly: true, probe: "Genesis.json" },
  { id: "lxx", name: "Greek Septuagint (Brenton text)", abbrev: "LXX", year: "1851", dir: "lxx", license: "Public domain", otOnly: true, probe: "Genesis.json" },
];

export const DEFAULT_TRANSLATION = "kjv";

export function getTranslation(id: string): Translation | undefined {
  return TRANSLATIONS.find((t) => t.id === id);
}

let availableCache: Translation[] | null = null;

/** Translations whose data directory is actually furnished on disk. */
export async function getAvailableTranslations(): Promise<Translation[]> {
  if (availableCache) return availableCache;
  const out: Translation[] = [];
  for (const t of TRANSLATIONS) {
    try {
      await fs.access(path.join(process.cwd(), "data", t.dir, t.probe ?? "John.json"));
      out.push(t);
    } catch {
      // not furnished — omit from the shelf
    }
  }
  availableCache = out;
  return out;
}

/** The translations offered on a given book: OT-only texts hide in the NT. */
export function translationsForBook(
  available: Translation[],
  testament: "OT" | "NT"
): Translation[] {
  return available.filter((t) => testament === "OT" || !t.otOnly);
}
