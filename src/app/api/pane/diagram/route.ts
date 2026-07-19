import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { decodeMorph, getOriginalChapter, getTaggedChapter } from "@/lib/tagged";
import { normalizeStrongs } from "@/lib/lexicon";

/**
 * The Sentence Diagram's raw material: one passage's words in order with
 * their parsing, composed for the diagram pane's New diagram action. In
 * original mode the words come from the TAHOT (Hebrew OT) and TAGNT (Greek
 * NT) apparatus: surface text, contextual gloss, base Strong's id, and the
 * decoded morphology that becomes the chip's POS hint. In english mode the
 * words come from the Strong's-tagged KJV in KJV order; that apparatus
 * carries no morphology, so the hint is the word's Strong's ids and pos
 * stays null, an honest absence rather than a guess. A passage without the
 * requested apparatus answers 404, never a stub.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }
  const mode = params.get("mode") === "english" ? "english" : "original";
  const from = Math.max(1, Number(params.get("from")) || 1);
  const toParam = Number(params.get("to"));
  const to = Number.isInteger(toParam) && toParam >= from ? toParam : 999;

  if (mode === "english") {
    const tagged = await getTaggedChapter(book.slug, chapter);
    if (!tagged) {
      return NextResponse.json(
        { error: "No tagged text is furnished for this passage." },
        { status: 404 }
      );
    }
    const verses = tagged.filter((v) => v.verse >= from && v.verse <= to);
    if (verses.length === 0) {
      return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
    }
    return NextResponse.json({
      book: book.slug,
      bookName: book.name,
      chapter,
      from: verses[0].verse,
      to: verses[verses.length - 1].verse,
      mode,
      lang: "english",
      words: verses.flatMap((v) =>
        v.words.map((w) => ({
          verse: v.verse,
          t: w.t,
          gloss: null,
          pos: null,
          strongs: (w.s ?? [])
            .map((s) => normalizeStrongs(s))
            .filter((s): s is string => s !== null),
        }))
      ),
    });
  }

  const original = await getOriginalChapter(book.slug, chapter);
  if (!original) {
    return NextResponse.json(
      { error: "No tagged original text is furnished for this passage." },
      { status: 404 }
    );
  }
  const lang = book.testament === "OT" ? "hebrew" : "greek";
  const verses = original.filter((v) => v.verse >= from && v.verse <= to);
  if (verses.length === 0) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }
  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    from: verses[0].verse,
    to: verses[verses.length - 1].verse,
    mode,
    lang,
    words: verses.flatMap((v) =>
      v.words.map((w) => ({
        verse: v.verse,
        t: w.t,
        gloss: w.g ?? null,
        pos: decodeMorph(w.m, lang) || null,
        // Extended ids ("G0846A", "H7225G") reduce to the base entry, the
        // exegetical route's rule.
        strongs:
          w.s && w.s.length > 0
            ? [normalizeStrongs(w.s[w.s.length - 1])].filter((s): s is string => s !== null)
            : [],
      }))
    ),
  });
}
