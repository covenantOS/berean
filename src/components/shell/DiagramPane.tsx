"use client";

import { useState } from "react";
import {
  breakLine,
  createDiagram,
  DIAGRAM_LABELS,
  diagrams,
  foldLineUp,
  MAX_INDENT,
  moveChip,
  renameDiagram,
  setChipLabel,
  setLineIndent,
  type DiagramChip,
  type DiagramDocument,
  type DiagramLine,
} from "@/lib/diagram";
import { formatPassageRef, parsePassageRef } from "@/lib/documents";
import { useCollection, useRecord } from "@/lib/hooks";
import PrintButton from "./PrintButton";
import { useWorkspace } from "./WorkspaceContext";

/**
 * The Sentence Diagram pane: a passage's words arranged for grammatical
 * analysis, the indented-block (phrasing) model. Chips drag within and
 * between lines (HTML5 drag, a drop marker showing the slot); clicking a
 * chip opens the label tray beneath its line, where the student assigns a
 * grammatical call from the small set, clears it, or breaks the line before
 * the word. Line controls indent a line (its subordination) or fold it into
 * the line above. Every chip shows the tagged data's witness beneath the
 * word (gloss and decoded parsing in original mode, Strong's ids in English
 * mode); that witness is never editable. The whole report sits under
 * data-print-root with the shared PrintButton, the indented layout printing
 * as clean prose structure; SVG export stays out because the arrangement is
 * not spatial, it is typographic.
 */

/** The drag payload's MIME type; the workspace's tab drag never sets it. */
const CHIP_MIME = "application/x-berean-diagram-chip";

const CONTROL_BUTTON =
  "border border-rule bg-paper px-1.5 py-0.5 text-[0.66rem] leading-none text-muted hover:border-sapphire hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

