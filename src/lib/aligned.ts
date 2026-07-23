/**
 * The search pane's Aligned arrangement (src/components/shell/SearchPane.tsx):
 * hit verses read in more than one translation at once. The fetching is the
 * multiview report (/api/pane/multiview) batched over the hit set's chapters,
 * and the batching is honest: at most ALIGNED_HIT_CAP hits align, first come
 * first served, and each chapter fetches once however many hits it holds.
 * The pane's note says so when the cap bites. Fetched chapters cache at
 * module scope (alignedChapter below), so leaving the view and returning
 * costs nothing.
 */

export const ALIGNED_HIT_CAP = 50;

export interface AlignedChapter {
  book: string;
  chapter: number;
  /** The fetch key: one request per chapter, however many hits it holds. */
  key: string;
}

/** One column of the multiview report the view aligns on. */
export interface AlignedColumnPayload {
  id: string;
  abbrev: string;
  name: string;
  /** The LXX numbering note where the Septuagint counts differently. */
  note: string | null;
  /** True when the text has no such chapter at all. */
  missing: boolean;
  verses: { verse: number; text: string }[];
}

export interface AlignedChapterPayload {
  book: string;
  bookName: string;
  chapter: number;
  columns: AlignedColumnPayload[];
}

const payloadCache = new Map<string, Promise<AlignedChapterPayload>>();

/**
 * One chapter's multiview report, cached at module scope by chapter and
 * column set the way the other data libs cache the shelf (the concordance's
 * pattern, src/lib/concordance.ts): switching out of the Aligned view and
 * back re-reads the cache instead of fetching again. The fetch is shared,
 * never aborted by an unmounting view, and a failed request leaves nothing
 * behind, so the next visit tries again.
 */
export function alignedChapter(
  book: string,
  chapter: number,
  texts: string
): Promise<AlignedChapterPayload> {
  const key = `${book}:${chapter}|${texts}`;
  const hit = payloadCache.get(key);
  if (hit) return hit;
  const q = new URLSearchParams({ book, chapter: String(chapter), texts });
  const job = fetch(`/api/pane/multiview?${q}`).then((res) => {
    if (!res.ok) throw new Error(String(res.status));
    return res.json() as Promise<AlignedChapterPayload>;
  });
  job.catch(() => payloadCache.delete(key));
  payloadCache.set(key, job);
  return job;
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
