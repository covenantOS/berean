"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import { useRecord } from "@/lib/hooks";
import { documents, wordCount } from "@/lib/documents";

interface Critique {
  quoteChecks: { ref: string; quote: string; verified: boolean }[];
  counsel?: { point: string; ground: string }[];
  engine?: string;
  note?: string;
}

export default function ManuscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const doc = useRecord(documents, id);
  const [body, setBody] = useState("");
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [insBook, setInsBook] = useState("john");
  const [insChapter, setInsChapter] = useState(1);
  const [insFrom, setInsFrom] = useState("");
  const [insTo, setInsTo] = useState("");
  const [inserting, setInserting] = useState(false);

  const [critique, setCritique] = useState<Critique | null>(null);
  const [critiqueState, setCritiqueState] = useState<"idle" | "working" | "error">("idle");
  const [critiqueError, setCritiqueError] = useState("");

  useEffect(() => {
    if (doc && !loadedRef.current) {
      setBody(doc.body);
      loadedRef.current = true;
    }
  }, [doc]);

  function onBodyChange(value: string) {
    setBody(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => documents.update(id, { body: value }), 500);
  }

  async function insertScripture() {
    setInserting(true);
    try {
      const q = new URLSearchParams({ book: insBook, chapter: String(insChapter) });
      if (insFrom) q.set("from", insFrom);
      if (insTo || insFrom) q.set("to", insTo || insFrom);
      const res = await fetch(`/api/passage?${q}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        bookName: string;
        chapter: number;
        verses: { verse: number; text: string }[];
      };
      if (data.verses.length === 0) return;
      const refLabel = `${data.bookName} ${data.chapter}${
        insFrom ? `:${insFrom}${insTo && insTo !== insFrom ? `-${insTo}` : ""}` : ""
      }`;
      const quote = data.verses.map((v) => v.text).join(" ");
      const snippet = `\n> "${quote}" (${refLabel}, KJV)\n`;
      const el = textareaRef.current;
      const pos = el ? el.selectionStart : body.length;
      const next = body.slice(0, pos) + snippet + body.slice(pos);
      onBodyChange(next);
    } finally {
      setInserting(false);
    }
  }

  async function requestCritique() {
    setCritiqueState("working");
    setCritiqueError("");
    try {
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json()) as Critique & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setCritique(data);
      setCritiqueState("idle");
    } catch (err) {
      setCritiqueState("error");
      setCritiqueError(err instanceof Error ? err.message : "The critique could not be prepared.");
    }
  }

  function download() {
    if (!doc) return;
    const blob = new Blob([`# ${doc.title}\n\n${body}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title.replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
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

  const failedChecks = critique?.quoteChecks.filter((c) => !c.verified) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted no-print">
        <Link href="/desk" className="text-sapphire no-underline hover:underline">
          The Writing Desk
        </Link>{" "}
        / {doc.title}
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 no-print">
        <input
          value={doc.title}
          onChange={(e) => documents.update(id, { title: e.target.value })}
          aria-label="Manuscript title"
          className="min-w-0 flex-1 rounded-[4px] border border-transparent bg-transparent font-editorial text-3xl font-bold focus:border-rule focus:bg-surface focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={requestCritique}
            disabled={critiqueState === "working"}
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {critiqueState === "working" ? "The Scribe is reading…" : "Ask the Scribe to read it"}
          </button>
          <button
            onClick={download}
            className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Export .md
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Print
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[4px] border border-rule bg-surface p-3 no-print">
        <span className="small-caps text-xs text-muted">Insert Scripture (verified):</span>
        <select
          value={insBook}
          onChange={(e) => {
            setInsBook(e.target.value);
            setInsChapter(1);
          }}
          aria-label="Book"
          className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
        >
          {CANON.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={insChapter}
          onChange={(e) => setInsChapter(Number(e.target.value))}
          aria-label="Chapter"
          className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
        >
          {Array.from({ length: getBook(insBook)?.chapters ?? 1 }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={insFrom}
          onChange={(e) => setInsFrom(e.target.value)}
          placeholder="v."
          aria-label="From verse"
          className="w-16 rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
        />
        <input
          value={insTo}
          onChange={(e) => setInsTo(e.target.value)}
          placeholder="to v."
          aria-label="To verse"
          className="w-16 rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
        />
        <button
          onClick={insertScripture}
          disabled={inserting}
          className="rounded-[4px] border border-rule bg-paper px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          Insert at cursor
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={28}
            placeholder={
              "Write in Markdown. Footnotes: mark with [^1] in the text and define [^1]: at the foot.\n\nInsert Scripture with the bar above — quotations arrive from the actual text, with the reference attached."
            }
            className="w-full rounded-[4px] border border-rule bg-surface p-5 font-reader text-[0.98rem] leading-relaxed focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <p className="mt-1 text-xs text-muted no-print">
            {wordCount(body).toLocaleString()} words · saved automatically, on this device only.
          </p>
        </section>

        <aside className="no-print">
          <h2 className="small-caps mb-2 text-sm text-muted">The Scribe as honest critic</h2>
          {critiqueState === "error" && (
            <p className="mb-3 rounded-[4px] border border-ruby/40 bg-surface p-3 text-sm text-ruby">
              {critiqueError}
            </p>
          )}
          {!critique ? (
            <div className="rounded-[4px] border border-rule bg-surface p-4 text-sm leading-relaxed text-muted">
              <p>
                When asked, the Scribe reads the manuscript with the text open: every Scripture
                quotation is checked verbatim against the cited verses, and its editorial counsel
                comes grounded in what the text actually says. It reads the way a sharp friend
                reads — with no interest in flattery.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-[4px] border border-rule bg-surface p-4 text-sm">
                <p className="small-caps mb-2 text-xs text-muted">Quotation check</p>
                {critique.quoteChecks.length === 0 ? (
                  <p className="text-muted">
                    No checkable quotations found. Quote with quotation marks near a reference
                    (e.g. &ldquo;…&rdquo; (John 3:16)) and the check can hold them to the text.
                  </p>
                ) : failedChecks.length === 0 ? (
                  <p className="text-emerald">
                    All {critique.quoteChecks.length} quotation
                    {critique.quoteChecks.length === 1 ? "" : "s"} stand verbatim in the cited
                    verses.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {failedChecks.map((c, i) => (
                      <li key={i} className="text-ruby">
                        <span className="font-medium">{c.ref}:</span> &ldquo;{c.quote.slice(0, 80)}
                        {c.quote.length > 80 ? "…" : ""}&rdquo; — not found in the cited verse
                        {c.quote.length > 0 ? "s" : ""}. Check the wording against the text.
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {critique.counsel && critique.counsel.length > 0 && (
                <div className="rounded-[4px] border border-rule bg-surface p-4 text-sm">
                  <p className="small-caps mb-2 text-xs text-muted">Editorial counsel</p>
                  <ul className="space-y-2">
                    {critique.counsel.map((c, i) => (
                      <li key={i}>
                        <p>{c.point}</p>
                        <p className="text-xs text-muted">Ground: {c.ground}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {critique.note && <p className="text-xs text-muted">{critique.note}</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
