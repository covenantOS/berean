import { NextRequest, NextResponse } from "next/server";
import { searchCanon } from "@/lib/bible";
import { QueryError } from "@/lib/query";

/**
 * The concordance pane's working set (src/components/shell/SearchPane.tsx).
 * The omnibox route samples five hits for a preview; this route returns the
 * set the pane's views and charts aggregate over, every hit up to HIT_CAP in
 * canon order, plus the canon-wide total so a truncated set says so. Views
 * never re-fetch: one response carries the whole result set. A malformed
 * precise query (src/lib/query.ts) answers with an error message instead of
 * hits, and the pane shows it.
 */

/** JSON list cap; a common word can answer from thousands of verses. */
const HIT_CAP = 1000;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ q, hits: [], total: 0 });
  }
  try {
    const { hits, total } = await searchCanon(q, HIT_CAP);
    return NextResponse.json({
      q,
      hits: hits.map((h) => ({
        book: h.book.slug,
        bookName: h.book.name,
        chapter: h.chapter,
        verse: h.verse,
        text: h.text,
      })),
      total,
    });
  } catch (e) {
    if (e instanceof QueryError) {
      return NextResponse.json({ q, hits: [], total: 0, error: e.message });
    }
    throw e;
  }
}
