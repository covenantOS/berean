import { promises as fs } from "fs";
import path from "path";
import { getBook } from "./canon";
import { getRights } from "./rights";

/**
 * The confessional corpus: the historic creeds and the two workhorse
 * standards of the Reformed and Particular Baptist tradition, with their
 * received scripture proof texts. Data is built by
 * scripts/build-confessions.mjs into data/confessions from the vendored
 * public-domain sources (data/_sources/confessions/PROVENANCE.md): the
 * Westminster Shorter Catechism with the Assembly's proofs and the 1689
 * London Baptist Confession with its numbered proofs carry the apparatus;
 * the ecumenical creeds carry none and ship with empty proof lists by
 * design. Two proofs the sources print beyond the canon (Acts 12:29-30,
 * Luke 13:36, both documented errors in the original printings) stay in
 * their display strings and sit out of the index, recorded in
 * data/confessions/_meta.json.
 *
 * The citation index is built once at module scope: every proof reference
 * of every document grouped by the chapter it cites, so the Passage Guide
 * answers which articles cite the chapter and the reader answers which
 * passages an article cites, from the same data, both ways.
 */

export interface ConfessionRef {
  slug: string;
  chapter: number;
  /** First and last verse; both absent when the source cites the chapter. */
  from?: number;
  to?: number;
}

export interface ConfessionProof {
  /** The mark as printed: the confession's numerals, the catechism's letters. */
  mark: string;
  /** The proof's reference string as the source prints it. */
  raw: string;
  refs: ConfessionRef[];
  /** The digitization's editorial note, where it carries one; never the
   * document's own words. */
  note?: string;
}

export interface ConfessionSection {
  id: string;
  /** "Question 14", "Chapter 6", "Article 3". */
  label: string;
  /** The question or chapter title; empty for creed articles. */
  title: string;
  paragraphs: string[];
  proofs: ConfessionProof[];
}

export interface ConfessionMatter {
  heading: string;
  paragraphs: string[];
}

export interface Confession {
  id: string;
  title: string;
  subtitle: string;
  years: string;
  kind: "creed" | "catechism" | "confession";
  blurb?: string;
  frontMatter: ConfessionMatter[];
  backMatter: ConfessionMatter[];
  sections: ConfessionSection[];
}

export interface ConfessionWork {
  id: string;
  /** Short label for citations: "WSC", "1689 LBC", "Nicene". */
  label: string;
  title: string;
  years: string;
  kind: Confession["kind"];
  tradition: string;
  rightsId: string;
  blurb: string;
}

/* Registry order is historical order: the ecumenical creeds, then the
 * Assembly's catechism, then the Baptist confession. */
export const CONFESSION_WORKS: ConfessionWork[] = [
  {
    id: "apostles-creed",
    label: "Apostles'",
    title: "The Apostles' Creed",
    years: "2nd-8th century",
    kind: "creed",
    tradition: "Ecumenical",
    rightsId: "apostles-creed",
    blurb:
      "The baptismal creed of the Western church, received in this form by the eighth century.",
  },
  {
    id: "nicene-creed",
    label: "Nicene",
    title: "The Nicene Creed",
    years: "325/381",
    kind: "creed",
    tradition: "Ecumenical",
    rightsId: "nicene-creed",
    blurb:
      "The faith confessed at Nicaea in 325 against Arius, received in this enlarged form at Constantinople in 381; the 325 text rides as back matter.",
  },
  {
    id: "chalcedon",
    label: "Chalcedon",
    title: "The Definition of Chalcedon",
    years: "451",
    kind: "creed",
    tradition: "Ecumenical",
    rightsId: "chalcedon-definition",
    blurb: "The fourth ecumenical council's definition of the one Christ in two natures, 451.",
  },
  {
    id: "wsc",
    label: "WSC",
    title: "The Westminster Shorter Catechism",
    years: "1647",
    kind: "catechism",
    tradition: "Reformed (Westminster Assembly)",
    rightsId: "westminster-shorter",
    blurb:
      "The Assembly's catechism for beginners, with the proof texts printed by order of the House of Commons.",
  },
  {
    id: "lbc1689",
    label: "1689 LBC",
    title: "The 1689 London Baptist Confession of Faith",
    years: "1677/1689",
    kind: "confession",
    tradition: "Particular Baptist",
    rightsId: "lbc-1689",
    blurb:
      "The Second London Confession: thirty-two articles with the scripture proofs the framers affixed to each.",
  },
];

const cache = new Map<string, Confession | null>();

async function loadConfession(id: string): Promise<Confession | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  const work = CONFESSION_WORKS.find((w) => w.id === id);
  if (!work || getRights(work.rightsId)?.status !== "shipped") {
    cache.set(id, null);
    return null;
  }
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "confessions", `${id}.json`), "utf8")
    ) as Confession;
    cache.set(id, raw);
    return raw;
  } catch {
    cache.set(id, null);
    return null;
  }
}

export function isConfessionId(s: string): boolean {
  return CONFESSION_WORKS.some((w) => w.id === s);
}

/** The corpus's works with their document metadata, for the browser. */
export async function listConfessions(): Promise<
  { work: ConfessionWork; sections: number; proofs: number; refs: number }[]
