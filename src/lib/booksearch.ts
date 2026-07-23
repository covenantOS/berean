import { CANON } from "./canon";
import { COMMENTARY_WORKS, getCommentary } from "./commentary";
import {
  evalVerse,
  hasPreciseSyntax,
  parseQuery,
  QueryError,
  verseWords,
  type Node,
  type ScopeSegment,
} from "./query";
import { getRights } from "./rights";
import { listSermonTexts } from "./sermons";
import { getTopic, listTopics, TOPIC_WORKS, type TopicNode, type TopicWork } from "./topics";

/**
 * Books Search: the precise grammar turned on the shelf's prose. The
 * concordance answers verse-shaped questions over the canon; this answers
 * article-shaped ones over the shipped library: the commentary shelf
 * (src/lib/commentary.ts), where every section carries its verse
 * range beside its text, the Spurgeon sermon archive
 * (src/lib/sermons.ts), where a sermon's searchable text is its title,
 * its appointed text as printed, and its full body, and the topical works
 * (src/lib/topics.ts), where an entry's searchable text is its title and
 * its outline labels. A query with no operators takes the case-folded
 * substring path, the same fold the concordance's plain path uses;
 * anything with quotes, boolean, wildcards, NEAR, or WITHIN WORDS parses
 * through src/lib/query.ts and evaluates over each article's words with
 * evalVerse, one article standing in for one verse. Two corners of the
 * grammar stay verse-shaped and do not ship here: WITHIN VERSES asks a
 * cross-article question and answers with a QueryError saying so, and
 * BEFORE/AFTER never existed. The in: scope does compose for the
 * commentary shelf, since sections carry verse ranges: in:romans.8
 * narrows the shelf to sections treating that passage. A sermon roams
 * past its appointed text and a topical entry indexes the whole canon, so
 * scopes narrow neither the archive nor the topical works. Field scoping
 * ships only where the data carries a genuine field: topical entries
 * answer by heading (the title) or body text (the labels), and sermons by
 * heading (the title, with the appointed text riding as head matter) or
 * body text (the quotation and paragraphs); commentary sections carry one
 * prose field with no heading of their own, so a heading-scoped query
 * answers from the sermons and topical works alone. The commentary and
 * sermon indexes build once at module scope and stay resident, the way
 * the other data libs cache the shelf. Each keeps one copy of every
 * article's text; the case fold happens on the scan (one regex per
 * query), not as a lowercased second copy of the shelf, which measured at
 * 124 MB of commentary prose and as much again retained, a cost the 118
 * MB archive cannot pay twice either.
 */

/** Which prose the query reads: everything, headings, or body text. */
export type BookSearchField = "all" | "heading" | "text";

export interface CommentaryHit {
  work: string;
  workLabel: string;
  book: string;
  bookName: string;
  chapter: number;
  /** The section's verse label, e.g. "1-3"; empty for an introduction. */
  verses: string;
  snippet: string;
}

export interface SermonHit {
  slug: string;
  title: string;
  /** The appointed text as printed, where the record carries one. */
  ref: string | null;
  year: number | null;
  /** Which genuine field answered: the head matter (title and appointed
   * text) or the body. */
  field: "heading" | "text";
  snippet: string;
}

export interface TopicHit {
  work: TopicWork;
  workLabel: string;
  topicId: string;
  title: string;
  /** Which genuine field answered. */
  field: "heading" | "text";
  snippet: string;
}

export interface BookSearchResults {
  commentary: CommentaryHit[];
  commentaryTotal: number;
  sermons: SermonHit[];
  sermonsTotal: number;
  topics: TopicHit[];
  topicsTotal: number;
}

/** Characters of context kept on each side of a match in a snippet. */
const CONTEXT = 60;

/* ------------------------- the commentary index ------------------------- */

interface SectionRow {
  work: string;
  workLabel: string;
  /** Canon index of the section's book. */
  bookIdx: number;
  slug: string;
  bookName: string;
  chapter: number;
  /** Verse span of the section's label; an unlabeled introduction covers
   * the chapter, the reading sectionsForVerse gives it. */
  fromV: number;
  toV: number;
  verses: string;
  text: string;
}

/** First and last numbers of a verse label ("1-3" -> [1, 3]); an empty
 * label spans the chapter, exact for the contiguous ranges the build
 * scripts emit and generous for comma lists, as in src/lib/sections.ts. */
function verseSpan(verses: string): [number, number] {
  const nums = verses.match(/\d+/g);
  if (!nums || nums.length === 0) return [1, Number.MAX_SAFE_INTEGER];
  return [Number(nums[0]), Number(nums[nums.length - 1])];
}

