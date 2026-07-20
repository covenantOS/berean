import { NextRequest, NextResponse } from "next/server";
import { GOSPEL_SLUGS, getBook } from "@/lib/canon";
import { getChapter, type Verse } from "@/lib/bible";
import { getChapterCommentary } from "@/lib/commentary";
import { getChapterCrossRefs } from "@/lib/crossrefs";
import { getChapterEntities, type EntityKind } from "@/lib/entities";
import { getQuotesInChapter, getQuotedByChapter, type OtntRef } from "@/lib/otnt";
import { getPericopes } from "@/lib/pericopes";
import { findRefs } from "@/lib/refs";
import { getChapterTopics } from "@/lib/topics";
import { formatEventYears, formatRef, listTimelineEvents } from "@/lib/timeline";
import { getTaggedChapter, STOP_STRONGS } from "@/lib/tagged";
import { getLexiconEntry } from "@/lib/lexicon";
import {
  DEFAULT_TRANSLATION,
  getAvailableTranslations,
  translationsForBook,
} from "@/lib/translations";
import { diffIsClean, diffWords, type DiffSegment } from "@/lib/textdiff";

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

/** Lettered verses under one number join into a single verse text (the compare route's rule). */
function groupVerses(verses: Verse[]): { verse: number; text: string }[] {
  const byNumber = new Map<number, string[]>();
  for (const v of verses) {
    const parts = byNumber.get(v.verse) ?? [];
    parts.push(v.label ? `${v.label} ${v.text}` : v.text);
    byNumber.set(v.verse, parts);
  }
  return [...byNumber.entries()].map(([verse, parts]) => ({
    verse,
    text: parts.join(" "),
  }));
}

/** The tokens a verse's alignment marked as added or omitted. */
function changedWordCount(segments: DiffSegment[]): number {
  let n = 0;
  for (const s of segments) {
    if (s.mark !== "same") n += s.text.split(" ").length;
  }
  return n;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const book = getBook(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }

  const isGospel = (GOSPEL_SLUGS as readonly string[]).includes(book.slug);
  const [wall, crossRefs, entities, topics, events, tagged, quotes, quotedBy, pericopes] =
    await Promise.all([
      getChapterCommentary(book.slug, chapter),
      getChapterCrossRefs(book.slug, chapter),
      getChapterEntities(book.slug, chapter),
      getChapterTopics(book.slug, chapter),
      listTimelineEvents(),
      getTaggedChapter(book.slug, chapter),
      getQuotesInChapter(book.slug, chapter),
      getQuotedByChapter(book.slug, chapter),
      isGospel ? getPericopes(book.slug, chapter) : Promise.resolve([]),
    ]);

  // (a) The commentary wall: section counts and the first excerpt per work.
  const commentary = wall.map(({ work, sections }) => ({
    id: work.id,
    label: work.label,
    meta: work.meta,
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

  // (g) Compare Versions: the verses where the furnished texts diverge most
  // from the base, word by word over the same LCS diff the Text Comparison
  // runs. The aggregation stays server-side so the payload ships only the
  // top rows; null when the base text or a second furnished text is missing,
  // and null when every text agrees everywhere.
  const available = translationsForBook(await getAvailableTranslations(), book.testament);
  const baseText = available.find((t) => t.id === DEFAULT_TRANSLATION) ?? available[0];
  let compareVersions: {
    base: string;
    rows: { verse: number; translations: string[]; words: number }[];
  } | null = null;
  if (baseText && available.length > 1) {
    const baseChapter = await getChapter(book.slug, chapter, baseText.id);
    if (baseChapter) {
      const baseVerses = groupVerses(baseChapter);
      const rows = new Map<number, { translations: string[]; words: number }>();
      await Promise.all(
        available
          .filter((t) => t.id !== baseText.id)
          .map(async (t) => {
            const chapterText = await getChapter(book.slug, chapter, t.id);
            // No such chapter under this text's numbering is not a verse diff.
            if (!chapterText) return;
            const grouped = new Map(groupVerses(chapterText).map((v) => [v.verse, v.text]));
            for (const bv of baseVerses) {
              const other = grouped.get(bv.verse);
              const segments = other === undefined ? null : diffWords(bv.text, other);
              if (segments !== null && diffIsClean(segments)) continue;
              const row = rows.get(bv.verse) ?? { translations: [], words: 0 };
              row.translations.push(t.abbrev);
              row.words +=
                segments === null
                  ? bv.text.split(/\s+/).length
                  : changedWordCount(segments);
              rows.set(bv.verse, row);
            }
          })
      );
      const top = [...rows.entries()]
        .map(([verse, r]) => ({ verse, ...r }))
        .sort((a, b) => b.words - a.words || a.verse - b.verse)
        .slice(0, 6);
      if (top.length > 0) compareVersions = { base: baseText.abbrev, rows: top };
    }
  }

  // (h) Parallel Passages: the OT texts the chapter quotes (the NT view) and
  // the NT passages quoting it (the OT view), one row per cited source, from
  // the OT-in-NT dataset (src/lib/otnt.ts). A gospel chapter adds its
  // pericope parallels from the harmony dataset (src/lib/pericopes.ts), the
  // same gospels-only read the harmony index runs.
  const fmtOtnt = (r: OtntRef): string => {
    const b = getBook(r.book);
    const start = `${r.chapter}:${r.verse}`;
    return `${b?.name ?? r.book} ${r.endVerse ? `${start}–${r.endVerse}` : start}`;
  };
  interface ParallelRow {
    /** The verse in the guide's own chapter the row hangs on. */
    verse: number;
    endVerse?: number;
    /** "quotes": the chapter quotes the row's OT text; "quotedBy": the row's
     * NT passage quotes the chapter. */
    direction: "quotes" | "quotedBy";
    kind: "quotation" | "allusion";
    formula?: "written" | "fulfilled";
    note?: string;
    /** The other side of the parallel. */
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
    // One row per citing passage, hung on its first source verse here; a
    // composite citation with two sources in this chapter answers once.
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
  const gospelParallels = pericopes
    .map((p) => {
      const gospels = new Set<string>();
      for (const r of findRefs(p.parallels ?? "")) {
        if ((GOSPEL_SLUGS as readonly string[]).includes(r.book.slug) && r.book.slug !== book.slug) {
          gospels.add(r.book.slug);
        }
      }
      return {
        chapter,
        verse: p.verse,
        heading: p.heading,
        gospels: GOSPEL_SLUGS.filter((s) => gospels.has(s)).map((s) => getBook(s)?.name ?? s),
      };
    })
    .filter((p) => p.gospels.length > 0);

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
    compareVersions,
    parallels,
    gospelParallels,
  });
}
