/**
 * Power Lookup copy: expand a set of references into their KJV text through
 * the bulk passages route and put the formatted block on the clipboard,
 * ready to paste into a manuscript. Each verse lands on its own line in the
 * reader's established citation form: the text, then its reference.
 */

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
 * keep only their first occurrence. Resolves false when nothing could be
 * expanded or the clipboard write failed.
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
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const p of data.passages) {
      for (const v of p.verses) {
        const key = `${p.bookName} ${p.chapter}:${v.verse}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`${v.text} (${key}, KJV)`);
      }
    }
    if (lines.length === 0) return false;
    await navigator.clipboard.writeText(lines.join("\n"));
    return true;
  } catch {
    return false;
  }
}
