import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { decodeMorph, getOriginalChapter, STOP_STRONGS } from "@/lib/tagged";
import { getLexiconEntry, normalizeStrongs } from "@/lib/lexicon";
import { getConstructions } from "@/lib/constructions";

/**
 * The Exegetical Guide: one chapter's original-language report, composed
 * from the tagged TAHOT (Hebrew OT) and TAGNT (Greek NT) apparatus. Word by
 * Word carries the surface text, transliteration, lemma, Strong's number,
 * decoded parsing, and gloss of every token; Important Words ranks the
 * chapter's significant Strong's ids; Lemma in Passage gathers the repeated
 * lemmas with their verses; Constructions lists the clause functions of the
 * MACULA syntax trees verse by verse; Textual Variants lists the words the
 * TAGNT edition flags mark absent from one or more editions (New Testament
 * only, the only place edition data ships). A passage without the apparatus
 * answers 404, never a stub section.
 */

/** TAGNT editions, the same list the reader's original view uses. */
const ALL_EDITIONS = ["NA28", "NA27", "Tyn", "SBL", "WH", "Treg", "TR", "Byz"];

/** Variant words surfaced per chapter, so a heavily disputed verse stays readable. */
const VARIANT_CAP = 24;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }

  const original = await getOriginalChapter(book.slug, chapter);
  if (!original) {
    return NextResponse.json(
      { error: "No tagged original text is furnished for this passage." },
      { status: 404 }
    );
  }
  const lang = book.testament === "OT" ? "hebrew" : "greek";

  // (a) Word by Word: every token of the chapter with its apparatus.
  const verses = original.map((v) => ({
    verse: v.verse,
    alt: v.alt ?? null,
    words: v.words.map((w) => ({
      t: w.t,
      x: w.x ?? null,
      l: w.l ?? null,
      // Extended ids ("G0846A", "H7225G") reduce to the base entry, with the
      // source's zero padding stripped so the id matches the rest of the app.
      strongs: w.s && w.s.length > 0 ? normalizeStrongs(w.s[w.s.length - 1]) : null,
      morph: decodeMorph(w.m, lang),
      g: w.g ?? null,
    })),
  }));

  // (b) Important Words: the chapter's most frequent tagged Strong's ids,
  // function words skipped, glosses resolved from the lexicon.
  const counts = new Map<string, number>();
  for (const v of verses) {
    for (const w of v.words) {
      if (!w.strongs || STOP_STRONGS.has(w.strongs)) continue;
      counts.set(w.strongs, (counts.get(w.strongs) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);
  const importantWords = await Promise.all(
    top.map(async ([strongs, count]) => {
      const hit = await getLexiconEntry(strongs);
      return {
        strongs,
        count,
        lemma: hit?.entry.lemma ?? null,
        xlit: hit?.entry.xlit ?? null,
        gloss: hit?.entry.kjv_def ?? null,
      };
    })
  );

  // (c) Lemma in Passage: the lemmas the chapter repeats, with the verses
  // each appears in and the Strong's id its tokens most often carry.
  const byLemma = new Map<string, { verses: Set<number>; strongs: Map<string, number> }>();
  for (const v of verses) {
    for (const w of v.words) {
      if (!w.l || !w.strongs) continue;
      let row = byLemma.get(w.l);
      if (!row) {
        row = { verses: new Set<number>(), strongs: new Map<string, number>() };
        byLemma.set(w.l, row);
      }
      row.verses.add(v.verse);
      row.strongs.set(w.strongs, (row.strongs.get(w.strongs) ?? 0) + 1);
    }
  }
  const repeated = [...byLemma.entries()]
    .map(([lemma, row]) => {
      const strongs = [...row.strongs.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { lemma, strongs, count: row.verses.size, verses: [...row.verses].sort((a, b) => a - b) };
    })
    .filter((r) => r.count >= 2 && !STOP_STRONGS.has(r.strongs))
    .sort((a, b) => b.count - a.count || a.lemma.localeCompare(b.lemma))
    .slice(0, 12);
  const lemmas = await Promise.all(
    repeated.map(async (r) => {
      const hit = await getLexiconEntry(r.strongs);
      return { ...r, xlit: hit?.entry.xlit ?? null, gloss: hit?.entry.kjv_def ?? null };
    })
  );

  // (d) Textual Variants: TAGNT words absent from one or more editions.
  // TAHOT carries no edition flags, so the Old Testament returns an empty
  // list and the section stays out of the report.
  const variants: { verse: number; words: { t: string; absent: string[] }[] }[] = [];
  if (lang === "greek") {
    let surfaced = 0;
    for (const v of original) {
      if (surfaced >= VARIANT_CAP) break;
      const words: { t: string; absent: string[] }[] = [];
      for (const w of v.words) {
        if (!w.e || w.e.length >= ALL_EDITIONS.length) continue;
        words.push({ t: w.t, absent: ALL_EDITIONS.filter((ed) => !w.e!.includes(ed)) });
        surfaced += 1;
      }
      if (words.length > 0) variants.push({ verse: v.verse, words });
    }
  }

  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    lang,
    verses,
    importantWords,
    lemmas,
    variants,
    // (e) Constructions: the MACULA syntax trees' clause records per verse,
    // keyed by verse number. Absent verses have no clauses beginning in
    // them; a book without the trees answers null and the section stays out.
    constructions: await getConstructions(book.slug, chapter),
  });
}
