"use client";

import { collection, type Record_ } from "./store";
import { resolveBookName } from "./canon";
import { scanRefs } from "./refscan";

/**
 * The Writing Desk — long-form theological manuscripts. Bodies are
 * Markdown with footnote syntax ([^1] ... [^1]: note). Scripture is
 * inserted as verified quotations by the editor, never typed from memory.
 */

export type DocumentKind =
  | "article"
  | "book-chapter"
  | "newsletter"
  | "lesson"
  | "liturgy-text"
  | "sermon"
  | "other";

export const DOCUMENT_KINDS: { key: DocumentKind; label: string }[] = [
  { key: "article", label: "Article" },
  { key: "book-chapter", label: "Book chapter" },
  { key: "newsletter", label: "Newsletter" },
  { key: "lesson", label: "Lesson" },
  { key: "liturgy-text", label: "Liturgical text" },
  { key: "sermon", label: "Sermon" },
  { key: "other", label: "Other" },
];

export interface StudyDocument extends Record_ {
  title: string;
  kind: DocumentKind;
  body: string;
  /** Optional link into the knowledge graph: the project this serves. */
  projectId?: string;
  /* Sermon metadata: optional on every manuscript, surfaced by the editor
   * when the kind is sermon. Older records carry none of it and load
   * unchanged. */
  /** The appointed text as written, e.g. "John 3:16-18". */
  passage?: string;
  topic?: string;
  series?: string;
  /** ISO date (yyyy-mm-dd) the sermon is appointed for. */
  date?: string;
  venue?: string;
}

export const documents = collection<StudyDocument>("berean.documents.v1");

export function wordCount(body: string): number {
  return body.trim().length === 0 ? 0 : body.trim().split(/\s+/).length;
}

/* ---------- Sermon helpers: references and outlines ---------- */

export interface PassageRef {
  book: string; // canon slug
  bookName: string;
  chapter: number;
  from?: number;
  to?: number;
}

/**
 * Parse one typed or pasted reference ("jn 3:16-18", "1 Peter 2:9") into
 * canon coordinates. Book names resolve through canon.ts, the same table
 * the query language and the critique use. Returns undefined when the
 * string is not a single passage reference.
 */
export function parsePassageRef(text: string): PassageRef | undefined {
  const m = /^\s*([1-3]?\s*[a-z][a-z .]*?)\s+(\d{1,3})(?::(\d{1,3})(?:[-–](\d{1,3}))?)?\s*$/i.exec(
    text
  );
  if (!m) return undefined;
  const book = resolveBookName(m[1].replace(/\s+/g, " ").trim());
  if (!book) return undefined;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return undefined;
  const from = m[3] ? Number(m[3]) : undefined;
  const to = m[4] ? Number(m[4]) : from;
  if (from !== undefined && to !== undefined && to < from) return undefined;
  return { book: book.slug, bookName: book.name, chapter, from, to };
}

/** Display form of a parsed reference: "John 3:16-18" or "John 3". */
export function formatPassageRef(ref: PassageRef): string {
  return `${ref.bookName} ${ref.chapter}${
    ref.from ? `:${ref.from}${ref.to && ref.to !== ref.from ? `-${ref.to}` : ""}` : ""
  }`;
}

/** Workspace deep link for a parsed reference, anchored at the first verse. */
export function passageHref(ref: PassageRef): string {
  return `/read/${ref.book}/${ref.chapter}${ref.from ? `#v${ref.from}` : ""}`;
}

export interface OutlineHeading {
  depth: number; // 1-3, from the Markdown marks
  text: string;
  /** Character offset of the heading line in the body. */
  offset: number;
}

/**
 * The live outline of a manuscript: Markdown headings (through ###) in
 * document order, each with its offset so the editor can scroll to it.
 * Rebuilt from the body on every render, so it tracks edits for free.
 */
