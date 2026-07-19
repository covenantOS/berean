export type Testament = "OT" | "NT";

export interface Book {
  /** URL slug, e.g. "1-samuel" */
  slug: string;
  /** Display name, e.g. "1 Samuel" */
  name: string;
  /** Data file basename under data/kjv, e.g. "1Samuel" */
  file: string;
  chapters: number;
  testament: Testament;
  division: string;
  /** Set each verse on its own line, as poetry, rather than flowing prose. */
  poetry?: boolean;
}

export const CANON: Book[] = [
  { slug: "genesis", name: "Genesis", file: "Genesis", chapters: 50, testament: "OT", division: "The Law" },
  { slug: "exodus", name: "Exodus", file: "Exodus", chapters: 40, testament: "OT", division: "The Law" },
  { slug: "leviticus", name: "Leviticus", file: "Leviticus", chapters: 27, testament: "OT", division: "The Law" },
  { slug: "numbers", name: "Numbers", file: "Numbers", chapters: 36, testament: "OT", division: "The Law" },
  { slug: "deuteronomy", name: "Deuteronomy", file: "Deuteronomy", chapters: 34, testament: "OT", division: "The Law" },
  { slug: "joshua", name: "Joshua", file: "Joshua", chapters: 24, testament: "OT", division: "History" },
  { slug: "judges", name: "Judges", file: "Judges", chapters: 21, testament: "OT", division: "History" },
  { slug: "ruth", name: "Ruth", file: "Ruth", chapters: 4, testament: "OT", division: "History" },
  { slug: "1-samuel", name: "1 Samuel", file: "1Samuel", chapters: 31, testament: "OT", division: "History" },
  { slug: "2-samuel", name: "2 Samuel", file: "2Samuel", chapters: 24, testament: "OT", division: "History" },
  { slug: "1-kings", name: "1 Kings", file: "1Kings", chapters: 22, testament: "OT", division: "History" },
  { slug: "2-kings", name: "2 Kings", file: "2Kings", chapters: 25, testament: "OT", division: "History" },
  { slug: "1-chronicles", name: "1 Chronicles", file: "1Chronicles", chapters: 29, testament: "OT", division: "History" },
  { slug: "2-chronicles", name: "2 Chronicles", file: "2Chronicles", chapters: 36, testament: "OT", division: "History" },
  { slug: "ezra", name: "Ezra", file: "Ezra", chapters: 10, testament: "OT", division: "History" },
  { slug: "nehemiah", name: "Nehemiah", file: "Nehemiah", chapters: 13, testament: "OT", division: "History" },
  { slug: "esther", name: "Esther", file: "Esther", chapters: 10, testament: "OT", division: "History" },
  { slug: "job", name: "Job", file: "Job", chapters: 42, testament: "OT", division: "Poetry & Wisdom", poetry: true },
  { slug: "psalms", name: "Psalms", file: "Psalms", chapters: 150, testament: "OT", division: "Poetry & Wisdom", poetry: true },
  { slug: "proverbs", name: "Proverbs", file: "Proverbs", chapters: 31, testament: "OT", division: "Poetry & Wisdom", poetry: true },
  { slug: "ecclesiastes", name: "Ecclesiastes", file: "Ecclesiastes", chapters: 12, testament: "OT", division: "Poetry & Wisdom", poetry: true },
  { slug: "song-of-solomon", name: "Song of Solomon", file: "SongofSolomon", chapters: 8, testament: "OT", division: "Poetry & Wisdom", poetry: true },
  { slug: "isaiah", name: "Isaiah", file: "Isaiah", chapters: 66, testament: "OT", division: "Major Prophets" },
  { slug: "jeremiah", name: "Jeremiah", file: "Jeremiah", chapters: 52, testament: "OT", division: "Major Prophets" },
  { slug: "lamentations", name: "Lamentations", file: "Lamentations", chapters: 5, testament: "OT", division: "Major Prophets", poetry: true },
  { slug: "ezekiel", name: "Ezekiel", file: "Ezekiel", chapters: 48, testament: "OT", division: "Major Prophets" },
  { slug: "daniel", name: "Daniel", file: "Daniel", chapters: 12, testament: "OT", division: "Major Prophets" },
  { slug: "hosea", name: "Hosea", file: "Hosea", chapters: 14, testament: "OT", division: "Minor Prophets" },
  { slug: "joel", name: "Joel", file: "Joel", chapters: 3, testament: "OT", division: "Minor Prophets" },
  { slug: "amos", name: "Amos", file: "Amos", chapters: 9, testament: "OT", division: "Minor Prophets" },
  { slug: "obadiah", name: "Obadiah", file: "Obadiah", chapters: 1, testament: "OT", division: "Minor Prophets" },
  { slug: "jonah", name: "Jonah", file: "Jonah", chapters: 4, testament: "OT", division: "Minor Prophets" },
  { slug: "micah", name: "Micah", file: "Micah", chapters: 7, testament: "OT", division: "Minor Prophets" },
  { slug: "nahum", name: "Nahum", file: "Nahum", chapters: 3, testament: "OT", division: "Minor Prophets" },
  { slug: "habakkuk", name: "Habakkuk", file: "Habakkuk", chapters: 3, testament: "OT", division: "Minor Prophets" },
  { slug: "zephaniah", name: "Zephaniah", file: "Zephaniah", chapters: 3, testament: "OT", division: "Minor Prophets" },
  { slug: "haggai", name: "Haggai", file: "Haggai", chapters: 2, testament: "OT", division: "Minor Prophets" },
  { slug: "zechariah", name: "Zechariah", file: "Zechariah", chapters: 14, testament: "OT", division: "Minor Prophets" },
  { slug: "malachi", name: "Malachi", file: "Malachi", chapters: 4, testament: "OT", division: "Minor Prophets" },
  { slug: "matthew", name: "Matthew", file: "Matthew", chapters: 28, testament: "NT", division: "The Gospels" },
  { slug: "mark", name: "Mark", file: "Mark", chapters: 16, testament: "NT", division: "The Gospels" },
  { slug: "luke", name: "Luke", file: "Luke", chapters: 24, testament: "NT", division: "The Gospels" },
  { slug: "john", name: "John", file: "John", chapters: 21, testament: "NT", division: "The Gospels" },
  { slug: "acts", name: "Acts", file: "Acts", chapters: 28, testament: "NT", division: "History" },
  { slug: "romans", name: "Romans", file: "Romans", chapters: 16, testament: "NT", division: "Pauline Epistles" },
  { slug: "1-corinthians", name: "1 Corinthians", file: "1Corinthians", chapters: 16, testament: "NT", division: "Pauline Epistles" },
  { slug: "2-corinthians", name: "2 Corinthians", file: "2Corinthians", chapters: 13, testament: "NT", division: "Pauline Epistles" },
  { slug: "galatians", name: "Galatians", file: "Galatians", chapters: 6, testament: "NT", division: "Pauline Epistles" },
  { slug: "ephesians", name: "Ephesians", file: "Ephesians", chapters: 6, testament: "NT", division: "Pauline Epistles" },
  { slug: "philippians", name: "Philippians", file: "Philippians", chapters: 4, testament: "NT", division: "Pauline Epistles" },
  { slug: "colossians", name: "Colossians", file: "Colossians", chapters: 4, testament: "NT", division: "Pauline Epistles" },
  { slug: "1-thessalonians", name: "1 Thessalonians", file: "1Thessalonians", chapters: 5, testament: "NT", division: "Pauline Epistles" },
  { slug: "2-thessalonians", name: "2 Thessalonians", file: "2Thessalonians", chapters: 3, testament: "NT", division: "Pauline Epistles" },
  { slug: "1-timothy", name: "1 Timothy", file: "1Timothy", chapters: 6, testament: "NT", division: "Pauline Epistles" },
  { slug: "2-timothy", name: "2 Timothy", file: "2Timothy", chapters: 4, testament: "NT", division: "Pauline Epistles" },
  { slug: "titus", name: "Titus", file: "Titus", chapters: 3, testament: "NT", division: "Pauline Epistles" },
  { slug: "philemon", name: "Philemon", file: "Philemon", chapters: 1, testament: "NT", division: "Pauline Epistles" },
  { slug: "hebrews", name: "Hebrews", file: "Hebrews", chapters: 13, testament: "NT", division: "General Epistles" },
  { slug: "james", name: "James", file: "James", chapters: 5, testament: "NT", division: "General Epistles" },
  { slug: "1-peter", name: "1 Peter", file: "1Peter", chapters: 5, testament: "NT", division: "General Epistles" },
  { slug: "2-peter", name: "2 Peter", file: "2Peter", chapters: 3, testament: "NT", division: "General Epistles" },
  { slug: "1-john", name: "1 John", file: "1John", chapters: 5, testament: "NT", division: "General Epistles" },
  { slug: "2-john", name: "2 John", file: "2John", chapters: 1, testament: "NT", division: "General Epistles" },
  { slug: "3-john", name: "3 John", file: "3John", chapters: 1, testament: "NT", division: "General Epistles" },
  { slug: "jude", name: "Jude", file: "Jude", chapters: 1, testament: "NT", division: "General Epistles" },
  { slug: "revelation", name: "Revelation", file: "Revelation", chapters: 22, testament: "NT", division: "Apocalypse" },
];

