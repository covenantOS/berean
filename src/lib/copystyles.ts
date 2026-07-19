"use client";

/**
 * Copy styles: how a copied passage arranges itself for the clipboard. A
 * style is a name and five choices (reference before, after, or none; a
 * translation tag; verse numbers; one verse per line or flowing; quotation
 * marks), and every copy path (the verse menus, the context strip, list
 * copy-all, Power Lookup) formats through the one active style so the choice
 * holds app-wide. The two built-ins carry the retired binary citation
 * setting: Text first and Citation first format a single verse byte-
 * identically to the old forms, and the old key still resolves onto them
 * when no style has been picked. Customs live in a device-local collection
 * and ride the export, import, and delete in the Settings tab. Copies write
 * a styled text/html form beside the plain text where the clipboard takes
 * rich items, so Word and email paste the formatting.
 */

import { collection, type Record_ } from "./store";

/* The retired binary setting, kept as the fallback when no style has been
 * picked and rewritten whenever a built-in is picked, so anything still
 * reading it agrees with the picker. */
export const CITATION_STYLE_KEY = "berean.citationStyle.v1";

export type CitationStyle = "text-first" | "citation-first";

export function citationStyle(): CitationStyle {
  if (typeof window === "undefined") return "text-first";
  return window.localStorage.getItem(CITATION_STYLE_KEY) === "citation-first"
    ? "citation-first"
    : "text-first";
}

/** Where the reference sits relative to the text. */
export type ReferencePosition = "before" | "after" | "none";

export const REFERENCE_POSITIONS: { key: ReferencePosition; label: string }[] = [
  { key: "before", label: "Before the text" },
  { key: "after", label: "After the text" },
  { key: "none", label: "No reference" },
];

export interface CopyStyle {
  name: string;
  referencePosition: ReferencePosition;
  /** Append the translation to the reference when the copy site knows it. */
  translationTag: boolean;
  /** Prefix each verse with its number. */
  verseNumbers: boolean;
  /** One verse per line; off flows the verses into one paragraph. */
  versePerLine: boolean;
  /** Wrap the text in quotation marks. */
  quotationMarks: boolean;
}

export interface CopyStyleRecord extends Record_, CopyStyle {}

/** A style as the copy paths resolve it: a stored custom or a built-in. */
export interface ResolvedCopyStyle extends CopyStyle {
  id: string;
  builtin?: true;
}

/**
 * The two forms the retired binary setting knew, addressed by stable ids a
 * picked style may name. Both keep the old choices: reference placed, tagged
 * when the translation is known, no verse numbers, flowing, unquoted.
 */
export const BUILTIN_COPY_STYLES: ResolvedCopyStyle[] = [
  {
    id: "builtin-text-first",
    name: "Text first",
    referencePosition: "after",
    translationTag: true,
    verseNumbers: false,
    versePerLine: false,
    quotationMarks: false,
    builtin: true,
  },
  {
    id: "builtin-citation-first",
    name: "Citation first",
    referencePosition: "before",
    translationTag: true,
    verseNumbers: false,
    versePerLine: false,
    quotationMarks: false,
    builtin: true,
  },
];

const copyStyles = collection<CopyStyleRecord>("berean.copystyles.v1");
export { copyStyles };

/** The picked style, a device-local scalar like the display prefs. */
export const ACTIVE_COPY_STYLE_KEY = "berean.copystyle.active.v1";

/** Every style the picker offers: the built-ins, then the customs. */
export function listCopyStyles(customs?: CopyStyleRecord[]): ResolvedCopyStyle[] {
  return [...BUILTIN_COPY_STYLES, ...(customs ?? copyStyles.list())];
}

/**
 * The style every copy path honors: the picked style first, the legacy
 * binary choice mapped onto its built-in otherwise, so a device that never
 * opens the editor copies exactly as it did before.
 */
export function activeCopyStyle(styles?: ResolvedCopyStyle[]): ResolvedCopyStyle {
  const all = styles ?? listCopyStyles();
  if (typeof window !== "undefined") {
    const id = window.localStorage.getItem(ACTIVE_COPY_STYLE_KEY);
    const picked = id ? all.find((s) => s.id === id) : undefined;
    if (picked) return picked;
  }
  return all.find((s) => s.id === `builtin-${citationStyle()}`) ?? all[0];
}

/**
 * Sets the style every copy path honors. A built-in pick also rewrites the
 * legacy key, so the fallback and anything still reading it stay in step.
 */
export function setActiveCopyStyle(id: string) {
  window.localStorage.setItem(ACTIVE_COPY_STYLE_KEY, id);
  if (id === "builtin-text-first" || id === "builtin-citation-first") {
    window.localStorage.setItem(CITATION_STYLE_KEY, id.slice("builtin-".length));
  }
}

/** Creates a custom style; the picker offers it from the next render. */
export function createCopyStyle(fields: CopyStyle): CopyStyleRecord {
  return copyStyles.create(fields);
}

