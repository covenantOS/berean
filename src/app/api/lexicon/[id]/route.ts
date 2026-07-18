import { NextResponse } from "next/server";
import { getLexiconEntry } from "@/lib/lexicon";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hit = await getLexiconEntry(id);
  if (!hit) {
    return NextResponse.json({ error: "No entry" }, { status: 404 });
  }
  return NextResponse.json({ id: hit.id, ...hit.entry });
}