export function outlineOf(body: string): OutlineHeading[] {
  const out: OutlineHeading[] = [];
  const re = /^(#{1,3})\s+(.+?)\s*#*\s*$/gm;
  for (const m of body.matchAll(re)) {
    out.push({ depth: m[1].length, text: m[2], offset: m.index });
  }
  return out;
}

/* ---------- Typed blocks: callouts, slides, handouts ---------- */

export type CalloutKind = "illustration" | "question";

export const CALLOUT_KINDS: { key: CalloutKind; label: string }[] = [
  { key: "illustration", label: "Illustration" },
  { key: "question", label: "Question" },
];

/** The marker line that types a blockquote block: `> [!question]`. */
const CALLOUT_RE = /^>\s?\[!(illustration|question)\]\s*$/i;

/**
 * A blockquote block reads as a typed callout when its first line carries
 * the marker; the marker itself never renders. Quote blocks stay plain
 * blockquotes on purpose: the passage insert has written them that way from
 * the first manuscript, so every older draft carries quote blocks already
 * and renders unchanged.
 */
export function calloutOf(lines: string[]): { kind: CalloutKind; content: string[] } | undefined {
  const m = lines[0] ? CALLOUT_RE.exec(lines[0]) : null;
  if (!m) return undefined;
  return { kind: m[1].toLowerCase() as CalloutKind, content: lines.slice(1) };
}

/** The words a `>` block carries with the marks lifted, flowed to one line. */
function blockText(lines: string[]): string {
  return lines
    .map((l) => l.replace(/^>\s?/, ""))
    .join(" ")
    .trim();
}

export interface CalloutMarker {
  kind: CalloutKind;
  /** The block's first line of content, for the sidebar's badge. */
  text: string;
  /** Character offset of the marker line in the body. */
  offset: number;
}

/**
 * The typed blocks of a manuscript in document order, each with its offset
 * so the outline sidebar can badge them beside the headings and land the
 * caret on them. Rebuilt from the body on every render, the way outlineOf
 * is, so it tracks edits for free.
 */
export function calloutMarkersOf(body: string): CalloutMarker[] {
  const out: CalloutMarker[] = [];
  const re = /^>\s?\[!(illustration|question)\][^\n]*(?:\n>[ \t]?([^\n]*))?/gim;
  for (const m of body.matchAll(re)) {
    out.push({
      kind: m[1].toLowerCase() as CalloutKind,
      text: (m[2] ?? "").trim(),
      offset: m.index,
    });
  }
  return out;
}

export type SlideKind = "heading" | "quote" | CalloutKind;

export interface SermonSlide {
  kind: SlideKind;
  text: string;
}

/**
 * The slides a manuscript carries: every heading, every quotation
 * blockquote, and every typed callout, in document order, one per screen.
 * Paragraphs and lists stay with the reading mode; a slide only ever
 * carries words the writer set apart, and an empty block earns none.
 */
export function slidesOf(body: string): SermonSlide[] {
  const slides: SermonSlide[] = [];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split("\n");
    const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
    if (heading && lines.length === 1) {
      const text = heading[2].trim();
      if (text) slides.push({ kind: "heading", text });
      continue;
    }
    if (lines.every((l) => /^>\s?/.test(l))) {
      const callout = calloutOf(lines);
      const text = blockText(callout ? callout.content : lines);
      if (text) slides.push({ kind: callout ? callout.kind : "quote", text });
    }
  }
  return slides;
}

/**
 * The handout a manuscript generates: a link back to the source on the
 * first line, then the outline's headings, the question blocks verbatim as
 * the discussion questions, and the passages the manuscript cites by the
 * same scanner the reader's links use. Nothing is composed here; the
 * questions are the writer's own blocks. A section with nothing to say
 * stays out, and a manuscript with none of the three earns no handout.
 */
