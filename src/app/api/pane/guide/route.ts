import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getChapterCommentary } from "@/lib/commentary";
import { getChapterCrossRefs } from "@/lib/crossrefs";
import { getChapterEntities, type EntityKind } from "@/lib/entities";
import { getChapterTopics } from "@/lib/topics";
import { formatEventYears, formatRef, listTimelineEvents } from "@/lib/timeline";
import { getTaggedChapter, STOP_STRONGS } from "@/lib/tagged";
import { getLexiconEntry } from "@/lib/lexicon";

/**
 * The Passage Guide: one chapter's datasets composed into a single report,
 * the Logos guide rebuilt over what Berean already furnishes. Every section
 * degrades honestly: an unfurnished dataset returns an empty section, never
 * an error. Rights gating stays inside the data libs (commentary, entities,
 * and timeline all check the registry before reading).
 */

/** The first excerpt of a work, trimmed at a word boundary. */
function trimExcerpt(text: string, max = 360): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const last = cut.lastIndexOf(" ");
  return `${cut.slice(0, last > 0 ? last : max).trimEnd()} …`;
}

/** Base Strong's id, from an extended id like "H7225G" (same rule as the reader). */
function baseStrongs(id: string): string {
  const m = id.match(/^([GH]\d+?)[A-Z]?$/);
  return m ? m[1] : id;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }

  const [wall, crossRefs, entities, topics, events, tagged] = await Promise.all([
    getChapterCommentary(book.slug, chapter),
    getChapterCrossRefs(book.slug, chapter),
    getChapterEntities(book.slug, chapter),
    getChapterTopics(book.slug, chapter),
    listTimelineEvents(),
    getTaggedChapter(book.slug, chapter),
  ]);

  // (a) The commentary wall: section counts and the first excerpt per work.
  const commentary = wall.map(({ work, sections }) => ({
    id: work.id,
    label: work.label,
    sections: sections.length,
    excerpt: { verses: sections[0].verses, text: trimExcerpt(sections[0].text) },
  }));

  // (b) Cross-references, pooled across the chapter's verses, top by votes.
  const pooled = crossRefs
    ? Object.entries(crossRefs).flatMap(([verse, refs]) =>
        refs.map((r) => ({ sourceVerse: Number(verse), ...r }))
      )
    : [];
  pooled.sort((a, b) => b.votes - a.votes);
  const crossRefsTop = pooled.slice(0, 12);

  // (c) People and places mentioned, deduplicated across the chapter's verses.
  interface MentionRow {
    id: string;
    name: string;
    kind: EntityKind;
    type: string;
    brief: string;
    verses: Set<number>;
  }
  const byId = new Map<string, MentionRow>();
  if (entities) {
    for (const [verse, mentions] of Object.entries(entities)) {
      for (const m of mentions) {
        let row = byId.get(m.id);
        if (!row) {
          row = { ...m, verses: new Set<number>() };
          byId.set(m.id, row);
        }
        row.verses.add(Number(verse));
      }
    }
  }
  const mentions = [...byId.values()]
    .map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      type: m.type,
      brief: m.brief,
      verses: m.verses.size,
    }))
    .sort((a, b) => b.verses - a.verses || a.name.localeCompare(b.name));
  const people = mentions.filter((m) => m.kind === "person");
  const places = mentions.filter((m) => m.kind === "place");
  const others = mentions.filter((m) => m.kind === "other");

  // (d) Topics citing the chapter, deduplicated across verses.
  const topicRows = new Map<string, { work: string; id: string; title: string; verses: number }>();
  if (topics) {
    for (const mentions of Object.values(topics)) {
      for (const m of mentions) {
        const key = `${m.work}:${m.id}`;
        const row = topicRows.get(key) ?? { work: m.work, id: m.id, title: m.title, verses: 0 };
        row.verses += 1;
        topicRows.set(key, row);
      }
    }
  }
  const topicList = [...topicRows.values()]
    .sort((a, b) => b.verses - a.verses || a.title.localeCompare(b.title))
    .slice(0, 16);

  // (e) Timeline events whose Scripture refs intersect the chapter. The
  // timeline has no chapter query helper, so the event list is filtered.
  const timeline = (events ?? [])
    .filter((e) => (e.refs ?? []).some((r) => r.slug === book.slug && r.chapter === chapter))
    .map((e) => ({
      id: e.id,
      label: e.label,
      years: formatEventYears(e),
      refs: (e.refs ?? [])
        .filter((r) => r.slug === book.slug && r.chapter === chapter)
        .map((r) => ({
          label: formatRef(r),
          slug: r.slug,
          chapter: r.chapter,
          verse: r.verse ?? null,
        })),
    }));

  // (f) Notable words: the chapter's most frequent tagged Strong's ids,
  // function words skipped, glosses resolved from the lexicon.
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

  return NextResponse.json({
    book: book.slug,
    bookName: book.name,
    chapter,
    commentary,
    crossRefs: crossRefsTop,
    crossRefsTotal: pooled.length,
    people,
    places,
    others,
    topics: topicList,
    timeline,
    notableWords,
  });
}
