import { NextResponse } from "next/server";
import { buildBookExplorer } from "@/lib/bookmeta";

/**
 * The Bible Books Explorer: all sixty-six books with their authorship,
 * genre, approximate composition range, and the verse and word statistics
 * computed from the shipped KJV text. Composed server-side in
 * src/lib/bookmeta.ts and cached there at module scope.
 */
export async function GET() {
  const books = await buildBookExplorer();
  return NextResponse.json({ books });
}
