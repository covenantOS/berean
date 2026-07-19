import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { buildConcordance, type ConcordanceMode } from "@/lib/concordance";

/**
 * The Concordance pane: one book's word or lemma inventory, composed
 * server-side in src/lib/concordance.ts and cached there at module scope.
 * `book` is a canon slug, `mode` is words (English surface forms from the
 * tagged KJV) or lemmas (root Strong's entries from TAHOT/TAGNT), and
 * `all=1` keeps the function words the stoplist folds away. A book without
 * the apparatus answers 404, never a stub.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  if (!book) {
    return NextResponse.json({ error: "Unknown book." }, { status: 400 });
  }
  const rawMode = params.get("mode") ?? "words";
  if (rawMode !== "words" && rawMode !== "lemmas") {
    return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  }
  const mode: ConcordanceMode = rawMode;
  const payload = await buildConcordance(book.slug, mode, params.get("all") === "1");
  if (!payload) {
    return NextResponse.json(
      { error: "No concordance apparatus is furnished for this book." },
      { status: 404 }
    );
  }
  return NextResponse.json(payload);
}
