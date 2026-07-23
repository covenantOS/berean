import { promises as fs } from "fs";
import path from "path";

/**
 * The Hebrew-to-Greek Septuagint equivalent table behind the Word Study
 * guide's Septuagint Translation section: for each Hebrew Strong's id, the
 * Greek Strong's ids the LXX translators used for it, with counts from the
 * MACULA word-level alignment (Clear Bible / Biblica, CC BY 4.0; built by
 * scripts/build-lxx-strongs.mjs, rights id `macula-hebrew`). Both sides use
 * standard Strong's numbering, so no cross-system mapping is involved.
 */
type SeptuagintTable = Record<string, Record<string, number>>;

let cache: Promise<SeptuagintTable | null> | null = null;

async function loadTable(): Promise<SeptuagintTable | null> {
  if (!cache) {
    // The in-flight promise is cached: concurrent lookups share the one read.
    cache = (async () => {
      try {
        const file = path.join(process.cwd(), "data", "lxx-strongs", "hebrew-greek.json");
        return JSON.parse(await fs.readFile(file, "utf8")) as SeptuagintTable;
      } catch {
        return null;
      }
    })();
  }
  return cache;
}

/**
 * Greek equivalents for a Hebrew Strong's id (base form, e.g. "H7225"),
 * sorted by count desc then id asc. Null when the table is missing; an empty
 * list when the Hebrew id has no Strong's-numbered LXX equivalents.
 */
export async function getSeptuagintEquivalents(
  hebrewId: string
): Promise<{ greekId: string; count: number }[] | null> {
  const table = await loadTable();
  if (!table) return null;
  const inner = table[hebrewId];
  if (!inner) return [];
  return Object.entries(inner)
    .map(([greekId, count]) => ({ greekId, count }))
    .sort((a, b) => b.count - a.count || Number(a.greekId.slice(1)) - Number(b.greekId.slice(1)));
}
