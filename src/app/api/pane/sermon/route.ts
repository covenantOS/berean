import { NextRequest, NextResponse } from "next/server";
import { getSermon } from "@/lib/sermons";

/**
 * One Spurgeon sermon in full for the reader pane. The data lib gates on
 * the rights registry; an unknown or malformed slug answers 404, never an
 * error page.
 */
export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: "No such sermon." }, { status: 404 });
  }
  const sermon = await getSermon(slug);
  if (!sermon) {
    return NextResponse.json({ error: "No such sermon." }, { status: 404 });
  }
  return NextResponse.json(sermon);
}