let sectionIndex: Promise<SectionRow[]> | null = null;

function loadSectionIndex(): Promise<SectionRow[]> {
  if (!sectionIndex) sectionIndex = buildSectionIndex();
  return sectionIndex;
}

async function buildSectionIndex(): Promise<SectionRow[]> {
  const rows: SectionRow[] = [];
  const works = COMMENTARY_WORKS.filter((w) => getRights(w.rightsId)?.status === "shipped");
  for (const work of works) {
    for (let bookIdx = 0; bookIdx < CANON.length; bookIdx++) {
      const book = CANON[bookIdx];
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        /* getCommentary caches per work and book, so the walk reads each
         * volume once and later queries scan memory alone. */
        const sections = await getCommentary(work.id, book.slug, chapter);
        if (!sections) continue;
        for (const s of sections) {
          const [fromV, toV] = verseSpan(s.verses);
          rows.push({
            work: work.id,
            workLabel: work.label,
            bookIdx,
            slug: book.slug,
            bookName: book.name,
            chapter,
            fromV,
            toV,
            verses: s.verses,
            text: s.text,
          });
        }
      }
    }
  }
  return rows;
}

/** Is a section inside any scope segment? Verse bounds overlap the
 * section's span rather than test one verse, the milestone reading of a
 * scoped query: in:rom.8.28 answers the sections treating that verse. */
function inScopes(scopes: ScopeSegment[], row: SectionRow): boolean {
  if (scopes.length === 0) return true;
  return scopes.some((s) => {
    if (row.bookIdx < s.fromBook || row.bookIdx > s.toBook) return false;
    if (s.fromCh === undefined) return true;
    if (row.bookIdx !== s.fromBook || row.chapter < s.fromCh || row.chapter > s.toCh!) {
      return false;
    }
    if (s.fromV !== undefined && (row.toV < s.fromV || row.fromV > s.toV!)) return false;
    return true;
  });
}

/* --------------------------- the sermon index --------------------------- */

interface SermonRow {
  slug: string;
  title: string;
  /** The appointed text as printed, riding with the title as the sermon's
   * head matter; empty where the record carries none. */
  ref: string;
  year: number | null;
  /** The quotation and the paragraphs joined once; the body field. Empty
   * for the stubs that point to the facsimile. */
  body: string;
}

let sermonIndex: Promise<SermonRow[]> | null = null;

function loadSermonIndex(): Promise<SermonRow[]> {
  if (!sermonIndex) sermonIndex = buildSermonIndex();
  return sermonIndex;
}

async function buildSermonIndex(): Promise<SermonRow[]> {
  /* One retained copy of each sermon's text, the commentary rule: the 118
   * MB archive pays the fold on the scan, not a lowercased second copy.
   * The reader records are transient here; only the rows stay resident. */
  const sermons = await listSermonTexts();
  return sermons.map((s) => ({
    slug: s.slug,
    title: s.title,
    ref: s.ref ?? "",
    year: s.year,
    body: (s.quote ? [s.quote, ...s.paragraphs] : s.paragraphs).join("\n\n"),
  }));
}

/* ------------------------------- matching ------------------------------- */

/** A match as its offset and length in the original text; null on a miss. */
type Matcher = (text: string) => { at: number; span: number } | null;

/** The first literal word or phrase in the tree, for placing the snippet
 * near a real match; wildcards and pure boolean trees give none. */
function firstLiteral(n: Node): string | null {
  switch (n.kind) {
    case "word":
      return n.source.includes("*") ? null : n.source;
    case "phrase":
      return n.source.toLowerCase();
    case "and":
      for (const c of n.children) {
        const s = firstLiteral(c);
        if (s) return s;
      }
      return null;
    case "near":
      return firstLiteral(n.left) ?? firstLiteral(n.right);
    default:
      return null;
  }
}

/** The grammar evaluated over one article's words; the snippet anchors on
 * the first literal when the text carries it verbatim. */
function preciseMatcher(root: Node): Matcher {
  const literal = firstLiteral(root);
  return (text) => {
    if (!evalVerse(root, verseWords(text))) return null;
    if (literal) {
      // The fold is paid only by a section that already answered.
      const at = text.toLowerCase().indexOf(literal);
      if (at >= 0) return { at, span: literal.length };
    }
    return { at: 0, span: 0 };
  };
}

function substringMatcher(needle: string): Matcher {
  // One case-folding regex per query; no lowercased copy of the shelf is
  // retained or swept per scan.
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return (text) => {
    const m = re.exec(text);
    return m ? { at: m.index, span: needle.length } : null;
  };
}

