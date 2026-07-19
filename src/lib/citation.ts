"use client";

/**
 * Citation style: the retired binary copy choice. Text-first is the
 * established form, the text and then its reference in parentheses;
 * citation-first leads with the reference the way a footnote does. The
 * named copy styles in src/lib/copystyles.ts supersede the choice; it
 * survives as the fallback there, with its two forms living on as the
 * Text first and Citation first built-ins. formatCitation stays as the
 * legacy entry point and formats through them, byte-identical.
 */

import {
  BUILTIN_COPY_STYLES,
  CITATION_STYLE_KEY,
  citationStyle,
  formatVerses,
  type CitationStyle,
} from "./copystyles";

export { CITATION_STYLE_KEY, citationStyle, type CitationStyle };

export function formatCitation(text: string, reference: string, translation?: string): string {
  const style =
    BUILTIN_COPY_STYLES.find((s) => s.id === `builtin-${citationStyle()}`) ??
    BUILTIN_COPY_STYLES[0];
  return formatVerses([{ text }], reference, translation, style);
}
