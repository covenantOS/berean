"use client";

import { collection, type Record_ } from "./store";
import { resolveBookName } from "./canon";

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

/* ---------- List documents: reference-aware saved sets ---------- */

/**
 * Passage and word lists, the handoff target for search results and guides.
 * A passage list is an ordered set of verse references; a word list is an
 * ordered set of lemmas keyed by Strong's id. A clippings document is an
 * ordered set of excerpt snapshots: the words themselves, captured from the
 * reader or the commentary wall, with the citation generated at capture time
 * and never typed by hand. All three carry an optional note per item. They
 * live in their own collection so existing manuscripts load unchanged; the
 * envelope fields ride along from day one as everywhere.
 */

export type ListKind = "passage-list" | "word-list" | "clippings";

export const LIST_KINDS: { key: ListKind; label: string }[] = [
  { key: "passage-list", label: "Passage list" },
  { key: "word-list", label: "Word list" },
  { key: "clippings", label: "Clippings" },
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

export type ListItem = PassageItem | WordItem | ClipItem;

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
