/**
 * Verse-range filtering for commentary sections, shared by the server
 * shelf (src/lib/commentary.ts) and the workspace dock. Pure: safe to
 * import from client code, unlike commentary.ts which reads from disk.
 */

export interface VerseSection {
  /** Verse label, e.g. "1-3" or "2, 4"; empty for an introduction section. */
  verses: string;
  text: string;
}

/** The first number of a section's verse label ("1-3" -> 1, "2, 4" -> 2). */
function sectionStart(verses: string): number {
  const m = verses.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/** The last number of a section's verse label ("1-3" -> 3, "2, 4" -> 4). */
function sectionEnd(verses: string): number {
  const nums = verses.match(/\d+/g);
  return nums ? Number(nums[nums.length - 1]) : 0;
}

/** Sections touching a verse: intro sections (no label) plus any whose range
 * covers it. Range ends are taken from the label's first and last numbers,
 * which is exact for the contiguous ranges the build scripts emit and a
 * generous superset for comma lists. */
export function sectionsForVerse<T extends VerseSection>(sections: T[], verse: number): T[] {
  return sections.filter(
    (s) => !s.verses || (sectionStart(s.verses) <= verse && verse <= sectionEnd(s.verses))
  );
}
