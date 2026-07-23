import { NextRequest, NextResponse } from "next/server";
import {
  CONFESSION_WORKS,
  getConfession,
  isConfessionId,
  listConfessions,
} from "@/lib/confessions";

/**
 * The confessional corpus, served to the reader pane: the work list with
 * section and proof counts for the browser, or one document in full with
 * its sections and proof texts. The data lib gates on the rights registry;
 * a document whose entry is not shipped answers 404, never an error page.
 */
export async function GET(req: NextRequest) {
  const doc = (req.nextUrl.searchParams.get("doc") ?? "").trim();
  if (!doc) {
    const works = (await listConfessions()).map(({ work, sections, proofs, refs }) => ({
      id: work.id,
      label: work.label,
      title: work.title,
      years: work.years,
      kind: work.kind,
      tradition: work.tradition,
      blurb: work.blurb,
      sections,
      proofs,
      refs,
    }));
    return NextResponse.json({ works });
  }
  if (!/^[a-z0-9-]+$/.test(doc) || !isConfessionId(doc)) {
    return NextResponse.json({ error: "No such document." }, { status: 404 });
  }
  const confession = await getConfession(doc);
  if (!confession) {
    return NextResponse.json({ error: "No such document." }, { status: 404 });
  }
  const work = CONFESSION_WORKS.find((w) => w.id === doc)!;
  return NextResponse.json({ ...confession, label: work.label, tradition: work.tradition });
}
