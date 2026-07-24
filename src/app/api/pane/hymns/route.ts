import { NextRequest, NextResponse } from "next/server";
import { getHymn, listHymns } from "@/lib/hymns";

/**
 * The hymnbook, served to the Chapel pane and the hymn reader: the
 * summary rows for browsing and search, or one hymn in full with its
 * verses, refrain, tunes, and scripture references. The data lib gates
 * on the rights registry; a hymn whose entry is not shipped answers 404,
 * never an error page.
 */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ hymns: await listHymns() });
  }
  if (!/^[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "No such hymn." }, { status: 404 });
  }
  const hymn = await getHymn(id);
  if (!hymn) {
    return NextResponse.json({ error: "No such hymn." }, { status: 404 });
  }
  return NextResponse.json(hymn);
}
