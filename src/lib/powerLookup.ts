/**
 * Power Lookup copy: expand a set of references into their KJV text through
 * the bulk passages route and put the formatted block on the clipboard,
 * ready to paste into a manuscript. Each passage is one copy block in the
 * active style (src/lib/copystyles.ts), its verses numbered, lined, and
 * quoted as the style asks, with the styled HTML riding beside the plain
 * text where the clipboard takes rich items.
 */

import {
  activeCopyStyle,
  copyStyled,
  formatVerses,
  formatVersesHtml,
  type CopyVerse,
} from "./copystyles";

export interface RefRange {
  /** Canonical book slug, e.g. "genesis". */
  book: string;
  chapter: number;
  from: number;
  /** Inclusive range end; a single verse when omitted. */
  to?: number;
}

interface BulkPassage {
  bookName: string;
  chapter: number;
  verses: { verse: number; text: string }[];
}

/**
 * Fetches the refs' text and writes it to the clipboard. Overlapping ranges
 * share verses, and a manuscript wants each verse once, so repeated verses
 * keep only their first occurrence; a passage left with no verses of its own
 * drops out. Resolves false when nothing could be expanded or the clipboard
 * write failed.
 */
export async function copyReferences(refs: RefRange[]): Promise<boolean> {
  if (refs.length === 0) return false;
  const q = refs
    .map((r) => `${r.book}.${r.chapter}.${r.from}${r.to && r.to !== r.from ? `-${r.to}` : ""}`)
    .join(",");
  try {
    const res = await fetch(`/api/passages?refs=${encodeURIComponent(q)}`);
    if (!res.ok) return false;
    const data = (await res.json()) as { passages: BulkPassage[] };
    const style = activeCopyStyle();
    const seen = new Set<string>();
    const blocks: { reference: string; verses: CopyVerse[] }[] = [];
    for (const p of data.passages) {
      const verses: CopyVerse[] = [];
      for (const v of p.verses) {
        const key = `${p.bookName} ${p.chapter}:${v.verse}`;
        if (seen.has(key)) continue;
        seen.add(key);
        verses.push({ number: v.verse, text: v.text });
      }
      if (verses.length === 0) continue;
      const from = verses[0].number;
      const to = verses[verses.length - 1].number;
      blocks.push({
        reference: `${p.bookName} ${p.chapter}:${from}${to !== from ? `-${to}` : ""}`,
        verses,
      });
    }
    if (blocks.length === 0) return false;
    const text = blocks.map((b) => formatVerses(b.verses, b.reference, "KJV", style)).join("\n");
    const html = blocks.map((b) => formatVersesHtml(b.verses, b.reference, "KJV", style)).join("");
    return await copyStyled(text, html);
  } catch {
    return false;
  }
}
