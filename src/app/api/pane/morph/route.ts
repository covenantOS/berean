import { NextRequest, NextResponse } from "next/server";
import { MORPH_FILTER_KEYS, MorphFilters } from "@/lib/morphfilters";
import { searchOriginal } from "@/lib/morphsearch";
import { QueryError } from "@/lib/query";

/**
 * The original-language mode's working set (the OriginalPane in
 * src/components/shell/SearchPane.tsx), the pane counterpart of
 * /api/pane/search. One GET runs searchOriginal (src/lib/morphsearch.ts)
 * over TAHOT and TAGNT with the query and any parsing filters off the URL,
 * and answers with the verse-grouped hits, the canon-wide occurrence and
 * verse counts, and the language family the query resolved to. A malformed
 * in: scope answers with an error message instead of hits, and the pane
 * shows it.
 */

/** JSON list cap, matching the Bible pane's; counts stay canon-wide. */
const HIT_CAP = 1000;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const filters: MorphFilters = {};
  for (const key of MORPH_FILTER_KEYS) {
    const v = req.nextUrl.searchParams.get(key);
    if (v) filters[key] = v;
  }
  if (q.length < 2 && Object.keys(filters).length === 0) {
    return NextResponse.json({ q, hits: [], total: 0, verses: 0, lang: "both" });
  }
  try {
    const r = await searchOriginal(q, filters, HIT_CAP);
    if (!r) return NextResponse.json({ q, hits: [], total: 0, verses: 0, lang: "both" });
    return NextResponse.json({
      q,
      hits: r.hits.map((h) => ({
        book: h.book.slug,
        bookName: h.book.name,
        testament: h.book.testament,
        chapter: h.chapter,
        verse: h.verse,
        text: h.text,
        matches: h.matches,
      })),
      total: r.total,
      verses: r.verses,
      lang: r.lang,
      domain: r.domain ?? null,
      totalLabel: r.totalLabel ?? null,
    });
  } catch (e) {
    if (e instanceof QueryError) {
      return NextResponse.json({ q, hits: [], total: 0, verses: 0, lang: "both", error: e.message });
    }
    throw e;
  }
}
