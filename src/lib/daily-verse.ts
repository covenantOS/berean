/**
 * The daily verse: one quiet portion per calendar day, the same all day
 * for everyone, derived deterministically from the date. No streaks, no
 * badges, no share prompts; just the text, its reference, and a way into
 * the reader (see docs/COMPETITIVE_INVENTORY.md, Tier 2 "Daily verse").
 */

export interface DailyRef {
  slug: string;
  chapter: number;
  verse: number;
  /** Display form, e.g. "John 3:16". */
  label: string;
}

/** A curated cycle of portions, one drawn per day. */
const PORTIONS: DailyRef[] = [
  { slug: "genesis", chapter: 1, verse: 1, label: "Genesis 1:1" },
  { slug: "genesis", chapter: 1, verse: 27, label: "Genesis 1:27" },
  { slug: "genesis", chapter: 15, verse: 6, label: "Genesis 15:6" },
  { slug: "exodus", chapter: 20, verse: 3, label: "Exodus 20:3" },
  { slug: "exodus", chapter: 34, verse: 6, label: "Exodus 34:6" },
  { slug: "leviticus", chapter: 19, verse: 18, label: "Leviticus 19:18" },
  { slug: "numbers", chapter: 6, verse: 24, label: "Numbers 6:24" },
  { slug: "deuteronomy", chapter: 6, verse: 5, label: "Deuteronomy 6:5" },
  { slug: "deuteronomy", chapter: 31, verse: 6, label: "Deuteronomy 31:6" },
  { slug: "joshua", chapter: 1, verse: 9, label: "Joshua 1:9" },
  { slug: "ruth", chapter: 1, verse: 16, label: "Ruth 1:16" },
  { slug: "1-samuel", chapter: 16, verse: 7, label: "1 Samuel 16:7" },
  { slug: "2-samuel", chapter: 22, verse: 31, label: "2 Samuel 22:31" },
  { slug: "1-chronicles", chapter: 16, verse: 11, label: "1 Chronicles 16:11" },
  { slug: "job", chapter: 19, verse: 25, label: "Job 19:25" },
  { slug: "psalms", chapter: 1, verse: 1, label: "Psalm 1:1" },
  { slug: "psalms", chapter: 19, verse: 1, label: "Psalm 19:1" },
  { slug: "psalms", chapter: 23, verse: 1, label: "Psalm 23:1" },
  { slug: "psalms", chapter: 27, verse: 1, label: "Psalm 27:1" },
  { slug: "psalms", chapter: 46, verse: 1, label: "Psalm 46:1" },
  { slug: "psalms", chapter: 51, verse: 10, label: "Psalm 51:10" },
  { slug: "psalms", chapter: 90, verse: 12, label: "Psalm 90:12" },
  { slug: "psalms", chapter: 100, verse: 5, label: "Psalm 100:5" },
  { slug: "psalms", chapter: 119, verse: 105, label: "Psalm 119:105" },
  { slug: "psalms", chapter: 121, verse: 1, label: "Psalm 121:1" },
  { slug: "proverbs", chapter: 3, verse: 5, label: "Proverbs 3:5" },
  { slug: "ecclesiastes", chapter: 12, verse: 13, label: "Ecclesiastes 12:13" },
  { slug: "isaiah", chapter: 40, verse: 31, label: "Isaiah 40:31" },
  { slug: "isaiah", chapter: 41, verse: 10, label: "Isaiah 41:10" },
  { slug: "isaiah", chapter: 53, verse: 5, label: "Isaiah 53:5" },
  { slug: "jeremiah", chapter: 29, verse: 11, label: "Jeremiah 29:11" },
  { slug: "lamentations", chapter: 3, verse: 22, label: "Lamentations 3:22" },
  { slug: "ezekiel", chapter: 36, verse: 26, label: "Ezekiel 36:26" },
  { slug: "daniel", chapter: 2, verse: 21, label: "Daniel 2:21" },
  { slug: "micah", chapter: 6, verse: 8, label: "Micah 6:8" },
  { slug: "habakkuk", chapter: 2, verse: 4, label: "Habakkuk 2:4" },
  { slug: "malachi", chapter: 3, verse: 6, label: "Malachi 3:6" },
  { slug: "matthew", chapter: 5, verse: 16, label: "Matthew 5:16" },
  { slug: "matthew", chapter: 6, verse: 33, label: "Matthew 6:33" },
  { slug: "matthew", chapter: 11, verse: 28, label: "Matthew 11:28" },
  { slug: "matthew", chapter: 28, verse: 20, label: "Matthew 28:20" },
  { slug: "mark", chapter: 12, verse: 30, label: "Mark 12:30" },
  { slug: "luke", chapter: 9, verse: 23, label: "Luke 9:23" },
  { slug: "john", chapter: 1, verse: 1, label: "John 1:1" },
  { slug: "john", chapter: 3, verse: 16, label: "John 3:16" },
  { slug: "john", chapter: 14, verse: 6, label: "John 14:6" },
  { slug: "john", chapter: 15, verse: 5, label: "John 15:5" },
  { slug: "acts", chapter: 17, verse: 11, label: "Acts 17:11" },
  { slug: "romans", chapter: 8, verse: 28, label: "Romans 8:28" },
  { slug: "romans", chapter: 12, verse: 2, label: "Romans 12:2" },
  { slug: "1-corinthians", chapter: 13, verse: 13, label: "1 Corinthians 13:13" },
  { slug: "2-corinthians", chapter: 5, verse: 17, label: "2 Corinthians 5:17" },
  { slug: "galatians", chapter: 5, verse: 22, label: "Galatians 5:22" },
  { slug: "ephesians", chapter: 2, verse: 8, label: "Ephesians 2:8" },
  { slug: "philippians", chapter: 4, verse: 13, label: "Philippians 4:13" },
  { slug: "colossians", chapter: 3, verse: 17, label: "Colossians 3:17" },
  { slug: "2-timothy", chapter: 3, verse: 16, label: "2 Timothy 3:16" },
  { slug: "hebrews", chapter: 11, verse: 1, label: "Hebrews 11:1" },
  { slug: "hebrews", chapter: 13, verse: 8, label: "Hebrews 13:8" },
  { slug: "james", chapter: 1, verse: 5, label: "James 1:5" },
  { slug: "1-peter", chapter: 5, verse: 7, label: "1 Peter 5:7" },
  { slug: "1-john", chapter: 4, verse: 8, label: "1 John 4:8" },
  { slug: "revelation", chapter: 21, verse: 5, label: "Revelation 21:5" },
];

/** String hash (djb2) so the choice varies day to day but never within a day. */
function hashKey(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Index into PORTIONS for a calendar day given as "YYYY-MM-DD". */
export function dailyIndex(dateKey: string): number {
  return hashKey(dateKey) % PORTIONS.length;
}

/** The day's portion. Keyed on UTC so every visitor sees the same verse. */
export function dailyRef(date: Date): DailyRef {
  const key = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return PORTIONS[dailyIndex(key)];
}
