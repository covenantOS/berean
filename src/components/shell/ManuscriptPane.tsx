"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import { useCollection, useRecord } from "@/lib/hooks";
import {
  CALLOUT_KINDS,
  DOCUMENT_KINDS,
  DocumentKind,
  calloutMarkersOf,
  documents,
  formatPassageRef,
  handoutBodyOf,
  outlineOf,
  parsePassageRef,
  slidesOf,
  wordCount,
  type CalloutKind,
  type SermonSlide,
  type StudyDocument,
} from "@/lib/documents";
import { formatCitation } from "@/lib/citation";
import { docxFor } from "@/lib/docx";
import { isAnchored, notes, type MarginNote } from "@/lib/marginalia";
import { playSound } from "@/lib/sound";
import PrintButton from "./PrintButton";
import { renderInline, renderMarkdown } from "./markdown";
import { useWorkspaceDispatch } from "./WorkspaceContext";

/* The block scaffolds the toolbar inserts at the caret. Headings and
 * quotes are Markdown itself; the callouts carry their marker line, which
 * the renderer reads and never shows. */
const BLOCK_BUTTONS: { label: string; snippet: string; title: string }[] = [
  { label: "Heading", snippet: "\n## \n", title: "A section heading" },
  { label: "Quote", snippet: "\n> \n", title: "A quotation block, a plain blockquote" },
  { label: "Illustration", snippet: "\n> [!illustration]\n> \n", title: "An illustration block" },
  { label: "Question", snippet: "\n> [!question]\n> \n", title: "A discussion question block" },
];

interface Critique {
  quoteChecks: { ref: string; quote: string; verified: boolean }[];
  counsel?: { point: string; ground: string }[];
  engine?: string;
  note?: string;
}

/**
 * A manuscript open for editing, moved from the retired /desk/[id] page.
 * The body saves on a debounce straight into the documents collection, so
 * the desk, the rails, and Docs Search read every keystroke moments later;
 * the small bell rings when that debounced write lands, never on a
 * keystroke. Scripture inserts as verified quotation from the passage APIs;
 * the Scribe reads the draft through its critique route and never writes a
 * word of it. The Preach overlay rises over the workspace and changes
 * nothing beneath.
 */
