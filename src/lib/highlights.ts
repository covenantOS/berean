"use client";

import { collection, type Record_ } from "./store";

/**
 * Verse highlights: named styles worn on the text, following the marginalia
 * pattern. A highlight is one style mark on one verse; the style it wears
 * lives in the highlight-styles collection (a name, a color from the
 * stained-glass palette or a custom hex, and an effect), so editing a style
 * re-renders every verse wearing it. The four original tints survive as
 * built-in styles, and old records carrying only a tint map onto them and
 * render identically. Device-local and private by default (docs/adr/0001
 * §3); the sync envelope rides along from day one so ADR 0002 sync can
 * adopt the collections without a migration. One style per verse.
 */

export type HighlightColor = "amber" | "sapphire" | "emerald" | "ruby";

export const HIGHLIGHT_COLORS: HighlightColor[] = ["amber", "sapphire", "emerald", "ruby"];

/** What a style does to the verse's text. */
export type HighlightEffect = "background" | "underline" | "bold" | "outline";

export const HIGHLIGHT_EFFECTS: { key: HighlightEffect; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "underline", label: "Underline" },
  { key: "bold", label: "Bold" },
  { key: "outline", label: "Outline" },
];

/** The palette the style editor offers, beside a custom hex. */
export const STYLE_PALETTE = ["amber", "sapphire", "emerald", "ruby", "violet"] as const;

export interface HighlightStyle extends Record_ {
  name: string;
  /** A stained-glass palette key or a custom hex (#rrggbb). */
  color: string;
  effect: HighlightEffect;
}

/** A style as the reader resolves it: a stored custom or a built-in tint. */
export interface ResolvedStyle {
  id: string;
  name: string;
  color: string;
  effect: HighlightEffect;
  /** Built-ins keep their legacy per-color class, so old marks render identically. */
  builtin?: true;
}

/** The four original tints, addressed by stable ids a stored record may name. */
export const BUILTIN_STYLES: ResolvedStyle[] = HIGHLIGHT_COLORS.map((c) => ({
  id: `builtin-${c}`,
  name: c[0].toUpperCase() + c.slice(1),
  color: c,
  effect: "background" as const,
  builtin: true as const,
}));

const highlightStyles = collection<HighlightStyle>("berean.highlightstyles.v1");
export { highlightStyles };

/** Every style the palette offers: the built-in tints, then the customs. */
export function listStyles(customs?: HighlightStyle[]): ResolvedStyle[] {
  return [...BUILTIN_STYLES, ...(customs ?? highlightStyles.list())];
}

export interface VerseHighlight extends Record_ {
  book: string; // canon slug
  chapter: number;
  verse: number;
  /** The worn style. New marks carry this; old records carry only color. */
  styleId?: string;
  /** The legacy tint. Old records resolve through it onto a built-in style. */
  color?: HighlightColor;
}

const highlights = collection<VerseHighlight>("berean.highlights.v1");
export { highlights };

export function listHighlights(book?: string, chapter?: number): VerseHighlight[] {
  return highlights.list(
    (h) => (!book || h.book === book) && (chapter === undefined || h.chapter === chapter)
  );
}

export function highlightForVerse(
  book: string,
  chapter: number,
  verse: number
): VerseHighlight | undefined {
  return highlights.list((h) => h.book === book && h.chapter === chapter && h.verse === verse)[0];
}

/** Sets the verse's style, replacing any existing mark. */
export function setHighlight(
  book: string,
  chapter: number,
  verse: number,
  styleId: string
): VerseHighlight {
  const existing = highlightForVerse(book, chapter, verse);
  if (existing) {
    if (existing.styleId === styleId) return existing;
    return highlights.update(existing.id, { styleId }) ?? existing;
  }
  return highlights.create({ book, chapter, verse, styleId });
}

export function clearHighlight(book: string, chapter: number, verse: number) {
  const existing = highlightForVerse(book, chapter, verse);
  if (existing) highlights.remove(existing.id);
}

/**
 * The style a mark wears: its styleId first, its legacy tint mapped onto
 * the built-ins second. A mark naming a style that no longer exists wears
 * nothing; the style editor's delete unmaps its verses, so this is the
 * stray-import path, not the ordinary one.
 */
export function resolveStyle(
  h: VerseHighlight,
  styles: ResolvedStyle[] = listStyles()
): ResolvedStyle | undefined {
  if (h.styleId) return styles.find((s) => s.id === h.styleId);
  if (h.color) return styles.find((s) => s.id === `builtin-${h.color}`);
  return undefined;
}

/** Creates a custom style; the palette offers it from the next render. */
export function createStyle(
  name: string,
  color: string,
  effect: HighlightEffect
): HighlightStyle {
  return highlightStyles.create({ name, color, effect });
}

/**
 * Deletes a custom style and unmaps its verses: the marks wearing it are
 * removed outright, the honest answer the editor's confirm names. Built-in
 * styles live outside the collection and cannot reach here.
 */
export function deleteStyle(id: string) {
  for (const h of highlights.list((h) => h.styleId === id)) highlights.remove(h.id);
  highlightStyles.remove(id);
}

/** The color a style names, as CSS: a palette variable or the custom hex. */
export function styleColor(style: ResolvedStyle): string {
  return style.color.startsWith("#") ? style.color : `var(--stained-${style.color})`;
}

/** The verse classes a resolved style asks for. */
export function styleClass(style: ResolvedStyle): string {
  return style.builtin ? `hl-${style.color}` : `hl-mark hl-${style.effect}`;
}

/**
 * The inline custom property a non-builtin style asks for; the effect
 * classes in globals.css read --hl-color. Undefined for built-ins, which
 * carry their color in the legacy class.
 */
export function styleColorVar(style: ResolvedStyle): Record<string, string> | undefined {
  return style.builtin ? undefined : { "--hl-color": styleColor(style) };
}

/** The swatch a style wears in pickers, as inline style properties. */
export function styleSwatch(style: ResolvedStyle): Record<string, string> {
  const color = styleColor(style);
  if (style.effect === "underline") return { boxShadow: `inset 0 -0.3em 0 ${color}` };
  if (style.effect === "bold") return { color };
  if (style.effect === "outline") return { boxShadow: `inset 0 0 0 1.5px ${color}` };
  return { background: style.builtin ? color : `color-mix(in srgb, ${color} 45%, transparent)` };
}
