/**
 * The search pane's Aligned arrangement (src/components/shell/SearchPane.tsx):
 * hit verses read in more than one translation at once. The fetching is the
 * multiview report (/api/pane/multiview) batched over the hit set's chapters,
 * and the batching is honest: at most ALIGNED_HIT_CAP hits align, first come
 * first served, and each chapter fetches once however many hits it holds.
 * The pane's note says so when the cap bites.
 */

export const ALIGNED_HIT_CAP = 50;

export interface AlignedChapter {
  book: string;
  chapter: number;
  /** The fetch key: one request per chapter, however many hits it holds. */
  key: string;
}

/** The hits the view aligns (the cap applied) and the chapters to fetch. */
export function alignedScope<T extends { book: string; chapter: number }>(
  hits: T[]
): { hits: T[]; chapters: AlignedChapter[] } {
  const capped = hits.slice(0, ALIGNED_HIT_CAP);
  const seen = new Set<string>();
  const chapters: AlignedChapter[] = [];
  for (const h of capped) {
    const key = `${h.book}:${h.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chapters.push({ book: h.book, chapter: h.chapter, key });
  }
  return { hits: capped, chapters };
}

/**
 * The columns the view asks for: the reader's preferred text beside the KJV
 * and one more witness, so the searched text never stands alone. OT-only
 * texts (the Septuagint columns) step aside when a New Testament hit is
 * among the aligned, the route's own per-book discipline applied before the
 * requests go out; a set that cannot hold two columns falls back to KJV and
 * WEB, both furnished from the first commit.
 */
export function alignedTextIds(
  preferred: string | undefined,
  shelf: { id: string; otOnly: boolean }[],
  hasNT: boolean
): string[] {
  const wanted = [...new Set([...(preferred ? [preferred] : []), "kjv", "web"])];
  const furnished = wanted.filter((id) =>
    shelf.some((t) => t.id === id && !(hasNT && t.otOnly))
  );
  return furnished.length >= 2 ? furnished : ["kjv", "web"];
}
