import { NextRequest, NextResponse } from "next/server";
import { searchBooks, type BookSearchField } from "@/lib/booksearch";
import { QueryError } from "@/lib/query";

/**
 * The books search pane's working set (src/components/shell/BooksSearchPane.tsx)
 * and the All Search pane's Books group. One query scans the commentary
 * shelf's sections and the topical works' entries server-side
 * (src/lib/booksearch.ts), each group capped at HIT_CAP with its full total
 * beside it so a truncated group says so. The field parameter scopes the
 * query to headings or body text where the data carries the distinction;
 * anything else reads as "all". A malformed precise query answers with an
 * error message instead of hits, and the pane shows it.
 */

/** Per-group JSON cap; a common word answers from thousands of sections. */
const HIT_CAP = 200;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const f = req.nextUrl.searchParams.get("field");
  const field: BookSearchField = f === "heading" || f === "text" ? f : "all";
  const empty = { q, field, commentary: [], commentaryTotal: 0, topics: [], topicsTotal: 0 };
  if (q.length < 2) {
    return NextResponse.json(empty);
  }
  try {
    const results = await searchBooks(q, field, HIT_CAP);
    return NextResponse.json({ q, field, ...results });
  } catch (e) {
    if (e instanceof QueryError) {
      return NextResponse.json({ ...empty, error: e.message });
    }
    throw e;
  }
}
