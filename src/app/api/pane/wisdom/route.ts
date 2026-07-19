import { NextRequest, NextResponse } from "next/server";
import { buildProverbsExplorer, buildPsalmsExplorer } from "@/lib/wisdommeta";

/**
 * The Psalms and Proverbs explorers: the wisdom books' explorer payloads,
 * composed server-side in src/lib/wisdommeta.ts and cached there at module
 * scope. ?book=psalms answers all 150 psalms with genre, superscription
 * author, and the KJV counts, plus the genre taxonomy and the Psalter's
 * five books for grouping; ?book=proverbs answers the book's seven
 * collections with their boundaries and counts.
 */
export async function GET(req: NextRequest) {
  const book = req.nextUrl.searchParams.get("book");
  if (book === "psalms") {
    return NextResponse.json(await buildPsalmsExplorer());
  }
  if (book === "proverbs") {
    return NextResponse.json({ sections: await buildProverbsExplorer() });
  }
  return NextResponse.json({ error: "Unknown wisdom book." }, { status: 400 });
}
