import { NextRequest, NextResponse } from "next/server";
import { searchCanon } from "@/lib/bible";
import { searchEntities } from "@/lib/entities";
import { searchTopics } from "@/lib/topics";

/**
 * Grouped results for the command omnibox (src/components/palette/Omnibox.tsx).
 * References and Strong's numbers parse client-side and never reach this
 * route; text queries get people and places, topics, and English text hits,
 * five of each at most, plus the full verse count for the search-all row.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ q, entities: [], topics: [], hits: [], total: 0 });
  }
  const [canon, entities, topics] = await Promise.all([
    searchCanon(q, 5),
    searchEntities(q, 5),
    searchTopics(q, 5),
  ]);
  return NextResponse.json({
    q,
    entities: entities.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      type: e.type,
      brief: e.brief,
      refs: e.refs,
    })),
    topics: topics.map((t) => ({ work: t.work, id: t.id, title: t.title, refs: t.refs })),
    hits: canon.hits.map((h) => ({
      book: h.book.slug,
      bookName: h.book.name,
      chapter: h.chapter,
      verse: h.verse,
      text: h.text,
    })),
    total: canon.total,
  });
}
