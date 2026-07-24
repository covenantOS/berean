import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";

/**
 * The topical index: Nave's Topical Bible and Torrey's New Topical Textbook
 * (both public domain, registered in src/lib/rights.ts). Data is built by
 * scripts/build-topics.mjs into data/topics.
 */

export type TopicWork = "naves" | "torreys";

export interface TopicRef {
  slug: string;
  chapter: number;
  /** null when the source cites a whole chapter */
  verse: number | null;
  verseEnd?: number;
}

export interface TopicNode {
  label: string;
  refs: TopicRef[];
  children: TopicNode[];
  /** title of another topic this node cross-references ("See FAITH IN CHRIST") */
  see?: string;
}

export interface Topic {
  id: string;
  title: string;
  children: TopicNode[];
}

interface TopicFile {
  generated: string;
  work: TopicWork;
  title: string;
  topics: Topic[];
}

export const TOPIC_WORKS: { id: TopicWork; label: string; rightsId: string }[] = [
  { id: "naves", label: "Nave's Topical Bible", rightsId: "naves-topical" },
  { id: "torreys", label: "Torrey's New Topical Textbook", rightsId: "torreys-topical" },
];

const cache = new Map<TopicWork, TopicFile>();
const byId = new Map<TopicWork, Map<string, Topic>>();

async function loadWork(work: TopicWork): Promise<TopicFile | null> {
  const hit = cache.get(work);
  if (hit) return hit;
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "topics", `${work}.json`), "utf8")
    ) as TopicFile;
    cache.set(work, raw);
    byId.set(work, new Map(raw.topics.map((t) => [t.id, t])));
    return raw;
  } catch {
    return null;
  }
}

export function isTopicWork(s: string): s is TopicWork {
  return s === "naves" || s === "torreys";
}

