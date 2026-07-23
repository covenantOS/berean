import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { LexiconEntry } from "@/lib/lexicon";

interface Row {
  id: string;
  lemma?: string;
  xlit?: string;
  kjv_def?: string;
}

/**
 * Whole-dictionary search: ids, lemmas, transliterations (Strong's own and
 * the Tyndale variants'), pronunciations, and definitions across both
 * Strong's dictionaries, capped at sixty rows per dictionary. Matching
 * folds diacritics, points, and punctuation (word boundaries kept), so
 * "agape" finds "agapē", "chesed" finds the Tyndale "che.sed", and
 * unpointed letters find the pointed lemma. This is the retired /lexicon
 * index's query moved behind a route so the workspace's lexicon surface
 * can ask for it.
 */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-֑ͯ-ׇ]/g, "")
    .toLowerCase()
    .replace(/[^a-zα-ωא-ת\s]/g, "")
    .replace(/\s+/g, " ");

export async function GET(req: Request) {
  const needle = fold((new URL(req.url).searchParams.get("q") ?? "").trim());
  if (!needle) return NextResponse.json({ available: true, results: [] });
  const results: Row[] = [];
  let available = false;
  for (const which of ["hebrew", "greek"] as const) {
    try {
      const file = path.join(process.cwd(), "data", "lexicon", `strongs-${which}.json`);
      const dict = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, LexiconEntry>;
      available = true;
      let count = 0;
      for (const [id, entry] of Object.entries(dict)) {
        if (
          fold(id).includes(needle) ||
          fold(entry.lemma ?? "").includes(needle) ||
          fold(entry.xlit ?? "").includes(needle) ||
          fold(entry.pron ?? "").includes(needle) ||
          fold(entry.kjv_def ?? "").includes(needle) ||
          fold(entry.strongs_def ?? "").includes(needle) ||
          entry.tyndale?.some(
            (v) =>
              fold(v.xlit).includes(needle) ||
              fold(v.gloss).includes(needle) ||
              fold(v.def).includes(needle)
          )
        ) {
          results.push({ id, lemma: entry.lemma, xlit: entry.xlit, kjv_def: entry.kjv_def });
          if (++count >= 60) break;
        }
      }
    } catch {
      /* dictionary not furnished */
    }
  }
  return NextResponse.json({ available, results });
}
