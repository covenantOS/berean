"use client";

import type { ReactNode } from "react";
import { scanRefs } from "@/lib/refscan";

/**
 * The Markdown subset the Writing Desk preaches from, rendered as read-only
 * React: headings, blockquotes, lists, and paragraphs with bold, italic, and
 * footnote marks inline. No HTML is injected; the words stay text. With
 * linkRefs set, Scripture references in the prose render as working links
 * that dispatch berean:open-ref (src/lib/refscan.ts does the finding); the
 * personal book reader uses it, the manuscript does not, since a draft's
 * references are the writer's own business. Detection runs over the rendered
 * text only; the stored body is never rewritten.
 */

export interface MarkdownOptions {
  /** Render detected Scripture references as berean:open-ref links. */
  linkRefs?: boolean;
}

export function renderMarkdown(body: string, options?: MarkdownOptions): ReactNode[] {
  return body.split(/\n{2,}/).map((block, i) => {
    const lines = block.split("\n");
    const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
    if (heading && lines.length === 1) {
      const depth = Math.min(heading[1].length, 3);
      const Tag = `h${depth}` as "h1" | "h2" | "h3";
      return (
        <Tag key={i} className="font-editorial mb-3 mt-8 text-[1.15em] font-bold leading-tight">
          {inline(heading[2], options)}
        </Tag>
      );
    }
    if (lines.every((l) => /^>\s?/.test(l))) {
      return (
        <blockquote
          key={i}
          className="mb-5 border-l-2 border-rule pl-4 text-[0.85em] italic text-muted"
        >
          {lines.map((l, j) => (
            <span key={j}>
              {inline(l.replace(/^>\s?/, ""), options)}
              {j < lines.length - 1 ? " " : ""}
            </span>
          ))}
        </blockquote>
      );
    }
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      return (
        <ul key={i} className="mb-5 list-disc pl-6">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^[-*]\s+/, ""), options)}</li>
          ))}
        </ul>
      );
    }
    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      return (
        <ol key={i} className="mb-5 list-decimal pl-6">
          {lines.map((l, j) => (
          <li key={j}>{inline(l.replace(/^\d+[.)]\s+/, ""), options)}</li>
          ))}
        </ol>
      );
    }
    return (
      <p key={i} className="mb-5">
        {lines.map((l, j) => (
          <span key={j}>
            {inline(l, options)}
            {j < lines.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    );
  });
}

function inline(text: string, options?: MarkdownOptions): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\^\w+\](?!:))/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(...plain(text.slice(last, m.index), options));
    const tok = m[0];
    if (tok.startsWith("**"))
      parts.push(<strong key={k++}>{plain(tok.slice(2, -2), options)}</strong>);
    else if (tok.startsWith("*"))
      parts.push(<em key={k++}>{plain(tok.slice(1, -1), options)}</em>);
    else
      parts.push(
        <sup key={k++} className="text-sapphire">
          {tok.slice(2, -1)}
        </sup>
      );
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(...plain(text.slice(last), options));
  return parts;
}

/* A run of text without markdown tokens: with linkRefs set, the scanner's
 * references render as links and the rest stays a string; without it the run
 * returns as itself, the manuscript's rendering untouched. */
function plain(text: string, options: MarkdownOptions | undefined): ReactNode[] {
  if (!options?.linkRefs) return [text];
  const refs = scanRefs(text);
  if (refs.length === 0) return [text];
  const parts: ReactNode[] = [];
  let last = 0;
  for (const r of refs) {
    if (r.index > last) parts.push(text.slice(last, r.index));
    parts.push(
      <RefLink
        key={r.index}
        raw={r.raw}
        book={r.book.slug}
        chapter={r.chapter}
        verse={r.verse}
        verseEnd={r.verseEnd}
      />
    );
    last = r.index + r.raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** A detected reference, dispatching berean:open-ref the way the cross-ref
 * treasury's links do, so the pane in focus travels to the passage. */
function RefLink({
  raw,
  book,
  chapter,
  verse,
  verseEnd,
}: {
  raw: string;
  book: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
}) {
  return (
    <button
      type="button"
      title={`Open ${raw} in the reader`}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("berean:open-ref", {
            detail: {
              book,
              chapter,
              ...(verse !== undefined ? { verse } : {}),
              ...(verseEnd !== undefined ? { verseEnd } : {}),
            },
          })
        )
      }
      className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
    >
      {raw}
    </button>
  );
}