> {
  const out = [];
  for (const work of CONFESSION_WORKS) {
    const doc = await loadConfession(work.id);
    if (!doc) continue;
    out.push({
      work,
      sections: doc.sections.length,
      proofs: doc.sections.reduce((n, s) => n + s.proofs.length, 0),
      refs: doc.sections.reduce((n, s) => n + s.proofs.reduce((m, p) => m + p.refs.length, 0), 0),
    });
  }
  return out;
}

export async function getConfession(id: string): Promise<Confession | null> {
  return loadConfession(id);
}

export async function getConfessionSection(
  id: string,
  sectionId: string
): Promise<{ doc: Confession; section: ConfessionSection } | null> {
  const doc = await loadConfession(id);
  if (!doc) return null;
  const section = doc.sections.find((s) => s.id === sectionId);
  return section ? { doc, section } : null;
}

/** Display form of a proof reference: "Romans 5:12-19", "Psalm 51". */
export function formatConfessionRef(ref: ConfessionRef): string {
  const name = getBook(ref.slug)?.name ?? ref.slug;
  if (ref.from === undefined) return `${name} ${ref.chapter}`;
  const to = ref.to !== undefined && ref.to !== ref.from ? `-${ref.to}` : "";
  return `${name} ${ref.chapter}:${ref.from}${to}`;
}

/** One article's citation of a chapter: the work, the section, and the
 * references inside this chapter. */
export interface ChapterCitation {
  work: string;
  workLabel: string;
  kind: Confession["kind"];
  sectionId: string;
  label: string;
  title: string;
  refs: ConfessionRef[];
}

/* The passage index: chapter key "slug:chapter" to the articles citing it,
 * in registry order. Built lazily on first use, the way the data libs cache
 * their raw files. */
let chapterIndex: Map<string, ChapterCitation[]> | null = null;

async function buildChapterIndex(): Promise<Map<string, ChapterCitation[]>> {
  if (chapterIndex) return chapterIndex;
  const index = new Map<string, ChapterCitation[]>();
  for (const work of CONFESSION_WORKS) {
    const doc = await loadConfession(work.id);
    if (!doc) continue;
    for (const section of doc.sections) {
      const byChapter = new Map<string, ConfessionRef[]>();
      for (const proof of section.proofs) {
        for (const ref of proof.refs) {
          const key = `${ref.slug}:${ref.chapter}`;
          const list = byChapter.get(key) ?? [];
          list.push(ref);
          byChapter.set(key, list);
        }
      }
      for (const [key, refs] of byChapter) {
        const row: ChapterCitation = {
          work: work.id,
          workLabel: work.label,
          kind: doc.kind,
          sectionId: section.id,
          label: section.label,
          title: section.title,
          refs,
        };
        const list = index.get(key) ?? [];
        list.push(row);
        index.set(key, list);
      }
    }
  }
  chapterIndex = index;
  return index;
}

/** The articles citing a chapter, registry order then document order. */
export async function getChapterCitations(
  slug: string,
  chapter: number
): Promise<ChapterCitation[]> {
  const index = await buildChapterIndex();
  return index.get(`${slug}:${chapter}`) ?? [];
}

/** A topic's passages, for the Topic Guide's confessional join. */
export interface TopicLikeRef {
  slug: string;
  chapter: number;
  verse: number | null;
  verseEnd?: number;
}

/** Does a proof reference cover this verse (or, for a chapter-wide topic
 * reference, does it touch the chapter at all)? */
function refCovers(proof: ConfessionRef, ref: TopicLikeRef): boolean {
  if (proof.slug !== ref.slug || proof.chapter !== ref.chapter) return false;
  if (ref.verse === null) return true;
  if (proof.from === undefined) return true;
  const end = ref.verseEnd ?? ref.verse;
  const to = proof.to ?? proof.from;
  return proof.from <= end && to >= ref.verse;
}

/**
 * The articles whose proof texts intersect a topic's passage list, ranked
 * by how many of the topic's passages they share: the join the data
 * honestly supports, a shared-passage count, named as such wherever it
 * shows. The ecumenical creeds carry no proofs and never answer.
 */
export async function getCitationsForRefs(
  refs: TopicLikeRef[],
  limit = 8
): Promise<(ChapterCitation & { shared: number })[]> {
  if (refs.length === 0) return [];
  const rows: (ChapterCitation & { shared: number })[] = [];
  for (const work of CONFESSION_WORKS) {
    const doc = await loadConfession(work.id);
    if (!doc) continue;
    for (const section of doc.sections) {
      if (section.proofs.length === 0) continue;
      let shared = 0;
      const seen = new Set<string>();
      for (const proof of section.proofs) {
        for (const ref of proof.refs) {
          for (const t of refs) {
            if (!refCovers(ref, t)) continue;
            const key = `${t.slug}:${t.chapter}:${t.verse ?? "all"}`;
            if (seen.has(key)) continue;
            seen.add(key);
            shared++;
          }
        }
      }
      if (shared > 0) {
        rows.push({
          work: work.id,
          workLabel: work.label,
          kind: doc.kind,
          sectionId: section.id,
          label: section.label,
          title: section.title,
          refs: [],
          shared,
        });
      }
    }
  }
  rows.sort(
    (a, b) =>
      b.shared - a.shared ||
      CONFESSION_WORKS.findIndex((w) => w.id === a.work) -
        CONFESSION_WORKS.findIndex((w) => w.id === b.work)
  );
  return rows.slice(0, limit);
}
