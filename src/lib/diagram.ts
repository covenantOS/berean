"use client";

import { collection, type Record_ } from "./store";

/**
 * The Sentence Diagram: grammatical analysis of a passage as an indented
 * block layout, the phrasing model of exegesis rather than the Reed-Kellogg
 * lattice. A diagram pins one passage (reference, text source, and the words
 * as fetched through /api/pane/diagram at creation, preserved as captured)
 * and holds the student's arrangement of its words. The arrangement is a
 * list of lines: each line carries an indent level and an ordered run of
 * chip ids, and each chip is one word of the passage. Breaking a passage
 * into lines marks its clauses; indenting a line marks its subordination.
 * That is the honest center of grammatical study over the tagged text, and
 * it prints as clean prose structure, which a free x/y surface cannot.
 *
 * Every chip carries the tagged data's own witness: the surface text, the
 * English gloss (original mode) or the Strong's ids (English mode), and the
 * decoded parsing as the POS hint. That witness is never editable; the data
 * stays true. The student's grammatical call rides beside it as an optional
 * label from a small set (DIAGRAM_LABELS), theirs alone.
 *
 * Sync means what it means everywhere else in the graph (src/lib/store.ts):
 * device-local persistence behind the one collection interface, with the
 * sync envelope fields carried from day one. Cross-device sync is Phase 2
 * (docs/adr/0002).
 */

/* ---------- the label set ---------- */

/**
 * The grammatical calls a chip can wear. Function labels first (the roles a
 * word plays in its clause), then the connective and appositive calls. The
 * set stays small on purpose: a label is a study note, not a parse, and the
 * tagged data already carries the parsing.
 */
export type DiagramLabel =
  | "subject"
  | "verb"
  | "object"
  | "indirect-object"
  | "complement"
  | "modifier"
  | "preposition"
  | "conjunction"
  | "appositive"
  | "vocative";

export const DIAGRAM_LABELS: { key: DiagramLabel; label: string }[] = [
  { key: "subject", label: "Subject" },
  { key: "verb", label: "Verb" },
  { key: "object", label: "Object" },
  { key: "indirect-object", label: "Indirect object" },
  { key: "complement", label: "Complement" },
  { key: "modifier", label: "Modifier" },
  { key: "preposition", label: "Preposition" },
  { key: "conjunction", label: "Conjunction" },
  { key: "appositive", label: "Appositive" },
  { key: "vocative", label: "Vocative" },
];

export function isDiagramLabel(s: string): s is DiagramLabel {
  return DIAGRAM_LABELS.some((l) => l.key === s);
}

/* ---------- the document ---------- */

/** One word of the passage, as captured at creation. */
export interface DiagramChip {
  id: string;
  /** The verse the word stands in. */
  verse: number;
  /** Surface text: the original word, or the KJV word in English mode. */
  text: string;
  /** Contextual English gloss (original mode), shown beneath the word. */
  gloss?: string;
  /** The tagged data's decoding ("verb aorist active indicative…"), the POS
   *  hint beneath the chip. Never editable. */
  pos?: string;
  /** Base Strong's ids the word carries. */
  strongs?: string[];
  /** The student's grammatical call; theirs alone. */
  label?: DiagramLabel;
}

/** One line of the layout: a clause or phrase at its indent, chips in order. */
export interface DiagramLine {
  id: string;
  /** Subordination depth, 0 (the main line) through MAX_INDENT. */
  indent: number;
  /** Chip ids in reading order. */
  chips: string[];
}

export interface DiagramDocument extends Record_ {
  name: string;
  /** Display form of the pinned passage, e.g. "John 3:16-18". */
  reference: string;
  /** Canon coordinates for the open-in-reader handoff. */
  book: string;
  chapter: number;
  from: number;
  to: number;
  /** The text source the words came from: the tagged original apparatus
   *  (TAHOT/TAGNT) or the Strong's-tagged KJV. */
  mode: "original" | "english";
  /** The chip text's language; Hebrew lines read right to left. */
  lang: "hebrew" | "greek" | "english";
  chips: DiagramChip[];
  lines: DiagramLine[];
}

export const diagrams = collection<DiagramDocument>("berean.diagrams.v1");

export const MAX_INDENT = 8;

/* ---------- pure arrangement transforms (shared by the writers, honest
 * enough for a harness to run without the store) ---------- */

/** Clamp an indent request to the honest bounds. */
export function clampIndent(indent: number): number {
  return Math.min(MAX_INDENT, Math.max(0, Math.round(indent)));
}