export function handoutBodyOf(source: { id: string; title: string }, body: string): string {
  const outline = outlineOf(body);
  const questions = slidesOf(body).filter((s) => s.kind === "question");
  const seen = new Set<string>();
  const passages: string[] = [];
  for (const r of scanRefs(body)) {
    const label = `${r.book.name} ${r.chapter}${
      r.verse ? `:${r.verse}${r.verseEnd && r.verseEnd !== r.verse ? `-${r.verseEnd}` : ""}` : ""
    }`;
    if (!seen.has(label)) {
      seen.add(label);
      passages.push(label);
    }
  }
  if (outline.length === 0 && questions.length === 0 && passages.length === 0) return "";
  const lines: string[] = [
    `_The handout to [${source.title}](/workspace?tab=manuscript:${source.id})._`,
  ];
  if (outline.length > 0) {
    lines.push("", "## Outline", "");
    for (const h of outline) lines.push(`- ${h.text}`);
  }
  if (questions.length > 0) {
    lines.push("", "## Discussion questions", "");
    questions.forEach((q, i) => lines.push(`${i + 1}. ${q.text}`));
  }
  if (passages.length > 0) {
    lines.push("", "## The passages", "");
    for (const p of passages) lines.push(`- ${p}`);
  }
  return lines.join("\n") + "\n";
}

/* ---------- List documents: reference-aware saved sets ---------- */

/**
 * Passage and word lists, the handoff target for search results and guides.
 * A passage list is an ordered set of verse references; a word list is an
 * ordered set of lemmas keyed by Strong's id. A clippings document is an
 * ordered set of excerpt snapshots: the words themselves, captured from the
 * reader or the commentary wall, with the citation generated at capture time
 * and never typed by hand. A bibliography is an ordered set of catalog
 * works, each pinned to its rights-registry id (src/lib/rights.ts), so the
 * entry formats from the registry's own metadata (src/lib/bibliography.ts)
 * and a renamed work follows. All four carry an optional note per item.
 * They live in their own collection so existing manuscripts load unchanged;
 * the envelope fields ride along from day one as everywhere.
 */

export type ListKind = "passage-list" | "word-list" | "clippings" | "bibliography";

export const LIST_KINDS: { key: ListKind; label: string }[] = [
  { key: "passage-list", label: "Passage list" },
  { key: "word-list", label: "Word list" },
  { key: "clippings", label: "Clippings" },
  { key: "bibliography", label: "Bibliography" },
];

export interface PassageItem {
  book: string; // canon slug
  chapter: number;
  verse: number;
  note?: string;
}

export interface WordItem {
  /** Base Strong's id the lexicon and word study answer. */
  strongs: string;
  lemma?: string;
  xlit?: string;
  gloss?: string;
  note?: string;
}

export interface ClipItem {
  /** The excerpt exactly as it was selected or shown. */
  text: string;
  /** The citation generated at capture: a verse reference, or the work and section. */
  citation: string;
  /** Canon coordinates when the excerpt is Scripture; commentary clips carry none. */
  sourceRef?: { book: string; chapter: number; verse: number };
  note?: string;
}

export interface BibItem {
  /** Rights-registry id of the cited work (src/lib/rights.ts). */
  resourceId: string;
  note?: string;
}

export type ListItem = PassageItem | WordItem | ClipItem | BibItem;

export interface ListDocument extends Record_ {
  title: string;
  kind: ListKind;
  items: ListItem[];
}

export const listDocuments = collection<ListDocument>("berean.listdocs.v1");

export function listKindLabel(kind: ListKind): string {
  return LIST_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

/**
 * The capture every clip path shares: append the excerpt to an existing
 * clippings document, or start a new one around it. The item arrives
 * complete; its citation was generated where the excerpt was captured.
 */
export function clipExcerpt(
  docId: string | null,
  item: Omit<ClipItem, "note">,
  newTitle: string
): void {
  if (docId) {
    const doc = listDocuments.get(docId);
    if (doc) listDocuments.update(docId, { items: [...doc.items, item] });
    return;
  }
  listDocuments.create({ title: newTitle, kind: "clippings", items: [item] });
}

/**
 * The capture every bibliography path shares: append the work to an
 * existing bibliography document, or start a new one around it. A work
 * already on the document is not repeated.
 */
export function citeWork(docId: string | null, resourceId: string, newTitle: string): void {
  if (docId) {
    const doc = listDocuments.get(docId);
    if (!doc) return;
    if (doc.items.some((it) => "resourceId" in it && it.resourceId === resourceId)) return;
    listDocuments.update(docId, { items: [...doc.items, { resourceId }] });
    return;
  }
  listDocuments.create({ title: newTitle, kind: "bibliography", items: [{ resourceId }] });
}
