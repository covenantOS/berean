"use client";

import { useEffect, useRef, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import { useRecord } from "@/lib/hooks";
import {
  DOCUMENT_KINDS,
  DocumentKind,
  documents,
  formatPassageRef,
  outlineOf,
  parsePassageRef,
  wordCount,
  type StudyDocument,
} from "@/lib/documents";
import PrintButton from "./PrintButton";
import { renderMarkdown } from "./markdown";
import { useWorkspace } from "./WorkspaceContext";

interface Critique {
  quoteChecks: { ref: string; quote: string; verified: boolean }[];
  counsel?: { point: string; ground: string }[];
  engine?: string;
  note?: string;
}

/**
 * A manuscript open for editing, moved from the retired /desk/[id] page.
 * The body saves on a debounce straight into the documents collection, so
 * the desk, the rails, and Docs Search read every keystroke moments later.
 * Scripture inserts as verified quotation from the passage APIs; the Scribe
 * reads the draft through its critique route and never writes a word of it.
 * The Preach overlay rises over the workspace and changes nothing beneath.
 */
export default function ManuscriptPane({ docId }: { docId: string }) {
  const { dispatch } = useWorkspace();
  const doc = useRecord(documents, docId);
  const [body, setBody] = useState("");
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [insBook, setInsBook] = useState("john");
  const [insChapter, setInsChapter] = useState(1);
  const [insFrom, setInsFrom] = useState("");
  const [insTo, setInsTo] = useState("");
  const [inserting, setInserting] = useState(false);
  const [refText, setRefText] = useState("");
  const [refError, setRefError] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [preaching, setPreaching] = useState(false);

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
    saveTimer.current = setTimeout(() => documents.update(docId, { body: value }), 500);
  }

  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    const pos = el ? el.selectionStart : body.length;
    onBodyChange(body.slice(0, pos) + snippet + body.slice(pos));
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
      insertAtCursor(`\n> "${quote}" (${refLabel}, KJV)\n`);
    } finally {
      setInserting(false);
    }
  }

  /* Passage block from a typed reference: the bulk route answers the whole
   * range in one round trip, and the reference arrives as the citation. */
  async function insertPassage() {
    const ref = parsePassageRef(refText);
    if (!ref) {
      setRefError("That reference does not parse. Try a form like John 3:16-18.");
      return;
    }
    setRefError("");
    setInserting(true);
    try {
      const token = `${ref.book}.${ref.chapter}.${ref.from ?? 1}-${ref.to ?? 200}`;
      const res = await fetch(`/api/passages?refs=${encodeURIComponent(token)}`);
      const data = (await res.json()) as {
        passages?: { verses: { verse: number; text: string }[] }[];
      };
      const verses = res.ok ? (data.passages?.[0]?.verses ?? []) : [];
      if (verses.length === 0) {
        setRefError("No verses answered for that reference.");
        return;
      }
      const quote = verses.map((v) => v.text).join(" ");
      insertAtCursor(`\n> "${quote}" (${formatPassageRef(ref)}, KJV)\n`);
      setRefText("");
    } finally {
      setInserting(false);
    }
  }

  /* A heading click lands the caret on the heading line and scrolls the
   * editor so the line sits near the top. */
  function scrollToOffset(offset: number) {
    const el = textareaRef.current;
    if (!el) return;
    const line = body.slice(0, offset).split("\n").length - 1;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.focus({ preventScroll: true });
    el.setSelectionRange(offset, offset);
    el.scrollTop = Math.max(0, (line - 2) * lineHeight);
  }

  function saveMeta(field: "passage" | "topic" | "series" | "date" | "venue", value: string) {
    documents.update(docId, { [field]: value.trim() || undefined });
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

  if (!doc) {
    return <p className="text-xs text-muted">This manuscript is no longer on this device.</p>;
  }

  const failedChecks = critique?.quoteChecks.filter((c) => !c.verified) ?? [];
  const outline = outlineOf(body);
  const sermonRef = doc.passage ? parsePassageRef(doc.passage) : undefined;

  return (
    <div className="mx-auto max-w-7xl" data-print-root>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 no-print">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
          <input
            value={doc.title}
            onChange={(e) => documents.update(docId, { title: e.target.value })}
            aria-label="Manuscript title"
            className="min-w-0 flex-1 rounded-[4px] border border-transparent bg-transparent font-editorial text-3xl font-bold focus:border-rule focus:bg-surface focus:outline-none"
          />
          <select
            value={doc.kind}
            onChange={(e) => documents.update(docId, { kind: e.target.value as DocumentKind })}
            aria-label="Kind"
            className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
          >
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPreaching(true)}
            className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Preach
          </button>
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
          <span className="inline-flex items-center rounded-[4px] border border-rule bg-surface px-4 py-2">
            <PrintButton />
          </span>
        </div>
      </div>

      {doc.kind === "sermon" && (
        <div className="mb-4 grid gap-2 rounded-[4px] border border-rule bg-surface p-3 no-print sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <input
              value={doc.passage ?? ""}
              onChange={(e) => saveMeta("passage", e.target.value)}
              placeholder="Passage (John 3:16-18)"
              aria-label="Appointed passage"
              className="w-full rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
            />
            {sermonRef && (
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "openRef", book: sermonRef.book, chapter: sermonRef.chapter })
                }
                className="mt-1 inline-block text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Open {formatPassageRef(sermonRef)} in the workspace
              </button>
            )}
          </div>
          <input
            value={doc.topic ?? ""}
            onChange={(e) => saveMeta("topic", e.target.value)}
            placeholder="Topic (optional)"
            aria-label="Topic"
            className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
          />
          <input
            value={doc.series ?? ""}
            onChange={(e) => saveMeta("series", e.target.value)}
            placeholder="Series (optional)"
            aria-label="Series"
            className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            value={doc.date ?? ""}
            onChange={(e) => saveMeta("date", e.target.value)}
            aria-label="Appointed date"
            className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
          />
          <input
            value={doc.venue ?? ""}
            onChange={(e) => saveMeta("venue", e.target.value)}
            placeholder="Venue (optional)"
            aria-label="Venue"
            className="rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
          />
        </div>
      )}

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
        <span className="small-caps text-xs text-muted">or type a reference:</span>
        <input
          value={refText}
          onChange={(e) => setRefText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              insertPassage();
            }
          }}
          placeholder="jn 3:16-18"
          aria-label="Passage reference"
          className="w-36 rounded-[4px] border border-rule bg-paper px-2 py-1.5 text-sm"
        />
        <button
          onClick={insertPassage}
          disabled={inserting}
          className="rounded-[4px] border border-rule bg-paper px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          Insert passage
        </button>
        {refError && <span className="text-xs text-ruby">{refError}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,13rem)_minmax(0,2fr)_minmax(0,1fr)]">
        <aside className="no-print">
          <button
            onClick={() => setOutlineOpen(!outlineOpen)}
            aria-expanded={outlineOpen}
            className="small-caps mb-2 text-sm text-muted hover:text-ink"
          >
            Outline {outlineOpen ? "▾" : "▸"}
          </button>
          {outlineOpen &&
            (outline.length === 0 ? (
              <p className="text-xs text-muted">
                Headings in the manuscript appear here as you write them.
              </p>
            ) : (
              <ul className="space-y-1">
                {outline.map((h, i) => (
                  <li key={i}>
                    <button
                      onClick={() => scrollToOffset(h.offset)}
                      style={{ paddingLeft: `${(h.depth - 1) * 0.75}rem` }}
                      className="block w-full text-left text-sm leading-snug text-ink hover:text-sapphire"
                    >
                      {h.text}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </aside>

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

      {preaching && (
        <PreachOverlay doc={doc} body={body} onExit={() => setPreaching(false)} />
      )}
    </div>
  );
}

const SIZE_KEY = "berean.preach.size.v1";
/* Text size steps in rem, from lectern notes to across the room. */
const SIZES = [1.1, 1.35, 1.6, 1.9, 2.25];

const TIMER_KEY = "berean.preach.timer.v1";
/* The target's bounds and step, in minutes; the default is the half hour. */
const TIMER_DEFAULT = 30;
const TIMER_STEP = 5;
const TIMER_MIN = 5;
const TIMER_MAX = 180;

/** m:ss, the pulpit's own grammar; overtime counts the same way. */
function fmtClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Preaching Mode: the manuscript rendered read-only at pulpit distance, as
 * an overlay over the whole window the way the reader's reading view rises.
 * The editor stays mounted beneath, so nothing in the workspace state moves
 * and not a word can change here. Keyboard paging, five text sizes persisted
 * on the device, Escape or the exit control returns to the editor. The
 * header carries an honest timer: it starts when the overlay rises, counts
 * from the clock rather than the interval so a throttled tab never lies, and
 * pauses for the announcements. The target adjusts in five-minute steps and
 * persists per device; the readout's wash shifts at two minutes out, again
 * at one, and settles ruby past time, a color change and never a strobe.
 */
function PreachOverlay({
  doc,
  body,
  onExit,
}: {
  doc: StudyDocument;
  body: string;
  onExit: () => void;
}) {
  const [size, setSize] = useState(2);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [target, setTarget] = useState(TIMER_DEFAULT);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  /** Milliseconds banked across pauses, and the start of the running stretch. */
  const bankRef = useRef(0);
  const sinceRef = useRef(Date.now());
  const runRef = useRef(true);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SIZE_KEY));
    if (Number.isInteger(saved) && saved >= 0 && saved < SIZES.length) setSize(saved);
    const savedTarget = Number(localStorage.getItem(TIMER_KEY));
    if (Number.isInteger(savedTarget) && savedTarget >= TIMER_MIN && savedTarget <= TIMER_MAX)
      setTarget(savedTarget);
  }, []);

  /* The readout ticks, but the count comes from the clock. */
  useEffect(() => {
    const tick = window.setInterval(() => {
      const stretch = runRef.current ? Date.now() - sinceRef.current : 0;
      setElapsed(Math.floor((bankRef.current + stretch) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  function toggleTimer() {
    if (runRef.current) {
      bankRef.current += Date.now() - sinceRef.current;
      runRef.current = false;
    } else {
      sinceRef.current = Date.now();
      runRef.current = true;
    }
    setRunning(runRef.current);
  }

  function chooseTarget(next: number) {
    const clamped = Math.max(TIMER_MIN, Math.min(TIMER_MAX, next));
    setTarget(clamped);
    localStorage.setItem(TIMER_KEY, String(clamped));
  }

  function chooseSize(next: number) {
    const clamped = Math.max(0, Math.min(SIZES.length - 1, next));
    setSize(clamped);
    localStorage.setItem(SIZE_KEY, String(clamped));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onExit();
        return;
      }
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

  const ref = doc.passage ? parsePassageRef(doc.passage) : undefined;

  /* The wash at two minutes out, at one, and past time; never a strobe. */
  const remaining = target * 60 - elapsed;
  const wash =
    remaining <= 0
      ? "border-ruby/50 bg-ruby/10 text-ruby"
      : remaining <= 60
        ? "border-amber/60 bg-amber/20 text-amber"
        : remaining <= 120
          ? "border-amber/40 bg-amber/10 text-amber"
          : "border-rule bg-surface text-muted";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2 no-print">
        <button
          onClick={onExit}
          className="rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper"
        >
          Back to the editor
        </button>
        <p className="small-caps hidden truncate text-xs text-muted sm:block">
          Arrows or space to page · + and − for text size · Esc to return
        </p>
        <div className="flex items-center gap-2">
          <div
            role="timer"
            aria-label={
              remaining <= 0
                ? `${fmtClock(elapsed - target * 60)} past the ${target}-minute target`
                : `${fmtClock(elapsed)} elapsed of a ${target}-minute target`
            }
            title="Elapsed against the target; the wash shifts at two minutes out, at one, and past time"
            className={`rounded-[4px] border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors ${wash}`}
          >
            {remaining <= 0 ? `+${fmtClock(elapsed - target * 60)}` : fmtClock(elapsed)}
            <span className="ml-1.5 text-[0.72rem] font-normal opacity-70">
              of {fmtClock(target * 60)}
            </span>
          </div>
          <button
            onClick={toggleTimer}
            className="rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper"
          >
            {running ? "Pause" : "Resume"}
          </button>
          <button
            onClick={() => chooseTarget(target - TIMER_STEP)}
            disabled={target <= TIMER_MIN}
            aria-label="Shorter target"
            title="Five minutes off the target, kept on this device"
            className="rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            −
          </button>
          <button
            onClick={() => chooseTarget(target + TIMER_STEP)}
            disabled={target >= TIMER_MAX}
            aria-label="Longer target"
            title="Five minutes on the target, kept on this device"
            className="rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            +
          </button>
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
          {renderMarkdown(body)}
        </div>
      </div>
    </div>
  );
}
