"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type ReactNode } from "react";
import { useRecord } from "@/lib/hooks";
import { documents, formatPassageRef, parsePassageRef } from "@/lib/documents";

/**
 * Preaching Mode: the manuscript rendered read-only at pulpit distance.
 * Keyboard paging, adjustable text size persisted on the device, and a
 * full-screen handoff. The editor stays one route back; nothing here can
 * change a word.
 */

const SIZE_KEY = "berean.preach.size.v1";
/* Text size steps in rem, from lectern notes to across the room. */
const SIZES = [1.1, 1.35, 1.6, 1.9, 2.25];

export default function PreachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const doc = useRecord(documents, id);
  const [size, setSize] = useState(2);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SIZE_KEY));
    if (Number.isInteger(saved) && saved >= 0 && saved < SIZES.length) setSize(saved);
  }, []);

  function chooseSize(next: number) {
    const clamped = Math.max(0, Math.min(SIZES.length - 1, next));
    setSize(clamped);
    localStorage.setItem(SIZE_KEY, String(clamped));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = scrollRef.current;
      if (!el) return;
      const page = el.clientHeight * 0.9;
      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          el.scrollBy({ top: page, behavior: "smooth" });
          break;
        case "ArrowUp":
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          el.scrollBy({ top: -page, behavior: "smooth" });
          break;
        case "Home":
          e.preventDefault();
          el.scrollTo({ top: 0, behavior: "smooth" });
          break;
        case "End":
          e.preventDefault();
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          break;
        case "+":
        case "=":
          chooseSize(size + 1);
          break;
        case "-":
          chooseSize(size - 1);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function fullScreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }

  if (doc === undefined) return null;
  if (!doc) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">
          Manuscript not found on this device.{" "}
          <Link href="/desk" className="text-sapphire">
            Back to the Desk
          </Link>
        </p>
      </div>
    );
  }

  const ref = doc.passage ? parsePassageRef(doc.passage) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2 no-print">
        <Link
          href={`/desk/${id}`}
          className="rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium no-underline hover:bg-paper"
        >
          Back to the editor
        </Link>
        <p className="small-caps hidden truncate text-xs text-muted sm:block">
          Arrows or space to page · + and − for text size
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => chooseSize(size - 1)}
            disabled={size === 0}
            aria-label="Smaller text"
            className="rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            A−
          </button>
          <button
            onClick={() => chooseSize(size + 1)}
            disabled={size === SIZES.length - 1}
            aria-label="Larger text"
            className="rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            A+
          </button>
          <button
            onClick={fullScreen}
            className="rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper"
          >
            Full screen
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className="mx-auto max-w-prose px-6 py-10 font-reader leading-relaxed"
          style={{ fontSize: `${SIZES[size]}rem` }}
        >
          <h1 className="font-editorial mb-2 text-[1.4em] font-bold leading-tight">{doc.title}</h1>
          {(ref || doc.series || doc.date || doc.venue) && (
            <p className="small-caps mb-8 text-[0.5em] text-muted">
              {ref ? formatPassageRef(ref) : ""}
              {doc.series ? ` · ${doc.series}` : ""}
              {doc.date ? ` · ${doc.date}` : ""}
              {doc.venue ? ` · ${doc.venue}` : ""}
            </p>
          )}
          {renderMarkdown(doc.body)}
        </div>
      </div>
    </div>
  );
}

/* The manuscript's Markdown subset, rendered as read-only React: headings,
 * blockquotes, lists, and paragraphs with bold, italic, and footnote marks
 * inline. No HTML is injected; the words stay text. */
function renderMarkdown(body: string): ReactNode[] {
  return body.split(/\n{2,}/).map((block, i) => {
    const lines = block.split("\n");
    const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
    if (heading && lines.length === 1) {
      const depth = Math.min(heading[1].length, 3);
      const Tag = `h${depth}` as "h1" | "h2" | "h3";
      return (
        <Tag key={i} className="font-editorial mb-3 mt-8 text-[1.15em] font-bold leading-tight">
          {inline(heading[2])}
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
              {inline(l.replace(/^>\s?/, ""))}
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
            <li key={j}>{inline(l.replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      return (
        <ol key={i} className="mb-5 list-decimal pl-6">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^\d+[.)]\s+/, ""))}</li>
          ))}
        </ol>
      );
    }
    return (
      <p key={i} className="mb-5">
        {lines.map((l, j) => (
          <span key={j}>
            {inline(l)}
            {j < lines.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    );
  });
}

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\^\w+\](?!:))/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) parts.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    else
      parts.push(
        <sup key={k++} className="text-sapphire">
          {tok.slice(2, -1)}
        </sup>
      );
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
