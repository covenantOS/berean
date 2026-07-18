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