export default function ManuscriptPane({ docId }: { docId: string }) {
  const { dispatch } = useWorkspaceDispatch();
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
  const [notesOpen, setNotesOpen] = useState(false);
  const marginNotes = useCollection(notes);

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
    /* The bell answers the completed write alone: update returns undefined
     * when the record is gone, and a save that wrote nothing stays silent. */
    saveTimer.current = setTimeout(() => {
      if (documents.update(docId, { body: value })) playSound("complete");
    }, 500);
  }

  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    const pos = el ? el.selectionStart : body.length;
    onBodyChange(body.slice(0, pos) + snippet + body.slice(pos));
  }

  /* A note arrives with its anchor as the citation, arranged by the active
   * copy style the way every copied verse is; an unanchored entry brings
   * its words alone. Click inserts at the caret; literal drag-and-drop
   * stays out, since the textarea's caret model has no drop position. */
  function insertNote(n: MarginNote) {
    if (isAnchored(n)) {
      const label = `${getBook(n.book)?.name ?? n.book} ${n.chapter}:${n.verse}`;
      insertAtCursor(`\n${formatCitation(n.text, label)}\n`);
    } else {
      insertAtCursor(`\n${n.text}\n`);
    }
  }

  /* The handout is extraction, never composition: the outline, the
   * question blocks, and the cited passages, into a new manuscript that
   * opens in its own tab. */
  function createHandout() {
    if (!doc) return;
    const md = handoutBodyOf({ id: docId, title: doc.title }, body);
    if (!md) return;
    const handout = documents.create({
      title: `${doc.title} handout`,
      kind: "lesson",
      body: md,
    });
    dispatch({ type: "openManuscript", docId: handout.id, title: handout.title });
  }

  /* Notebooks and their notes for the insert panel; unfiled notes gather
   * at the foot under their own name. */
  const noteGroups = useMemo(() => {
    const groups = new Map<string, MarginNote[]>();
    for (const n of marginNotes) {
      const name = n.notebook?.trim() || "Unfiled";
      groups.set(name, [...(groups.get(name) ?? []), n]);
    }
    return [...groups.entries()].sort(([a], [b]) =>
      a === "Unfiled" ? 1 : b === "Unfiled" ? -1 : a.localeCompare(b)
    );
  }, [marginNotes]);

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
      playSound("complete");
    } catch (err) {
      setCritiqueState("error");
      setCritiqueError(err instanceof Error ? err.message : "The critique could not be prepared.");
      playSound("error");
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

  /* The Word export: the same title-plus-body document, mapped through
   * docxFor (src/lib/docx.ts) into a real .docx. */
  function downloadDocx() {
    if (!doc) return;
    const blob = new Blob([docxFor(doc.title, body) as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title.replace(/[^\w-]+/g, "-").toLowerCase()}.docx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* The whole document to the clipboard, the same bytes the .md download
   * writes. */
  function copyAll() {
    if (!doc) return;
    void navigator.clipboard?.writeText(`# ${doc.title}\n\n${body}`);
  }

  if (!doc) {
    return <p className="text-xs text-muted">This manuscript is no longer on this device.</p>;
  }

  const failedChecks = critique?.quoteChecks.filter((c) => !c.verified) ?? [];
  const outline = outlineOf(body);
  /* Headings and typed blocks share the sidebar, ordered by where they sit. */
  const blocks = [
    ...outline.map((h) => ({ ...h, kind: undefined as CalloutKind | undefined })),
    ...calloutMarkersOf(body).map((c) => ({
      depth: 2,
      text: c.text,
      offset: c.offset,
      kind: c.kind as CalloutKind | undefined,
    })),
  ].sort((a, b) => a.offset - b.offset);
  const handoutReady = handoutBodyOf({ id: docId, title: doc.title }, body) !== "";
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
            onClick={() => {
              setPreaching(true);
              playSound("open");
            }}
            className="fx-press rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Preach
          </button>
          <button
            onClick={requestCritique}
            disabled={critiqueState === "working"}
            className="fx-press rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {critiqueState === "working" ? "The Scribe is reading…" : "Ask the Scribe to read it"}
          </button>
          <button
            onClick={createHandout}
            disabled={!handoutReady}
            title="A new manuscript with the outline, the question blocks, and the cited passages"
            className="fx-press rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            Create handout
          </button>
          <ExportMenu onCopyAll={copyAll} onMarkdown={download} onDocx={downloadDocx} />
        </div>
      </div>

      {doc.kind === "sermon" && (
        <div className="glass mb-4 grid gap-2 rounded-[4px] p-3 no-print sm:grid-cols-2 lg:grid-cols-5">
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

      <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-[4px] p-3 no-print">
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
          className="fx-press rounded-[4px] border border-rule bg-paper px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:opacity-50"
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
          className="fx-press rounded-[4px] border border-rule bg-paper px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          Insert passage
        </button>
        {refError && <span className="text-xs text-ruby">{refError}</span>}
      </div>

      <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-[4px] p-3 no-print">
        <span className="small-caps text-xs text-muted">Blocks:</span>
        {BLOCK_BUTTONS.map((b) => (
          <button
            key={b.label}
            onClick={() => insertAtCursor(b.snippet)}
            title={b.title}
            className="fx-press rounded-[4px] border border-rule bg-paper px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            {b.label}
          </button>
        ))}
        <button
          onClick={() => {
            setNotesOpen(!notesOpen);
            playSound(notesOpen ? "toggle-off" : "toggle-on");
          }}
          aria-expanded={notesOpen}
          className="fx-press rounded-[4px] border border-rule bg-paper px-3 py-1.5 text-sm font-medium hover:bg-surface"
        >
          Insert from notes {notesOpen ? "▾" : "▸"}
        </button>
      </div>

      {notesOpen && (
        <div className="glass fx-fade mb-4 rounded-[4px] p-3 no-print">
          {noteGroups.length === 0 ? (
            <p className="text-xs text-muted">
              No notes yet. Notes written in the reader&rsquo;s margins file under notebooks and
              wait here.
            </p>
          ) : (
            noteGroups.map(([name, ns]) => (
              <div key={name} className="mb-3 last:mb-0">
                <p className="small-caps mb-1 text-xs text-muted">{name}</p>
                <ul className="space-y-1">
                  {ns.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => insertNote(n)}
                        title="Insert this note at the cursor"
                        className="block w-full text-left text-sm leading-snug text-ink hover:text-sapphire"
                      >
                        {isAnchored(n) && (
                          <span className="text-muted">
                            {getBook(n.book)?.name ?? n.book} {n.chapter}:{n.verse} ·{" "}
                          </span>
                        )}
                        {n.text.length > 90 ? `${n.text.slice(0, 90)}…` : n.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,13rem)_minmax(0,2fr)_minmax(0,1fr)]">
        <aside className="no-print">
          <button
            onClick={() => {
              setOutlineOpen(!outlineOpen);
              playSound(outlineOpen ? "toggle-off" : "toggle-on");
            }}
            aria-expanded={outlineOpen}
            className="small-caps mb-2 text-sm text-muted hover:text-ink"
          >
            Outline {outlineOpen ? "▾" : "▸"}
          </button>
          {outlineOpen &&
            (blocks.length === 0 ? (
              <p className="text-xs text-muted">
                Headings and typed blocks appear here as you write them.
              </p>
            ) : (
              <div className="glass rounded-[4px] p-3">
                <ul className="fx-stagger space-y-1">
                  {blocks.map((b, i) => (
                    <li key={i} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                      <button
                        onClick={() => scrollToOffset(b.offset)}
                        style={{ paddingLeft: `${(b.depth - 1) * 0.75}rem` }}
                        className="block w-full text-left text-sm leading-snug text-ink hover:text-sapphire"
                      >
                        {b.kind && (
                          <span className="small-caps mr-1 text-[0.65rem] text-amber">
                            {CALLOUT_KINDS.find((k) => k.key === b.kind)?.label}
                          </span>
                        )}
                        {b.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
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
            <div className="glass rounded-[4px] p-4 text-sm leading-relaxed text-muted">
              <p>
                When asked, the Scribe reads the manuscript with the text open: every Scripture
                quotation is checked verbatim against the cited verses, and its editorial counsel
                comes grounded in what the text actually says. It reads the way a sharp friend
                reads — with no interest in flattery.
              </p>
            </div>
          ) : (
            <div className="fx-stagger space-y-3">
              <div
                style={{ "--i": 0 } as React.CSSProperties}
                className="glass rounded-[4px] p-4 text-sm"
              >
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
                <div
                  style={{ "--i": 1 } as React.CSSProperties}
                  className="glass rounded-[4px] p-4 text-sm"
                >
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
              {critique.note && (
                <p style={{ "--i": 2 } as React.CSSProperties} className="text-xs text-muted">
                  {critique.note}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      {preaching && (
        <PreachOverlay
          doc={doc}
          body={body}
          onExit={() => {
            setPreaching(false);
            playSound("close");
          }}
        />
      )}
    </div>
  );
}

/* The one export affordance, the panel row of the header: every road out of
 * the manuscript gathered behind a single button. Copy all writes the whole
 * document to the clipboard; the downloads are the Markdown source (the
 * same bytes as always) and a real Word document from docxFor (src/lib/
 * docx.ts); Print is the shared print idiom, and its dialog's Save as PDF
 * is the honest PDF export, and the menu says so plainly. The handout needs no
 * surface of its own: it is a manuscript and opens in this same pane. */
function ExportMenu({
  onCopyAll,
  onMarkdown,
  onDocx,
}: {
  onCopyAll: () => void;
  onMarkdown: () => void;
  onDocx: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        playSound("close");
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
        playSound("close");
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const item =
    "block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          playSound(open ? "close" : "open");
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="fx-press rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
      >
        Export {open ? "▾" : "▸"}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Export this manuscript"
          style={{ "--fx-origin": "100% 0" } as React.CSSProperties}
          className="glass fx-scale absolute right-0 z-40 mt-1 w-60 rounded-[4px] py-1 shadow-lg"
        >
          <button
            type="button"
            className={item}
            onClick={() => {
              onCopyAll();
              setOpen(false);
              playSound("close");
            }}
          >
            Copy all
          </button>
          <button
            type="button"
            title="The Markdown source, as always"
            className={item}
            onClick={() => {
              onMarkdown();
              setOpen(false);
              playSound("close");
            }}
          >
            Export .md (Markdown)
          </button>
          <button
            type="button"
            title="A real Word document; LibreOffice and Google Docs open it too"
            className={item}
            onClick={() => {
              onDocx();
              setOpen(false);
              playSound("close");
            }}
          >
            Export .docx (Word)
          </button>
          <div className="my-1 border-t border-rule" />
          <div
            className="px-3 py-1.5 text-sm"
            onClick={() => {
              setOpen(false);
              playSound("close");
            }}
          >
            <PrintButton className="text-sm" />
          </div>
          <p className="px-3 pb-1 text-xs text-muted">
            For a PDF, print and choose Save as PDF in the dialog.
          </p>
        </div>
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
 * A Slides toggle trades the continuous text for one block per screen:
 * every heading, quotation, and typed callout of the manuscript (slidesOf
 * in src/lib/documents.ts), paged with the same keys, with a current-of-
 * total indicator in the header. Slide editing and style controls stay
 * out; the slides are the manuscript's own blocks, read. The overlay
 * settles in with the pane entrance and each slide crossfades as it
 * pages; the bells mark the rise and the return to the editor, and the
 * pulpit's own controls keep silence.
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
  const [mode, setMode] = useState<"read" | "slides">("read");
  const [slide, setSlide] = useState(0);
  const slides = useMemo(() => slidesOf(body), [body]);

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
      /* Slides page one block at a time with the same keys the reading
       * mode pages the scroll with. */
      if (mode === "slides") {
        switch (e.key) {
          case "ArrowDown":
          case "ArrowRight":
          case "PageDown":
          case " ":
            e.preventDefault();
            setSlide((s) => Math.min(s + 1, slides.length - 1));
            break;
          case "ArrowUp":
          case "ArrowLeft":
          case "PageUp":
            e.preventDefault();
            setSlide((s) => Math.max(s - 1, 0));
            break;
          case "Home":
            e.preventDefault();
            setSlide(0);
            break;
          case "End":
            e.preventDefault();
            setSlide(slides.length - 1);
            break;
          case "+":
          case "=":
            chooseSize(size + 1);
            break;
          case "-":
            chooseSize(size - 1);
            break;
        }
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
    <div className="fx-pane-enter fixed inset-0 z-40 flex flex-col bg-paper">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2 no-print">
        <button
          onClick={onExit}
          className="fx-press rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper"
        >
          Back to the editor
        </button>
        <p className="small-caps hidden truncate text-xs text-muted sm:block">
          Arrows or space to page · + and − for text size · Esc to return
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMode(mode === "slides" ? "read" : "slides");
              setSlide(0);
            }}
            disabled={slides.length === 0}
            title={
              slides.length === 0
                ? "No headings, quotations, or typed blocks to show as slides"
                : "One block per screen, paged with the same keys"
            }
            className="fx-press rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            {mode === "slides" ? "Reading" : "Slides"}
          </button>
          {mode === "slides" && (
            <span className="small-caps text-xs text-muted" aria-live="polite">
              {slide + 1} of {slides.length}
            </span>
          )}
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
            className="fx-press rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper"
          >
            {running ? "Pause" : "Resume"}
          </button>
          <button
            onClick={() => chooseTarget(target - TIMER_STEP)}
            disabled={target <= TIMER_MIN}
            aria-label="Shorter target"
            title="Five minutes off the target, kept on this device"
            className="fx-press rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            −
          </button>
          <button
            onClick={() => chooseTarget(target + TIMER_STEP)}
            disabled={target >= TIMER_MAX}
            aria-label="Longer target"
            title="Five minutes on the target, kept on this device"
            className="fx-press rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            +
          </button>
          <button
            onClick={() => chooseSize(size - 1)}
            disabled={size === 0}
            aria-label="Smaller text"
            className="fx-press rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            A−
          </button>
          <button
            onClick={() => chooseSize(size + 1)}
            disabled={size === SIZES.length - 1}
            aria-label="Larger text"
            className="fx-press rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-50"
          >
            A+
          </button>
          <button
            onClick={fullScreen}
            className="fx-press rounded-[4px] border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper"
          >
            Full screen
          </button>
        </div>
      </header>

      {mode === "slides" ? (
        <div className="fx-fade flex flex-1 items-center justify-center overflow-hidden px-6">
          {slides[slide] && (
            <div
              key={slide}
              className="fx-fade max-w-prose font-reader leading-relaxed"
              style={{ fontSize: `${SIZES[size]}rem` }}
            >
              <SlideView slide={slides[slide]} />
            </div>
          )}
        </div>
      ) : (
        <div ref={scrollRef} className="fx-fade flex-1 overflow-y-auto">
          <div
            className="mx-auto max-w-prose px-6 py-10 font-reader leading-relaxed"
            style={{ fontSize: `${SIZES[size]}rem` }}
          >
            <h1 className="font-editorial mb-2 text-[1.4em] font-bold leading-tight">
              {doc.title}
            </h1>
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
      )}
    </div>
  );
}

/* One slide: a heading, a quotation, or a typed callout, set apart on its
 * own screen. The kind shows as a small-caps label except on headings,
 * which speak for themselves, and quotations keep the blockquote's hush. */
function SlideView({ slide }: { slide: SermonSlide }) {
  if (slide.kind === "heading") {
    return (
      <p className="font-editorial text-[1.3em] font-bold leading-tight">
        {renderInline(slide.text)}
      </p>
    );
  }
  if (slide.kind === "quote") {
    return (
      <p className="border-l-2 border-rule pl-6 italic text-muted">{renderInline(slide.text)}</p>
    );
  }
  return (
    <div>
      <p className="small-caps mb-2 text-[0.45em] text-muted">
        {CALLOUT_KINDS.find((k) => k.key === slide.kind)?.label}
      </p>
      <p className={slide.kind === "illustration" ? "italic" : ""}>{renderInline(slide.text)}</p>
    </div>
  );
}
