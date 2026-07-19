"use client";

import { collection, type Record_ } from "./store";

/**
 * The Writing Desk — long-form theological manuscripts. Bodies are
 * Markdown with footnote syntax ([^1] ... [^1]: note). Scripture is
 * inserted as verified quotations by the editor, never typed from memory.
 */

export type DocumentKind = "article" | "book-chapter" | "newsletter" | "lesson" | "liturgy-text" | "other";

export const DOCUMENT_KINDS: { key: DocumentKind; label: string }[] = [
  { key: "article", label: "Article" },
  { key: "book-chapter", label: "Book chapter" },
  { key: "newsletter", label: "Newsletter" },
  { key: "lesson", label: "Lesson" },
  { key: "liturgy-text", label: "Liturgical text" },
  { key: "other", label: "Other" },
];

export interface StudyDocument extends Record_ {
  title: string;
  kind: DocumentKind;
  body: string;
  /** Optional link into the knowledge graph: the project this serves. */
  projectId?: string;
}

export const documents = collection<StudyDocument>("berean.documents.v1");

export function wordCount(body: string): number {
  return body.trim().length === 0 ? 0 : body.trim().split(/\s+/).length;
}

/* ---------- List documents: reference-aware saved sets ---------- */

/**
 * Passage and word lists, the handoff target for search results and guides.
 * A passage list is an ordered set of verse references; a word list is an
 * ordered set of lemmas keyed by Strong's id. Both carry an optional note
 * per item. They live in their own collection so existing manuscripts load
 * unchanged; the envelope fields ride along from day one as everywhere.
 */

export type ListKind = "passage-list" | "word-list";

export const LIST_KINDS: { key: ListKind; label: string }[] = [
  { key: "passage-list", label: "Passage list" },
  { key: "word-list", label: "Word list" },
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

export type ListItem = PassageItem | WordItem;

export interface ListDocument extends Record_ {
  title: string;
  kind: ListKind;
  items: ListItem[];
}

export const listDocuments = collection<ListDocument>("berean.listdocs.v1");

export function listKindLabel(kind: ListKind): string {
  return LIST_KINDS.find((k) => k.key === kind)?.label ?? kind;
}
