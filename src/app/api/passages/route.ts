import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";

/**
 * Bulk verse text for the export actions (Power Lookup copy): many
 * references in one round trip, always from the shipped KJV data. refs is a
 * comma list of book.chapter.verse or book.chapter.from-to, e.g.
 * "genesis.1.1,exodus.20.1-3". Unknown or out-of-range references drop out
 * of the answer; they never fail the whole request.
 */

const MAX_REFS = 200;
const REF_RE = /^([a-z0-9-]+)\.(\d+)\.(\d+)(?:-(\d+))?$/;

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("refs") ?? "").trim();
  if (!raw) return NextResponse.json({ error: "No references given." }, { status: 400 });
  const tokens = [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))];
  if (tokens.length > MAX_REFS) {
    return NextResponse.json(
      { error: `At most ${MAX_REFS} references per request.` },
      { status: 400 }
    );
  }
  const passages = [];
  for (const token of tokens) {
    const m = REF_RE.exec(token);
    if (!m) continue;
    const book = getBook(m[1]);
    const chapter = Number(m[2]);
    const from = Number(m[3]);
    const to = m[4] ? Number(m[4]) : from;
    if (!book || chapter < 1 || chapter > book.chapters || from < 1 || to < from) continue;
    const verses = await getChapter(book.slug, chapter);
    if (!verses) continue;
    const range = verses.filter((v) => v.verse >= from && v.verse <= to);
    if (range.length === 0) continue;
    passages.push({ book: book.slug, bookName: book.name, chapter, from, to, verses: range });
  }
  return NextResponse.json({ passages });
}