/**
 * Deletes a custom style. When the deleted style was active, the pick is
 * cleared and copies fall back to the legacy built-in, the honest answer the
 * editor's confirm names. Built-ins live outside the collection and cannot
 * reach here.
 */
export function deleteCopyStyle(id: string) {
  copyStyles.remove(id);
  if (window.localStorage.getItem(ACTIVE_COPY_STYLE_KEY) === id) {
    window.localStorage.removeItem(ACTIVE_COPY_STYLE_KEY);
  }
}

export interface CopyVerse {
  /** The verse's number in its chapter; numbered styles prefix it. */
  number?: number;
  text: string;
}

/**
 * The plain-text form. Deterministic: reference placed before with a colon
 * or after in parentheses, the translation tagged inside either form when
 * known, verses numbered and lined or flowed as the style asks, the whole
 * text quoted when the style asks. The built-ins reproduce the retired
 * formatCitation byte for byte on a single verse.
 */
export function formatVerses(
  verses: CopyVerse[],
  reference: string,
  translation: string | undefined,
  style: CopyStyle
): string {
  const tag = style.translationTag ? translation : undefined;
  const quote = (s: string) => (style.quotationMarks ? `“${s}”` : s);
  const body = verses
    .map((v) => (style.verseNumbers && v.number !== undefined ? `${v.number} ${v.text}` : v.text))
    .join(style.versePerLine ? "\n" : " ");
  if (style.referencePosition === "before") {
    return `${tag ? `${reference} (${tag})` : reference}: ${quote(body)}`;
  }
  if (style.referencePosition === "after") {
    return tag
      ? `${quote(body)} (${reference}, ${tag})`
      : `${quote(body)} (${reference})`;
  }
  return quote(body);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The rich form of the same copy, a small self-contained fragment (no
 * classes, only inline styles, so the formatting survives the trip into
 * Word, slides, and email): the reference strong before or small and
 * emphasized after, verse numbers superscripted, one paragraph per verse
 * when the style lines them. Quotes span the whole text, as the plain form
 * wraps it, with the opening mark on the first paragraph and the closing
 * mark on the last.
 */
export function formatVersesHtml(
  verses: CopyVerse[],
  reference: string,
  translation: string | undefined,
  style: CopyStyle
): string {
  const tag = style.translationTag ? translation : undefined;
  const ref = escapeHtml(reference);
  const open = style.quotationMarks ? "“" : "";
  const close = style.quotationMarks ? "”" : "";
  const verseHtml = (v: CopyVerse) =>
    `${style.verseNumbers && v.number !== undefined ? `<sup>${v.number}</sup>` : ""}${escapeHtml(v.text)}`;
  if (style.versePerLine) {
    const lines = verses.map((v, i) => {
      const o = i === 0 ? open : "";
      const c = i === verses.length - 1 ? close : "";
      return `<p style="margin:0 0 0.5em">${o}${verseHtml(v)}${c}</p>`;
    });
    if (style.referencePosition === "before") {
      return `<p style="margin:0 0 0.5em"><strong>${ref}${tag ? ` (${escapeHtml(tag)})` : ""}</strong></p>${lines.join("")}`;
    }
    if (style.referencePosition === "after") {
      return `${lines.join("")}<p style="margin:0"><em>${ref}${tag ? `, ${escapeHtml(tag)}` : ""}</em></p>`;
    }
    return lines.join("");
  }
  const body = verses.map(verseHtml).join(" ");
  if (style.referencePosition === "before") {
    return `<p style="margin:0"><strong>${ref}${tag ? ` (${escapeHtml(tag)})` : ""}</strong>: ${open}${body}${close}</p>`;
  }
  if (style.referencePosition === "after") {
    return `<p style="margin:0">${open}${body}${close} <em>(${ref}${tag ? `, ${escapeHtml(tag)}` : ""})</em></p>`;
  }
  return `<p style="margin:0">${open}${body}${close}</p>`;
}

/**
 * The one clipboard write every copy site shares: the styled HTML beside
 * the plain text, so Word and email paste the formatting and plain targets
 * get the text. Engines that cannot take a rich item (an older Clipboard
 * API, a plain-only writer, a denied permission) fall back to the text
 * alone. Resolves false when no write landed.
 */
export async function copyStyled(text: string, html: string): Promise<boolean> {
  const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (!clip) return false;
  if (typeof ClipboardItem !== "undefined" && typeof clip.write === "function") {
    try {
      await clip.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    } catch {
      /* The rich write was refused; the plain write below still applies. */
    }
  }
  try {
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Formats the passage in the active style and puts it on the clipboard. */
export function copyPassage(
  verses: CopyVerse[],
  reference: string,
  translation?: string
): Promise<boolean> {
  const style = activeCopyStyle();
  return copyStyled(
    formatVerses(verses, reference, translation, style),
    formatVersesHtml(verses, reference, translation, style)
  );
}