/** Set one line's indent; no change when the clamp lands where it already is. */
export function indentLine(lines: DiagramLine[], lineId: string, indent: number): DiagramLine[] {
  const next = clampIndent(indent);
  return lines.map((l) => (l.id === lineId && l.indent !== next ? { ...l, indent: next } : l));
}

/**
 * Break a line before a chip: the chips from that one onward become a new
 * line directly after, at the same indent. Breaking before the first chip
 * breaks nothing.
 */
export function splitLineAt(
  lines: DiagramLine[],
  lineId: string,
  chipId: string,
  newLineId: string
): DiagramLine[] {
  const i = lines.findIndex((l) => l.id === lineId);
  if (i < 0) return lines;
  const line = lines[i];
  const at = line.chips.indexOf(chipId);
  if (at <= 0) return lines;
  const head: DiagramLine = { ...line, chips: line.chips.slice(0, at) };
  const tail: DiagramLine = { id: newLineId, indent: line.indent, chips: line.chips.slice(at) };
  return [...lines.slice(0, i), head, tail, ...lines.slice(i + 1)];
}

/** Fold a line into the one above it; the first line has nothing to fold into. */
export function mergeLineUp(lines: DiagramLine[], lineId: string): DiagramLine[] {
  const i = lines.findIndex((l) => l.id === lineId);
  if (i <= 0) return lines;
  const prev = lines[i - 1];
  const line = lines[i];
  return [
    ...lines.slice(0, i - 1),
    { ...prev, chips: [...prev.chips, ...line.chips] },
    ...lines.slice(i + 1),
  ];
}

/**
 * Move a chip to a line at an index (the slot it lands before, in the
 * target's order after the chip leaves its home). A line the move empties
 * closes up. Out-of-range targets leave the layout alone.
 */
export function moveChipInLines(
  lines: DiagramLine[],
  chipId: string,
  toLineId: string,
  toIndex: number
): DiagramLine[] {
  const from = lines.findIndex((l) => l.chips.includes(chipId));
  const to = lines.findIndex((l) => l.id === toLineId);
  if (from < 0 || to < 0) return lines;
  let index = Math.max(0, toIndex);
  const without = lines
    .map((l) => (l.chips.includes(chipId) ? { ...l, chips: l.chips.filter((c) => c !== chipId) } : l))
    .filter((l) => l.chips.length > 0);
  const target = without.findIndex((l) => l.id === toLineId);
  if (target < 0) return lines;
  index = Math.min(index, without[target].chips.length);
  const line = without[target];
  const chips = [...line.chips.slice(0, index), chipId, ...line.chips.slice(index)];
  return without.map((l, i) => (i === target ? { ...l, chips } : l));
}

/* ---------- writes (read-modify-write through the one collection) ---------- */

function newId(): string {
  return crypto.randomUUID();
}

/**
 * The diagram arrives complete: the pane fetched the passage's words through
 * /api/pane/diagram and composed the chips and the opening layout (one line
 * per verse, flush left); the model stores what it is given.
 */
export function createDiagram(data: {
  name: string;
  reference: string;
  book: string;
  chapter: number;
  from: number;
  to: number;
  mode: "original" | "english";
  lang: "hebrew" | "greek" | "english";
  chips: DiagramChip[];
  lines: DiagramLine[];
}): DiagramDocument {
  return diagrams.create({ ...data, name: data.name.trim() || data.reference });
}

export function renameDiagram(docId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed) diagrams.update(docId, { name: trimmed });
}

export function setChipLabel(docId: string, chipId: string, label: DiagramLabel | undefined) {
  const doc = diagrams.get(docId);
  if (!doc) return;
  diagrams.update(docId, {
    chips: doc.chips.map((c) => (c.id === chipId ? { ...c, label } : c)),
  });
}

export function setLineIndent(docId: string, lineId: string, indent: number) {
  const doc = diagrams.get(docId);
  if (!doc) return;
  diagrams.update(docId, { lines: indentLine(doc.lines, lineId, indent) });
}

export function breakLine(docId: string, lineId: string, chipId: string) {
  const doc = diagrams.get(docId);
  if (!doc) return;
  diagrams.update(docId, { lines: splitLineAt(doc.lines, lineId, chipId, newId()) });
}

export function foldLineUp(docId: string, lineId: string) {
  const doc = diagrams.get(docId);
  if (!doc) return;
  diagrams.update(docId, { lines: mergeLineUp(doc.lines, lineId) });
}

export function moveChip(docId: string, chipId: string, toLineId: string, toIndex: number) {
  const doc = diagrams.get(docId);
  if (!doc) return;
  diagrams.update(docId, { lines: moveChipInLines(doc.lines, chipId, toLineId, toIndex) });
}
