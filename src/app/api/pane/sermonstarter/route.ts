import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapterCrossRefs } from "@/lib/crossrefs";
import { getChapterEntities } from "@/lib/entities";
import { getQuotesInChapter, getQuotedByChapter, type OtntRef } from "@/lib/otnt";
import { getLexiconEntry } from "@/lib/lexicon";
import { pickKeyVerse, rankKeyPassages } from "@/lib/sermonstarter";
import { getTaggedChapter, STOP_STRONGS } from "@/lib/tagged";
import { getChapterTopics, getTopic, type TopicNode } from "@/lib/topics";

/**
 * The Sermon Starter: a passage in, a preaching report out. The composition
 * leans on what the installation already furnishes, the Passage Guide's own
 * rule: the topical works stand as the theme layer (no Preaching Themes
 * dataset ships), the key passages pool the chapter's cross-references with
 * the themes' key verses (ranked by the rules in src/lib/sermonstarter.ts),
 * the exegetical hooks reuse the guide's notable words and the OT-in-NT
 * parallels, and the media section hands off to the verse card studio and
 * the atlas. Sermons live on the device, so that section is composed in the
 * pane from the projects collection, not here. No illustration bank ships,
 * so no illustrations section is fabricated.
 */

/** Base Strong's id, from an extended id like "H7225G" (the guide's rule). */
function baseStrongs(id: string): string {
  const m = id.match(/^([GH]\d+?)[A-Z]?$/);
  return m ? m[1] : id;
}

/** The themes scanned for key verses; the rest still render as themes. */
const THEME_SCAN = 6;

/** Key verses drawn from one theme's entry tree, in tree order. */
const REFS_PER_THEME = 4;

/** Parallel rows sent to the pane, the chapter's exegetical hooks. */
const PARALLEL_CAP = 8;

