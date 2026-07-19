import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getLexiconEntry, normalizeStrongs } from "@/lib/lexicon";
import { countRenderings, findOccurrences } from "@/lib/tagged";
import { searchOriginal } from "@/lib/morphsearch";
import { getTopic } from "@/lib/topics";

/**
 * The Bible Word Study: one Strong's number's lexical report. The lexicon
 * entry, the canonical occurrence counts and book distribution from the
 * tagged KJV, the distinct English renderings the tagged KJV gives the
 * lemma, a morphology breakdown of the original-language occurrences,
 * and the topics that cite verses where the word appears.
 *
 * The morphology breakdown reuses searchOriginal with the Strong's id as the
 * query and aggregates the decoded parsings; the high limit keeps the
 * aggregation honest for common words (hits beyond the limit would be
 * dropped, and with them their forms).
 *
 * The topics section needs no new index: the per-book verse-to-topic files
 * under data/topics/verses already map every cited verse to its topics, so
 * the occurrences are looked up there directly.
 */

/** JSON list cap; the totals and the topic scan use the full set. */
const LIST_CAP = 600;

/** Ranked renderings sent to the pane; the distinct count stays complete. */
const RENDERING_CAP = 30;

const topicVerseCache = new Map<string, Record<string, string[]> | null>();

async function loadTopicVerseMap(file: string): Promise<Record<string, string[]> | null> {
  const hit = topicVerseCache.get(file);
  if (hit !== undefined) return hit;
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "topics", "verses", `${file}.json`), "utf8")
    ) as Record<string, string[]>;
    topicVerseCache.set(file, raw);
    return raw;
  } catch {
    topicVerseCache.set(file, null);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const id = normalizeStrongs(req.nextUrl.searchParams.get("id") ?? "");
  if (!id) {
    return NextResponse.json({ error: "A Strong's id is required." }, { status: 400 });
  }
  const hit = await getLexiconEntry(id);
  if (!hit) {
    return NextResponse.json({ error: "No lexicon entry." }, { status: 404 });
  }

  const [occ, morph, renderings] = await Promise.all([
    findOccurrences(id, 20000),
    searchOriginal(id, {}, 50000).catch(() => null),
    countRenderings(id),
  ]);

  // Occurrence counts and book distribution, canon order.
  const byBook = occ.byBook.map((b) => ({
    slug: b.book.slug,
    name: b.book.name,
    count: b.count,
  }));
  const list = occ.occurrences.slice(0, LIST_CAP).map((o) => ({
    slug: o.book.slug,
    name: o.book.name,
    chapter: o.chapter,
    verse: o.verse,
    text: o.text,
  }));

  // Morphology breakdown: occurrences counted by decoded parsing, top 8.
  const formCounts = new Map<string, number>();
  if (morph) {
    for (const h of morph.hits) {
      for (const m of h.matches) {
        if (!m.parsing) continue;
        formCounts.set(m.parsing, (formCounts.get(m.parsing) ?? 0) + 1);
      }
    }
  }
  const forms = [...formCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([parsing, count]) => ({ parsing, count }));

  // Topics citing a verse that contains the word, counted per topic.
  const topicCounts = new Map<string, number>();
  for (const o of occ.occurrences) {
    const map = await loadTopicVerseMap(o.book.file);
    if (!map) continue;
    const tags = map[`${o.chapter}:${o.verse}`];
    if (!tags) continue;
    for (const tag of tags) {
      topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);
  const topics = (
    await Promise.all(
      topTags.map(async ([tag, verses]) => {
        const i = tag.indexOf(":");
        const work = tag.slice(0, i);
        const topicId = tag.slice(i + 1);
        if (work !== "naves" && work !== "torreys") return null;
        const topic = await getTopic(work, topicId);
        return topic ? { work, id: topicId, title: topic.title, verses } : null;
      })
    )
  ).filter((t): t is { work: string; id: string; title: string; verses: number } => t !== null);

  return NextResponse.json({
    id: hit.id,
    entry: hit.entry,
    occurrences: {
      total: occ.total,
      books: byBook.length,
      byBook,
      list,
      listed: list.length,
    },
    forms,
    topics,
    translation: {
      total: renderings.reduce((n, r) => n + r.count, 0),
      distinct: renderings.length,
      renderings: renderings.slice(0, RENDERING_CAP),
    },
  });
}