const bySlug = new Map(CANON.map((b) => [b.slug, b]));

export function getBook(slug: string): Book | undefined {
  return bySlug.get(slug);
}

/* Book-name resolution: display names plus common abbreviations. refs.ts
 * builds its reference pattern from BOOK_NAME_PATTERN; resolveBookName
 * serves reference parsing and the query language's in: scoping, and also
 * accepts URL slugs. */
const NAME_TO_SLUG = new Map<string, string>();
for (const b of CANON) {
  NAME_TO_SLUG.set(b.name.toLowerCase(), b.slug);
}
const ABBREVIATIONS: Record<string, string> = {
  gen: "genesis", exod: "exodus", ex: "exodus", lev: "leviticus", num: "numbers",
  deut: "deuteronomy", josh: "joshua", judg: "judges", "1 sam": "1-samuel", "2 sam": "2-samuel",
  "1 kgs": "1-kings", "2 kgs": "2-kings", "1 chron": "1-chronicles", "2 chron": "2-chronicles",
  "1 chr": "1-chronicles", "2 chr": "2-chronicles", neh: "nehemiah", esth: "esther",
  ps: "psalms", psalm: "psalms", prov: "proverbs", eccl: "ecclesiastes",
  song: "song-of-solomon", "song of songs": "song-of-solomon", isa: "isaiah", jer: "jeremiah",
  lam: "lamentations", ezek: "ezekiel", dan: "daniel", hos: "hosea", obad: "obadiah",
  mic: "micah", nah: "nahum", hab: "habakkuk", zeph: "zephaniah", hag: "haggai",
  zech: "zechariah", mal: "malachi", matt: "matthew", mk: "mark", lk: "luke", jn: "john",
  rom: "romans", "1 cor": "1-corinthians", "2 cor": "2-corinthians", gal: "galatians",
  eph: "ephesians", phil: "philippians", col: "colossians",
  "1 thess": "1-thessalonians", "2 thess": "2-thessalonians",
  "1 tim": "1-timothy", "2 tim": "2-timothy", philem: "philemon", heb: "hebrews",
  jas: "james", "1 pet": "1-peter", "2 pet": "2-peter", "1 jn": "1-john", "2 jn": "2-john",
  "3 jn": "3-john", rev: "revelation",
};
for (const [abbr, slug] of Object.entries(ABBREVIATIONS)) NAME_TO_SLUG.set(abbr, slug);

/** Sorted longest-first so "1 Corinthians" wins over "Corinthians". */
export const BOOK_NAME_PATTERN = [...NAME_TO_SLUG.keys()]
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

export function resolveBookName(name: string): Book | undefined {
  const key = name.trim().toLowerCase().replace(/\.$/, "");
  const slug = NAME_TO_SLUG.get(key) ?? (bySlug.has(key) ? key : undefined);
  return slug ? bySlug.get(slug) : undefined;
}

export function bookIndex(slug: string): number {
  return CANON.findIndex((b) => b.slug === slug);
}

/** The chapter before/after a given chapter, crossing book boundaries. */
export function adjacentChapter(
  slug: string,
  chapter: number,
  dir: -1 | 1
): { book: Book; chapter: number } | null {
  const i = bookIndex(slug);
  if (i < 0) return null;
  const book = CANON[i];
  const next = chapter + dir;
  if (next >= 1 && next <= book.chapters) return { book, chapter: next };
  const j = i + dir;
  if (j < 0 || j >= CANON.length) return null;
  const neighbor = CANON[j];
  return { book: neighbor, chapter: dir === 1 ? 1 : neighbor.chapters };
}

export const TOTAL_CHAPTERS = CANON.reduce((n, b) => n + b.chapters, 0);