/** The matched text with context around the match, the docs search's cut. */
function snippet(text: string, at: number, span: number): string {
  const from = Math.max(0, at - CONTEXT);
  const to = Math.min(text.length, at + span + CONTEXT);
  return `${from > 0 ? "…" : ""}${text.slice(from, to).trim()}${to < text.length ? "…" : ""}`;
}

/* ------------------------------ the search ------------------------------ */

export async function searchBooks(
  q: string,
  field: BookSearchField = "all",
  cap = 200
): Promise<BookSearchResults> {
  const out: BookSearchResults = {
    commentary: [],
    commentaryTotal: 0,
    sermons: [],
    sermonsTotal: 0,
    topics: [],
    topicsTotal: 0,
  };
  const query = q.trim();
  if (query.length < 2) return out;

  let match: Matcher;
  let scopes: ScopeSegment[] = [];
  if (hasPreciseSyntax(query)) {
    const plan = parseQuery(query);
    if (plan.within.length > 0) {
      throw new QueryError(
        "WITHIN VERSES asks a cross-verse question; a book answers inside one article. Use WITHIN n WORDS OF for a window."
      );
    }
    scopes = plan.scopes;
    match = preciseMatcher(plan.root);
  } else {
    match = substringMatcher(query.toLowerCase());
  }

  /* The commentary shelf: one prose field per section, so a heading-scoped
   * query passes it by. */
  if (field !== "heading") {
    const rows = await loadSectionIndex();
    for (const row of rows) {
      if (!inScopes(scopes, row)) continue;
      const m = match(row.text);
      if (!m) continue;
      out.commentaryTotal++;
      if (out.commentary.length < cap) {
        out.commentary.push({
          work: row.work,
          workLabel: row.workLabel,
          book: row.slug,
          bookName: row.bookName,
          chapter: row.chapter,
          verses: row.verses,
          snippet: snippet(row.text, m.at, m.span),
        });
      }
    }
  }

  /* The sermon archive: the title and the appointed text answer as the
   * heading, the quotation and paragraphs as the body; one row per
   * sermon, the head matter answering first. */
  const sermonRows = await loadSermonIndex();
  for (const row of sermonRows) {
    let hit: SermonHit | null = null;
    if (field !== "text") {
      let m = match(row.title);
      let source = row.title;
      if (!m && row.ref) {
        m = match(row.ref);
        source = row.ref;
      }
      if (m) {
        hit = {
          slug: row.slug,
          title: row.title,
          ref: row.ref || null,
          year: row.year,
          field: "heading",
          snippet: snippet(source, m.at, m.span),
        };
      }
    }
    if (!hit && field !== "heading" && row.body) {
      const m = match(row.body);
      if (m) {
        hit = {
          slug: row.slug,
          title: row.title,
          ref: row.ref || null,
          year: row.year,
          field: "text",
          snippet: snippet(row.body, m.at, m.span),
        };
      }
    }
    if (hit) {
      out.sermonsTotal++;
      if (out.sermons.length < cap) out.sermons.push(hit);
    }
  }

  /* The topical works: the title is the entry's heading, the outline
   * labels its body text; one row per entry, the heading answering first. */
  for (const work of TOPIC_WORKS) {
    if (getRights(work.rightsId)?.status !== "shipped") continue;
    for (const t of await listTopics(work.id)) {
      let hit: TopicHit | null = null;
      if (field !== "text") {
        const m = match(t.title);
        if (m) {
          hit = {
            work: work.id,
            workLabel: work.label,
            topicId: t.id,
            title: t.title,
            field: "heading",
            snippet: snippet(t.title, m.at, m.span),
          };
        }
      }
      if (!hit && field !== "heading") {
        const topic = await getTopic(work.id, t.id);
        const m = topic ? labelMatch(topic.children, match) : null;
        if (m) {
          hit = {
            work: work.id,
            workLabel: work.label,
            topicId: t.id,
            title: t.title,
            field: "text",
            snippet: m,
          };
        }
      }
      if (hit) {
        out.topicsTotal++;
        if (out.topics.length < cap) out.topics.push(hit);
      }
    }
  }

  return out;
}

/** The first outline label that answers, as a snippet; null when none do. */
function labelMatch(nodes: TopicNode[], match: Matcher): string | null {
  for (const node of nodes) {
    const m = match(node.label);
    if (m) return snippet(node.label, m.at, m.span);
    const child = labelMatch(node.children, match);
    if (child !== null) return child;
  }
  return null;
}