export default function DiagramPane({ diagramId }: { diagramId: string }) {
  const { dispatch } = useWorkspace();
  const doc = useRecord(diagrams, diagramId);
  /** The chip whose label tray is open. */
  const [selected, setSelected] = useState<string | null>(null);
  /** The live drop slot during a chip drag. */
  const [dropHint, setDropHint] = useState<{ lineId: string; index: number } | null>(null);

  if (!doc) {
    return <p className="p-4 text-xs text-muted">This diagram is no longer on this device.</p>;
  }

  const chipsById = new Map(doc.chips.map((c) => [c.id, c]));
  const rtl = doc.lang === "hebrew";
  const source =
    doc.mode === "english"
      ? "Tagged KJV (Strong's)"
      : doc.lang === "hebrew"
        ? "Hebrew text: TAHOT"
        : "Greek text: TAGNT";

  /** Where a drag over a chip lands: the slot before or after it in array
   *  order. Right-to-left lines read the pointer the other way. */
  const slotOverChip = (e: React.DragEvent, chipIndex: number): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rightHalf = e.clientX - rect.left >= rect.width / 2;
    const after = rtl ? !rightHalf : rightHalf;
    return chipIndex + (after ? 1 : 0);
  };

  const onChipDragOver = (e: React.DragEvent, line: DiagramLine, chipIndex: number) => {
    if (!e.dataTransfer.types.includes(CHIP_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    setDropHint({ lineId: line.id, index: slotOverChip(e, chipIndex) });
  };

  const onLineDragOver = (e: React.DragEvent, line: DiagramLine) => {
    if (!e.dataTransfer.types.includes(CHIP_MIME)) return;
    e.preventDefault();
    setDropHint({ lineId: line.id, index: line.chips.length });
  };

  const onLineDrop = (e: React.DragEvent, line: DiagramLine) => {
    const chipId = e.dataTransfer.getData(CHIP_MIME);
    if (!chipId) return;
    e.preventDefault();
    let index = dropHint?.lineId === line.id ? dropHint.index : line.chips.length;
    // A chip moving within its own line: its departure closes a slot before
    // the landing slot, so the index steps down one.
    const fromLine = doc.lines.find((l) => l.chips.includes(chipId));
    if (fromLine && fromLine.id === line.id && fromLine.chips.indexOf(chipId) < index) {
      index -= 1;
    }
    moveChip(diagramId, chipId, line.id, index);
    setDropHint(null);
  };

  /** The line holding the selected chip, for the tray's break action. */
  const selectedLine = selected ? doc.lines.find((l) => l.chips.includes(selected)) : undefined;

  return (
    <div className="mx-auto max-w-4xl" data-print-root>
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Sentence Diagram</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">{doc.name}</h2>
        <p className="mt-0.5 flex items-center gap-3 text-[0.68rem] text-muted">
          <button
            type="button"
            title={`Open ${doc.reference} in the reader`}
            onClick={() => dispatch({ type: "openRef", book: doc.book, chapter: doc.chapter })}
            className="font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            {doc.reference}
          </button>
          <span>{source}</span>
          <span>
            {doc.chips.length} words · {doc.lines.length} lines
          </span>
        </p>
        <p className="no-print mt-1 flex items-center gap-3">
          <PrintButton />
        </p>
      </header>

      <p className="no-print mt-3 text-[0.7rem] leading-relaxed text-muted">
        Drag words to arrange the passage; click a word to label it or break
        its line. Indent a line to mark what it depends on. The parsing
        beneath each word is the tagged text's own and does not change.
      </p>

      <div className="mt-4 space-y-3">
        {doc.lines.map((line, lineIndex) => (
          <div key={line.id}>
            <div
              className="flex items-start gap-1"
              style={{ marginLeft: `${line.indent * 1.75}rem` }}
            >
              {/* The line's controls: subordination and the fold upward. */}
              <div className="no-print flex shrink-0 flex-col gap-0.5 pt-1">
                <button
                  type="button"
                  title="Indent this line one step (it depends on the line above)"
                  aria-label="Indent line"
                  disabled={line.indent >= MAX_INDENT}
                  onClick={() => setLineIndent(diagramId, line.id, line.indent + 1)}
                  className={`${CONTROL_BUTTON} disabled:opacity-30`}
                >
                  →
                </button>
                <button
                  type="button"
                  title="Outdent this line one step"
                  aria-label="Outdent line"
                  disabled={line.indent <= 0}
                  onClick={() => setLineIndent(diagramId, line.id, line.indent - 1)}
                  className={`${CONTROL_BUTTON} disabled:opacity-30`}
                >
                  ←
                </button>
                {lineIndex > 0 && (
                  <button
                    type="button"
                    title="Fold this line into the line above"
                    aria-label="Fold line into the line above"
                    onClick={() => foldLineUp(diagramId, line.id)}
                    className={CONTROL_BUTTON}
                  >
                    ↑
                  </button>
                )}
              </div>
              <div
                dir={rtl ? "rtl" : "ltr"}
                onDragOver={(e) => onLineDragOver(e, line)}
                onDrop={(e) => onLineDrop(e, line)}
                className="flex min-h-[3.25rem] min-w-0 flex-1 flex-wrap items-stretch gap-1 rounded-[3px]"
              >
                {line.chips.map((chipId, chipIndex) => {
                  const chip = chipsById.get(chipId);
                  if (!chip) return null;
                  return (
                    <span key={chipId} dir="ltr" className="contents">
                      {dropHint?.lineId === line.id && dropHint.index === chipIndex && (
                        <span className="no-print w-0.5 self-stretch bg-sapphire" aria-hidden />
                      )}
                      <ChipView
                        chip={chip}
                        doc={doc}
                        selected={selected === chip.id}
                        onClick={() => setSelected(selected === chip.id ? null : chip.id)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(CHIP_MIME, chip.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.stopPropagation();
                        }}
                        onDragOver={(e) => onChipDragOver(e, line, chipIndex)}
                      />
                    </span>
                  );
                })}
                {dropHint?.lineId === line.id && dropHint.index === line.chips.length && (
                  <span className="no-print w-0.5 self-stretch bg-sapphire" aria-hidden />
                )}
              </div>
            </div>
            {selected && selectedLine?.id === line.id && (
              <LabelTray
                key={selected}
                chip={chipsById.get(selected)!}
                onLabel={(label) => setChipLabel(diagramId, selected, label)}
                onBreak={() => {
                  breakLine(diagramId, line.id, selected);
                  setSelected(null);
                }}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One word of the passage: the surface text with the tagged data's witness
 *  beneath and the student's label above, draggable between slots. The drop
 *  itself bubbles to the line container, which reads the live drop hint. */
function ChipView({
  chip,
  doc,
  selected,
  onClick,
  onDragStart,
  onDragOver,
}: {
  chip: DiagramChip;
  doc: DiagramDocument;
  selected: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}) {
  const langClass =
    doc.lang === "hebrew" ? "lang-hebrew" : doc.lang === "greek" ? "lang-greek" : "font-reader";
  const hint =
    doc.mode === "english"
      ? (chip.strongs ?? []).join(" ")
      : [chip.pos, ...(chip.strongs ?? [])].filter(Boolean).join(" · ");
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Word ${chip.text}`}
      title="Drag to move; click to label"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`flex cursor-grab select-none flex-col items-center rounded-[3px] border bg-paper px-1.5 py-1 ${
        selected ? "border-sapphire" : "border-rule"
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire`}
    >
      <span className="small-caps min-h-[0.7rem] text-[0.58rem] font-semibold leading-none text-amber">
        {chip.label ? (DIAGRAM_LABELS.find((l) => l.key === chip.label)?.label ?? chip.label) : ""}
      </span>
      <span className={`${langClass} text-sm leading-tight text-ink`}>{chip.text}</span>
      {chip.gloss && <span className="text-[0.62rem] leading-tight text-muted">{chip.gloss}</span>}
      {hint && <span className="max-w-[7rem] text-center text-[0.56rem] leading-tight text-muted">{hint}</span>}
    </div>
  );
}

/** The tray beneath a line when one of its chips is selected: the label set,
 *  a clear, and the line break before the word. */
function LabelTray({
  chip,
  onLabel,
  onBreak,
  onClose,
}: {
  chip: DiagramChip;
  onLabel: (label: DiagramChip["label"]) => void;
  onBreak: () => void;
  onClose: () => void;
}) {
  return (
    <div className="no-print mt-1 flex flex-wrap items-center gap-1 rounded-[3px] border border-rule bg-surface px-2 py-1.5">
      <span className="small-caps mr-1 text-[0.62rem] font-semibold text-muted">
        Label “{chip.text}”
      </span>
      {DIAGRAM_LABELS.map((l) => (
        <button
          key={l.key}
          type="button"
          aria-pressed={chip.label === l.key}
          onClick={() => onLabel(chip.label === l.key ? undefined : l.key)}
          className={`${CONTROL_BUTTON} ${
            chip.label === l.key ? "border-amber text-amber" : "text-ink"
          }`}
        >
          {l.label}
        </button>
      ))}
      {chip.label && (
        <button type="button" onClick={() => onLabel(undefined)} className={CONTROL_BUTTON}>
          Clear
        </button>
      )}
      <span className="mx-1 h-4 w-px bg-rule" aria-hidden />
      <button
        type="button"
        title="Break the line so this word starts a new line"
        onClick={onBreak}
        className={CONTROL_BUTTON}
      >
        Break line before
      </button>
      <button type="button" onClick={onClose} className={CONTROL_BUTTON}>
        Done
      </button>
    </div>
  );
}

/**
 * The Documents rail's diagrams section: the create form (a reference and
 * its text source, fetched through /api/pane/diagram so the words arrive in
 * order with their parsing) and the saved diagrams with open, rename inline,
 * and delete. A deleted diagram leaves its open tabs to degrade in place,
 * the way a deleted canvas does.
 */
export function DiagramsSection() {
  const { dispatch } = useWorkspace();
  const docs = useCollection(diagrams);
  const [refInput, setRefInput] = useState("");
  const [mode, setMode] = useState<"original" | "english">("original");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The diagram being renamed, with its draft. */
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);

  /* Creation: the typed reference parses through the shared parser, the
   * words come from the tagged apparatus in one round trip, and the opening
   * layout is one flush-left line per verse. A reference that does not
   * parse, or one the apparatus cannot answer, says so in place. */
  const openNew = async () => {
    const parsed = parsePassageRef(refInput);
    if (!parsed) {
      setError("Give a reference like John 3:16-18.");
      return;
    }
    const from = parsed.from ?? 1;
    const to = parsed.to ?? parsed.from ?? 999;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pane/diagram?book=${encodeURIComponent(parsed.book)}&chapter=${parsed.chapter}&from=${from}&to=${to}&mode=${mode}`
      );
      const data = (await res.json()) as
        | {
            book: string;
            chapter: number;
            from: number;
            to: number;
            mode: "original" | "english";
            lang: "hebrew" | "greek" | "english";
            words: { verse: number; t: string; gloss: string | null; pos: string | null; strongs: string[] }[];
          }
        | { error: string };
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "The text did not answer that reference.");
        return;
      }
      if (data.words.length === 0) {
        setError("The text did not answer that reference.");
        return;
      }
      const chips: DiagramChip[] = data.words.map((w) => ({
        id: crypto.randomUUID(),
        verse: w.verse,
        text: w.t,
        ...(w.gloss ? { gloss: w.gloss } : {}),
        ...(w.pos ? { pos: w.pos } : {}),
        ...(w.strongs.length > 0 ? { strongs: w.strongs } : {}),
      }));
      // The opening layout: one line per verse, flush left.
      const lines: DiagramLine[] = [];
      let currentVerse = -1;
      for (const chip of chips) {
        if (chip.verse !== currentVerse) {
          lines.push({ id: crypto.randomUUID(), indent: 0, chips: [] });
          currentVerse = chip.verse;
        }
        lines[lines.length - 1].chips.push(chip.id);
      }
      const reference = formatPassageRef(parsed);
      const doc = createDiagram({
        name: reference,
        reference,
        book: data.book,
        chapter: data.chapter,
        from: data.from,
        to: data.to,
        mode: data.mode,
        lang: data.lang,
        chips,
        lines,
      });
      setRefInput("");
      dispatch({ type: "openDiagram", diagramId: doc.id, title: doc.name });
    } catch {
      setError("The passage could not be fetched.");
    } finally {
      setBusy(false);
    }
  };

  const commitRename = () => {
    if (renaming) renameDiagram(renaming.id, renaming.draft);
    setRenaming(null);
  };

  return (
    <div className="border-b border-rule py-1">
      <div className="flex items-baseline justify-between px-3 pt-2 pb-1">
        <span className="small-caps text-[0.62rem] font-semibold text-muted">Diagrams</span>
      </div>
      <div className="flex items-center gap-1 px-3 pb-1">
        <input
          value={refInput}
          aria-label="Passage reference"
          placeholder="John 3:16-18"
          onChange={(e) => setRefInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void openNew();
          }}
          className="min-w-0 flex-1 border border-rule bg-paper px-1 py-0.5 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <select
          value={mode}
          aria-label="Text source"
          title="The words the diagram is built from"
          onChange={(e) => setMode(e.target.value as "original" | "english")}
          className="border border-rule bg-paper px-1 py-0.5 text-[0.7rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        >
          <option value="original">Original</option>
          <option value="english">KJV</option>
        </select>
        <button
          type="button"
          onClick={() => void openNew()}
          disabled={busy || !refInput.trim()}
          title="Fetch the passage and start its diagram"
          className="shrink-0 text-[0.62rem] text-sapphire hover:underline disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {busy ? "Fetching…" : "New diagram"}
        </button>
      </div>
      {error && <p className="px-3 pb-1 text-[0.68rem] text-ruby">{error}</p>}
      {docs.length === 0 ? (
        <p className="px-3 pb-1 text-[0.7rem] leading-relaxed text-muted">
          No diagrams yet. A diagram lays a passage's words out for
          grammatical analysis: lines for clauses, indents for subordination,
          labels for the calls, the tagged parsing always in view.
        </p>
      ) : (
        <ul>
          {docs.map((d) =>
            renaming?.id === d.id ? (
              <li key={d.id} className="flex items-center gap-1.5 px-3 py-[3px]">
                <input
                  autoFocus
                  value={renaming.draft}
                  aria-label="Diagram name"
                  onChange={(e) => setRenaming({ id: d.id, draft: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="min-w-0 flex-1 border border-rule bg-paper px-1 py-0.5 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
                />
              </li>
            ) : (
              <li key={d.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "openDiagram", diagramId: d.id, title: d.name })}
                  title={`Open ${d.name}`}
                  className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {d.name}
                </button>
                <span className="shrink-0 text-[0.62rem] text-muted">{d.chips.length}</span>
                <button
                  type="button"
                  onClick={() => setRenaming({ id: d.id, draft: d.name })}
                  title={`Rename ${d.name}`}
                  className="shrink-0 px-1 text-[0.62rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => diagrams.remove(d.id)}
                  title="Delete this diagram"
                  aria-label={`Delete ${d.name}`}
                  className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  ×
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