/** Alphabetical index of a work's topics, for the topics tab and search. */
export async function listTopics(
  work: TopicWork
): Promise<{ id: string; title: string; refs: number }[]> {
  const file = await loadWork(work);
  if (!file) return [];
  return file.topics
    .map((t) => ({ id: t.id, title: t.title, refs: countRefs(t) }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getTopic(work: TopicWork, id: string): Promise<Topic | null> {
  await loadWork(work);
  return byId.get(work)?.get(id) ?? null;
}

/** Find a topic by its source title (for "See X" cross-references). */
export async function getTopicByTitle(work: TopicWork, title: string): Promise<Topic | null> {
  const file = await loadWork(work);
  if (!file) return null;
  const needle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return file.topics.find((t) => t.title.replace(/[^a-z0-9]+/g, " ").trim() === needle) ?? null;
}

/** Topic titles matching a query, across both works, for the omnibox. */
export async function searchTopics(
  query: string,
  limit = 12
): Promise<{ work: TopicWork; id: string; title: string; refs: number }[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const out: { work: TopicWork; id: string; title: string; refs: number }[] = [];
  for (const w of TOPIC_WORKS) {
    const file = await loadWork(w.id);
    if (!file) continue;
    for (const t of file.topics) {
      if (t.title.includes(needle)) {
        out.push({ work: w.id, id: t.id, title: t.title, refs: countRefs(t) });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

export function countRefs(topic: Topic): number {
  const walk = (nodes: TopicNode[]): number =>
    nodes.reduce((n, node) => n + node.refs.length + walk(node.children), 0);
  return walk(topic.children);
}

/**
 * The canonical topic alignment between the two works, built by
 * scripts/build-topics-alignment.mjs into data/topics/alignment.json. A row
 * pairs one Nave entry with one Torrey entry that carry the same concept:
 * kind "entry" pairs two whole entries under one canonical name; kind
 * "section" pairs a Torrey entry with the named section of the Nave entry
 * that covers it (Nave merges what Torrey splits, e.g. Torrey's "death of
 * saints" against the OF THE RIGHTEOUS section of Nave's "Death").
 */
export type AlignmentKind = "entry" | "section";

export interface AlignmentRow {
  canonical: string;
  kind: AlignmentKind;
  naves: string;
  torreys: string;
  section?: string;
}

interface AlignmentFile {
  generated: string;
  note: string;
  rows: AlignmentRow[];
}

let alignmentCache: AlignmentFile | null = null;

async function loadAlignment(): Promise<AlignmentFile | null> {
  if (alignmentCache) return alignmentCache;
  try {
    alignmentCache = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "topics", "alignment.json"), "utf8")
    ) as AlignmentFile;
    return alignmentCache;
  } catch {
    return null;
  }
}

export interface TopicAlignment {
  /** The canonical name of the viewed topic, when it sits in a row. */
  canonical: string | null;
  /** The aligned entry in the other work, with how the row relates. */
  twin: {
    work: TopicWork;
    id: string;
    title: string;
    kind: AlignmentKind;
    section?: string;
    canonical: string;
  } | null;
  /** Torrey entries this Nave entry covers as sections (Nave-side view). */
  also: { work: TopicWork; id: string; title: string; canonical: string }[];
}

/** The alignment for one topic: its twin in the other work, plus the other
 * work's narrower entries that this entry covers (section rows). */
export async function getTopicAlignment(work: TopicWork, id: string): Promise<TopicAlignment> {
  const empty: TopicAlignment = { canonical: null, twin: null, also: [] };
  const file = await loadAlignment();
  if (!file) return empty;
  const mine = file.rows.filter((r) => r[work] === id);
  if (mine.length === 0) return empty;
  const other: TopicWork = work === "naves" ? "torreys" : "naves";
  const entryRow = mine.find((r) => r.kind === "entry");
  const rowForTwin = work === "torreys" ? mine[0] : entryRow;
  let twin: TopicAlignment["twin"] = null;
  if (rowForTwin) {
    const twinTopic = await getTopic(other, rowForTwin[other]);
    if (twinTopic) {
      twin = {
        work: other,
        id: twinTopic.id,
        title: twinTopic.title,
        kind: rowForTwin.kind,
        ...(rowForTwin.kind === "section" ? { section: rowForTwin.section } : {}),
        canonical: rowForTwin.canonical,
      };
    }
  }
  const sectionRows = (work === "naves" ? mine : []).filter((r) => r.kind === "section");
  const also: TopicAlignment["also"] = [];
  for (const r of sectionRows.slice(0, 10)) {
    const t = await getTopic(other, r[other]);
    if (t) also.push({ work: other, id: t.id, title: t.title, canonical: r.canonical });
  }
  return { canonical: (entryRow ?? mine[0]).canonical, twin, also };
}

/** Reverse index: topics touching a verse, for the reader apparatus. */
export async function getVerseTopics(
  book: Book,
  chapter: number,
  verse: number
): Promise<{ work: TopicWork; id: string }[]> {
  try {
    const raw = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "data", "topics", "verses", `${book.file}.json`),
        "utf8"
      )
    ) as Record<string, string[]>;
    const tags = raw[`${chapter}:${verse}`] ?? [];
    return tags.map((tag) => {
      const i = tag.indexOf(":");
      return { work: tag.slice(0, i) as TopicWork, id: tag.slice(i + 1) };
    });
  } catch {
    return [];
  }
}

export interface VerseTopicMention {
  work: TopicWork;
  id: string;
  title: string;
}

/**
 * Chapter-level topic mentions for the reader apparatus, in the pattern of
 * getChapterEntities: every verse in the chapter that any topic cites,
 * with titles resolved for display.
 */
export async function getChapterTopics(
  slug: string,
  chapter: number
): Promise<Record<number, VerseTopicMention[]> | null> {
  const book = getBook(slug);
  if (!book) return null;
  let raw: Record<string, string[]>;
  try {
    raw = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "data", "topics", "verses", `${book.file}.json`),
        "utf8"
      )
    ) as Record<string, string[]>;
  } catch {
    return null;
  }
  for (const w of TOPIC_WORKS) await loadWork(w.id);
  const prefix = `${chapter}:`;
  const out: Record<number, VerseTopicMention[]> = {};
  for (const [key, tags] of Object.entries(raw)) {
    if (!key.startsWith(prefix)) continue;
    const verse = Number(key.slice(prefix.length));
    if (!Number.isFinite(verse)) continue;
    const mentions: VerseTopicMention[] = [];
    for (const tag of tags) {
      const i = tag.indexOf(":");
      const work = tag.slice(0, i) as TopicWork;
      const id = tag.slice(i + 1);
      const title = byId.get(work)?.get(id)?.title;
      if (title) mentions.push({ work, id, title });
    }
    if (mentions.length > 0) out[verse] = mentions;
  }
  return out;
}

/** Display form of a reference: "Genesis 6:14-22", "1 Chronicles 24". */
export function formatTopicRef(ref: TopicRef): string {
  const book = getBook(ref.slug);
  const name = book?.name ?? ref.slug;
  if (ref.verse === null) return `${name} ${ref.chapter}`;
  return `${name} ${ref.chapter}:${ref.verse}${ref.verseEnd ? `-${ref.verseEnd}` : ""}`;
}

/** Reader link for a reference. */
export function topicRefHref(ref: TopicRef): string {
  return `/read/${ref.slug}/${ref.chapter}${ref.verse !== null ? `#v${ref.verse}` : ""}`;
}
