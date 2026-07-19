"use client";

import { collection, type Record_ } from "./store";

/**
 * The Canvas: an infinite whiteboard for visual study. A canvas document is
 * a name and a flat set of items on an unbounded surface. Text cards carry
 * editable prose; passage cards carry a reference with the text snapshot and
 * citation fetched at insert time (the words stay put even where the shipped
 * text is not at hand); shapes are rectangles and ellipses in the stained
 * glass palette; connectors join two items by id and follow them as they
 * move. Items carry x/y and w/h in world coordinates; connectors carry only
 * their endpoints. Deleting an item takes its connectors with it.
 *
 * Sync means what it means everywhere else in the graph (src/lib/store.ts):
 * device-local persistence behind the one collection interface, with the
 * sync envelope fields carried from day one. Cross-device sync is Phase 2
 * (docs/adr/0002).
 */

/* ---------- items ---------- */

interface ItemBase {
  id: string;
  /** World coordinates of the item's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A card of the user's own prose, edited in place. */
export interface TextCard extends ItemBase {
  kind: "text";
  text: string;
}

/** A passage laid on the canvas: the text snapshot with its citation,
 *  fetched through /api/passages at insert time and preserved as captured. */
export interface PassageCard extends ItemBase {
  kind: "passage";
  /** Display form, e.g. "John 3:16-18". */
  reference: string;
  /** The citation generated at insert, never typed by hand. */
  citation: string;
  /** The verses as fetched, joined into one prose block. */
  text: string;
  /** Canon coordinates for the open-in-reader handoff. */
  book: string;
  chapter: number;
}

export type ShapeKind = "rect" | "ellipse";

/** A rectangle or ellipse washed with a stained-glass color. */
export interface ShapeItem extends ItemBase {
  kind: "shape";
  shape: ShapeKind;
  color: StainedKey;
}

/** A line between two items, by id; it follows them when they are dragged. */
export interface ConnectorItem {
  id: string;
  kind: "connector";
  from: string;
  to: string;
}

export type CanvasItem = TextCard | PassageCard | ShapeItem | ConnectorItem;

/** An item that occupies space on the surface; connectors do not. */
export type PlacedItem = TextCard | PassageCard | ShapeItem;

export interface CanvasDocument extends Record_ {
  name: string;
  items: CanvasItem[];
}

export const canvases = collection<CanvasDocument>("berean.canvases.v1");

/* ---------- the stained-glass palette, as hex for ink and export ---------- */

export type StainedKey = "sapphire" | "ruby" | "amber" | "emerald" | "violet";

export const STAINED_COLORS: { key: StainedKey; label: string; hex: string }[] = [
  { key: "sapphire", label: "Sapphire", hex: "#2d5977" },
  { key: "ruby", label: "Ruby", hex: "#7d2d3e" },
  { key: "amber", label: "Amber", hex: "#a97a1f" },
  { key: "emerald", label: "Emerald", hex: "#3d6b52" },
  { key: "violet", label: "Violet", hex: "#5d4a78" },
];

export function stainedHex(key: StainedKey): string {
  return STAINED_COLORS.find((c) => c.key === key)?.hex ?? STAINED_COLORS[0].hex;
}

/* ---------- sizes ---------- */

export const TEXT_CARD_SIZE = { w: 260, h: 150 };
export const PASSAGE_CARD_SIZE = { w: 300, h: 190 };
export const SHAPE_SIZE = { w: 180, h: 120 };
export const MIN_ITEM_SIZE = { w: 120, h: 70 };

/* ---------- geometry ---------- */

/** The item's center in world coordinates, where connectors attach. */
export function itemCenter(item: PlacedItem): { x: number; y: number } {
  return { x: item.x + item.w / 2, y: item.y + item.h / 2 };
}

/**
 * The connector's path: a gentle quadratic bow between the two endpoints,
 * the control point set off the straight line by a quarter of its length,
 * capped so near neighbors stay calm. Shared by the live SVG layer and the
 * image export so the two always draw the same line.
 */
export function connectorD(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.min(60, len / 4);
  const cx = (a.x + b.x) / 2 - (dy / len) * off;
  const cy = (a.y + b.y) / 2 + (dx / len) * off;
  return `M ${round(a.x)} ${round(a.y)} Q ${round(cx)} ${round(cy)} ${round(b.x)} ${round(b.y)}`;
}

/** The connector with its endpoints resolved to item centers; undefined when
 *  an endpoint answers to no placed item (the model keeps them clean, but a
 *  hand-edited graph may not). */
export function resolveConnector(
  doc: CanvasDocument,
  conn: ConnectorItem
): { a: { x: number; y: number }; b: { x: number; y: number } } | undefined {
  const from = doc.items.find((it): it is PlacedItem => it.id === conn.from && it.kind !== "connector");
  const to = doc.items.find((it): it is PlacedItem => it.id === conn.to && it.kind !== "connector");
  if (!from || !to) return undefined;
  return { a: itemCenter(from), b: itemCenter(to) };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------- the view (pan and zoom math, pure for the harness) ---------- */

export interface CanvasView {
  /** Screen-space offset of the world origin, in pixels. */
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_VIEW: CanvasView = { x: 0, y: 0, zoom: 1 };
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2.5;

/**
 * Zoom toward a screen point (the cursor, or the surface's center): the
 * world point under it stays put. The zoom clamps to honest bounds, far
 * enough out to survey a study and in enough to read a card.
 */
export function zoomAtPoint(view: CanvasView, px: number, py: number, nextZoom: number): CanvasView {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
  if (zoom === view.zoom) return view;
  const scale = zoom / view.zoom;
  return {
    x: px - (px - view.x) * scale,
    y: py - (py - view.y) * scale,
    zoom,
  };
}

/** Screen to world coordinates under the current view. */
export function screenToWorld(view: CanvasView, px: number, py: number): { x: number; y: number } {
  return { x: (px - view.x) / view.zoom, y: (py - view.y) / view.zoom };
}

/* ---------- writes (read-modify-write through the one collection) ---------- */

function newItemId(): string {
  return crypto.randomUUID();
}

function writeItems(docId: string, items: CanvasItem[]) {
  canvases.update(docId, { items });
}

export function createCanvas(name: string): CanvasDocument {
  return canvases.create({ name: name.trim() || "Untitled canvas", items: [] });
}

export function renameCanvas(docId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed) canvases.update(docId, { name: trimmed });
}

export function addTextCard(docId: string, at: { x: number; y: number }): CanvasDocument | undefined {
  const doc = canvases.get(docId);
  if (!doc) return undefined;
  const item: TextCard = { id: newItemId(), kind: "text", ...at, ...TEXT_CARD_SIZE, text: "" };
  writeItems(docId, [...doc.items, item]);
  return canvases.get(docId);
}

/** The passage arrives complete: the pane fetched the text and composed the
 *  citation at insert time; the model stores what it is given. */
export function addPassageCard(
  docId: string,
  at: { x: number; y: number },
  data: { reference: string; citation: string; text: string; book: string; chapter: number }
): CanvasDocument | undefined {
  const doc = canvases.get(docId);
  if (!doc) return undefined;
  const item: PassageCard = { id: newItemId(), kind: "passage", ...at, ...PASSAGE_CARD_SIZE, ...data };
  writeItems(docId, [...doc.items, item]);
  return canvases.get(docId);
}

export function addShape(
  docId: string,
  shape: ShapeKind,
  color: StainedKey,
  at: { x: number; y: number }
): CanvasDocument | undefined {
  const doc = canvases.get(docId);
  if (!doc) return undefined;
  const item: ShapeItem = { id: newItemId(), kind: "shape", shape, color, ...at, ...SHAPE_SIZE };
  writeItems(docId, [...doc.items, item]);
  return canvases.get(docId);
}

/** A connector joins two placed items. The same pair, in either order, is
 *  not repeated; a connector never joins a connector. */
export function addConnector(docId: string, fromId: string, toId: string): CanvasDocument | undefined {
  const doc = canvases.get(docId);
  if (!doc || fromId === toId) return undefined;
  const placed = (id: string) =>
    doc.items.some((it) => it.id === id && it.kind !== "connector");
  if (!placed(fromId) || !placed(toId)) return undefined;
  const dupe = doc.items.some(
    (it) =>
      it.kind === "connector" &&
      ((it.from === fromId && it.to === toId) || (it.from === toId && it.to === fromId))
  );
  if (dupe) return undefined;
  const item: ConnectorItem = { id: newItemId(), kind: "connector", from: fromId, to: toId };
  writeItems(docId, [...doc.items, item]);
  return canvases.get(docId);
}

export function moveItem(docId: string, itemId: string, x: number, y: number) {
  const doc = canvases.get(docId);
  if (!doc) return;
  writeItems(
    docId,
    doc.items.map((it) =>
      it.id === itemId && it.kind !== "connector" ? { ...it, x: Math.round(x), y: Math.round(y) } : it
    )
  );
}

export function resizeItem(docId: string, itemId: string, w: number, h: number) {
  const doc = canvases.get(docId);
  if (!doc) return;
  writeItems(
    docId,
    doc.items.map((it) =>
      it.id === itemId && it.kind !== "connector"
        ? {
            ...it,
            w: Math.max(MIN_ITEM_SIZE.w, Math.round(w)),
            h: Math.max(MIN_ITEM_SIZE.h, Math.round(h)),
          }
        : it
    )
  );
}

export function setCardText(docId: string, itemId: string, text: string) {
  const doc = canvases.get(docId);
  if (!doc) return;
  writeItems(
    docId,
    doc.items.map((it) => (it.id === itemId && it.kind === "text" ? { ...it, text } : it))
  );
}

/** Deleting an item takes its connectors with it. */
export function removeItem(docId: string, itemId: string) {
  const doc = canvases.get(docId);
  if (!doc) return;
  writeItems(
    docId,
    doc.items.filter(
      (it) =>
        it.id !== itemId &&
        !(it.kind === "connector" && (it.from === itemId || it.to === itemId))
    )
  );
}

/* ---------- export: the canvas as a standalone SVG image ---------- */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Approximate word wrap for the export's serif, the verse card's measure. */
function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (trial.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const SERIF = `'EB Garamond','Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif`;
const PAPER = "#faf5e9";
const CARD = "#fffdf8";
const RULE = "#d9cdb4";
const INK = "#262016";
const MUTED = "#6d5f4b";

/** A card's prose as SVG text lines, clipped to what the card's height
 *  honestly holds; an ellipsis marks what the card itself scrolls to show. */
function cardTextLines(
  text: string,
  x: number,
  y: number,
  w: number,
  maxLines: number,
  fontSize: number,
  lineHeight: number
): string {
  const pad = 12;
  const maxChars = Math.max(8, Math.floor((w - pad * 2) / (fontSize * 0.5)));
  const lines = wrapLines(text, maxChars);
  const clipped = lines.slice(0, Math.max(1, maxLines));
  if (lines.length > clipped.length) {
    clipped[clipped.length - 1] = `${clipped[clipped.length - 1].replace(/[. ]+$/, "")}…`;
  }
  return clipped
    .map(
      (line, i) =>
        `  <text x="${round(x + pad)}" y="${round(y + i * lineHeight)}" font-family="${SERIF}" font-size="${fontSize}" fill="${INK}">${escapeXml(line)}</text>`
    )
    .join("\n");
}

/**
 * The canvas as a standalone SVG sheet: every card and shape laid out at its
 * world position, connectors beneath, the canvas's name in the corner, on
 * the reader's paper. Pure string building, the verse card's precedent
 * (src/lib/verseCard.ts), so it is safe from client or server code. An empty
 * canvas exports an empty sheet under its name.
 */
export function canvasSvg(doc: CanvasDocument): string {
  const placed = doc.items.filter((it): it is PlacedItem => it.kind !== "connector");
  const margin = 48;
  const captionH = 34;
  let minX = 0;
  let minY = 0;
  let maxX = 800;
  let maxY = 600;
  if (placed.length > 0) {
    minX = Math.min(...placed.map((it) => it.x));
    minY = Math.min(...placed.map((it) => it.y));
    maxX = Math.max(...placed.map((it) => it.x + it.w));
    maxY = Math.max(...placed.map((it) => it.y + it.h));
  }
  const ox = minX - margin;
  const oy = minY - margin - captionH;
  const W = round(maxX - minX + margin * 2);
  const H = round(maxY - minY + margin * 2 + captionH);
  const at = (x: number, y: number) => ({ x: round(x - ox), y: round(y - oy) });

  const parts: string[] = [];
  /* Connectors first, beneath the cards as on the surface. */
  for (const it of doc.items) {
    if (it.kind !== "connector") continue;
    const ends = resolveConnector(doc, it);
    if (!ends) continue;
    const a = at(ends.a.x, ends.a.y);
    const b = at(ends.b.x, ends.b.y);
    parts.push(
      `  <path d="${connectorD(a, b)}" fill="none" stroke="${MUTED}" stroke-width="2"/>`
    );
  }
  for (const it of placed) {
    const p = at(it.x, it.y);
    if (it.kind === "shape") {
      const hex = stainedHex(it.color);
      if (it.shape === "ellipse") {
        parts.push(
          `  <ellipse cx="${round(p.x + it.w / 2)}" cy="${round(p.y + it.h / 2)}" rx="${round(it.w / 2)}" ry="${round(it.h / 2)}" fill="${hex}" fill-opacity="0.12" stroke="${hex}" stroke-width="2"/>`
        );
      } else {
        parts.push(
          `  <rect x="${p.x}" y="${p.y}" width="${it.w}" height="${it.h}" fill="${hex}" fill-opacity="0.12" stroke="${hex}" stroke-width="2"/>`
        );
      }
      continue;
    }
    parts.push(
      `  <rect x="${p.x}" y="${p.y}" width="${it.w}" height="${it.h}" fill="${CARD}" stroke="${RULE}" stroke-width="1.5"/>`
    );
    if (it.kind === "text") {
      parts.push(cardTextLines(it.text, p.x, p.y + 26, it.w, Math.floor((it.h - 36) / 18), 13, 18));
    } else {
      parts.push(
        `  <text x="${round(p.x + 12)}" y="${round(p.y + 22)}" font-family="${SERIF}" font-size="11" letter-spacing="2" fill="${stainedHex("sapphire")}">${escapeXml(it.reference.toUpperCase())}</text>`,
        cardTextLines(it.text, p.x, p.y + 44, it.w, Math.floor((it.h - 76) / 17), 12, 17),
        `  <text x="${round(p.x + 12)}" y="${round(p.y + it.h - 10)}" font-family="${SERIF}" font-size="11" fill="${MUTED}">${escapeXml(it.citation)}</text>`
      );
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `  <rect width="${W}" height="${H}" fill="${PAPER}"/>`,
    `  <text x="${margin}" y="${captionH - 8}" font-family="${SERIF}" font-size="15" letter-spacing="3" fill="${MUTED}">${escapeXml(doc.name.toUpperCase())}</text>`,
    ...parts,
    `</svg>`,
    "",
  ].join("\n");
}