/** A theme's first cited verses, walking its entry tree in order. */
function themeKeyRefs(
  nodes: TopicNode[],
  into: { slug: string; chapter: number; verse: number; endVerse?: number }[] = []
): { slug: string; chapter: number; verse: number; endVerse?: number }[] {
  for (const node of nodes) {
    for (const r of node.refs) {
      if (r.verse === null) continue;
      into.push({
        slug: r.slug,
        chapter: r.chapter,
        verse: r.verse,
        ...(r.verseEnd ? { endVerse: r.verseEnd } : {}),
      });
      if (into.length >= REFS_PER_THEME) return into;
    }
    themeKeyRefs(node.children, into);
    if (into.length >= REFS_PER_THEME) return into;
  }
  return into;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }

  const [crossRefs, entities, topics, tagged, quotes, quotedBy] = await Promise.all([
    getChapterCrossRefs(book.slug, chapter),
    getChapterEntities(book.slug, chapter),
    getChapterTopics(book.slug, chapter),
    getTaggedChapter(book.slug, chapter),
    getQuotesInChapter(book.slug, chapter),
    getQuotedByChapter(book.slug, chapter),
  ]);

  // (a) Themes: the topical works' entries citing the chapter, deduplicated
  // across verses and ranked by coverage (the guide's topics join), read as
  // preaching themes with their Topic Guide handoffs.
  const themeRows = new Map<string, { work: string; id: string; title: string; verses: number }>();
  if (topics) {
    for (const mentions of Object.values(topics)) {
      for (const m of mentions) {
        const key = `${m.work}:${m.id}`;
        const row = themeRows.get(key) ?? { work: m.work, id: m.id, title: m.title, verses: 0 };
        row.verses += 1;
        themeRows.set(key, row);
      }
    }
  }
  const themes = [...themeRows.values()]
    .sort((a, b) => b.verses - a.verses || a.title.localeCompare(b.title))
    .slice(0, 12);

  // (b) Key passages: the chapter's cross-references pooled across verses
  // plus the leading themes' own key verses, deduplicated and ranked by the
  // rules in src/lib/sermonstarter.ts (the texts the most verses of the
  // chapter cite first, a theme citation breaks a tie, first sighting
  // settles the rest; the shipped build carries no Treasury vote counts).
  const pooled = crossRefs
    ? Object.entries(crossRefs).flatMap(([verse, refs]) =>
        refs.map((r) => ({ sourceVerse: Number(verse), ...r }))
      )
    : [];
  const themeRefs: { slug: string; chapter: number; verse: number; endVerse?: number }[] = [];
  for (const theme of themes.slice(0, THEME_SCAN)) {
    if (theme.work !== "naves" && theme.work !== "torreys") continue;
    const topic = await getTopic(theme.work, theme.id);
    if (topic) themeRefs.push(...themeKeyRefs(topic.children));
  }
  const keyPassages = rankKeyPassages(pooled, themeRefs, { slug: book.slug, chapter });

  // (c) The key verse: the verse sending the most cross-references, for the
  // verse card handoff (the rule lives beside the ranking).
  const keyVerse = pickKeyVerse(
    pooled.map((r) => ({ sourceVerse: r.sourceVerse })),
    topics ? Object.keys(topics).map(Number) : []
  );

  // (d) Out of the text: the chapter's notable words, the guide's
  // computation, read as exegetical hooks for the sermon.
  const counts = new Map<string, number>();
  if (tagged) {
    for (const v of tagged) {
      for (const w of v.words) {
        for (const s of w.s ?? []) {
          const id = baseStrongs(s);
          if (STOP_STRONGS.has(id)) continue;
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);
  const notableWords = await Promise.all(
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

  // (e) Parallels: the OT texts the chapter quotes and the NT passages
  // quoting it, the guide's composition capped for the report.
  const fmtOtnt = (r: OtntRef): string => {
    const b = getBook(r.book);
    const start = `${r.chapter}:${r.verse}`;
    return `${b?.name ?? r.book} ${r.endVerse ? `${start}–${r.endVerse}` : start}`;
  };
  interface ParallelRow {
    verse: number;
    endVerse?: number;
    direction: "quotes" | "quotedBy";
    kind: "quotation" | "allusion";
    formula?: "written" | "fulfilled";
    note?: string;
    ref: string;
    slug: string;
    chapter: number;
    fromVerse: number;
    toVerse: number;
  }
  const parallels: ParallelRow[] = [];
  for (const rec of quotes) {
    for (const src of rec.ot) {
      parallels.push({
        verse: rec.nt.verse,
        endVerse: rec.nt.endVerse,
        direction: "quotes",
        kind: rec.kind,
        formula: rec.formula,
        note: rec.note,
        ref: fmtOtnt(src),
        slug: src.book,
        chapter: src.chapter,
        fromVerse: src.verse,
        toVerse: src.endVerse ?? src.verse,
      });
    }
  }
  for (const rec of quotedBy) {
    const src = rec.ot.find((s) => s.book === book.slug && s.chapter === chapter);
    if (!src) continue;
    parallels.push({
      verse: src.verse,
      endVerse: src.endVerse,
      direction: "quotedBy",
      kind: rec.kind,
      formula: rec.formula,
      note: rec.note,
      ref: fmtOtnt(rec.nt),
      slug: rec.nt.book,
      chapter: rec.nt.chapter,
      fromVerse: rec.nt.verse,
      toVerse: rec.nt.endVerse ?? rec.nt.verse,
    });
  }
  parallels.sort((a, b) => a.verse - b.verse || a.direction.localeCompare(b.direction));
  const parallelsTop = parallels.slice(0, PARALLEL_CAP);

  // (f) Places: deduplicated across the chapter's verses (the guide's
  // mentions join), for the atlas handoffs in the media section.
  const byId = new Map<string, { id: string; name: string; brief: string; verses: Set<number> }>();
  if (entities) {
    for (const [verse, mentions] of Object.entries(entities)) {
      for (const m of mentions) {
        if (m.kind !== "place") continue;
        let row = byId.get(m.id);
        if (!row) {
          row = { id: m.id, name: m.name, brief: m.brief, verses: new Set<number>() };
          byId.set(m.id, row);
        }
        row.verses.add(Number(verse));
      }
    }
  }
  const places = [...byId.values()]
    .map((m) => ({ id: m.id, name: m.name, brief: m.brief, verses: m.verses.size }))
    .sort((a, b) => b.verses - a.verses || a.name.localeCompare(b.name));

  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    themes,
    keyPassages,
    keyVerse,
    notableWords,
    parallels: parallelsTop,
    places,
  });
}
