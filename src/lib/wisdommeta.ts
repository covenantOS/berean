import { getChapter } from "./bible";
import { verseWords } from "./query";

/**
 * Wisdom-book metadata: the hand-built per-psalm dataset behind the Psalms
 * Explorer and the collection map behind the Proverbs Explorer. Verse and
 * word statistics are computed from the shipped KJV text, the bookmeta
 * pattern.
 *
 * Authorship honesty: the shipped KJV text files do not carry the psalm
 * superscriptions (Psalm 3 opens on its first verse, not on "A Psalm of
 * David"), so the attributions are hand-built from the superscriptions as
 * the received text carries them: David 73 psalms, Asaph 12 (50, 73-83),
 * the sons of Korah 11 (42, 44-49, 84-85, 87-88), Solomon 2 (72, 127),
 * Moses 1 (90), Ethan 1 (89), Heman named within 88, the rest anonymous.
 * The New Testament names David for Psalms 2 and 95 (Acts 4:25, Hebrews
 * 4:7) where the superscriptions are silent; the superscriptions govern
 * here, so both read Anonymous.
 *
 * Genre honesty: six forms, and the schema is simple on purpose. Where a
 * psalm mixes forms the dominant one wins: Praise carries the hymns, the
 * thanksgivings, and the songs of trust; Lament carries the complaints
 * individual and communal, the penitentials among them; Royal is the human
 * king (the divine-kingship hymns read as Praise); Wisdom is torah and
 * instruction; Pilgrimage is the fifteen Songs of Ascents their
 * superscriptions name (120-134), whatever else each also is; Imprecatory
 * is reserved for the psalms whose defining note is the call for judgment.
 * The classifications follow the standard introductions (the ESV Study
 * Bible family and the form critics they summarize) and would differ at
 * the margins in other hands.
 */

export type PsalmGenre =
  | "lament"
  | "praise"
  | "royal"
  | "wisdom"
  | "pilgrimage"
  | "imprecatory";

export interface PsalmGenreInfo {
  id: PsalmGenre;
  label: string;
}

/** The genre taxonomy, in the order the Psalter first earns each form. */
export const PSALM_GENRES: PsalmGenreInfo[] = [
  { id: "wisdom", label: "Wisdom" },
  { id: "royal", label: "Royal" },
  { id: "lament", label: "Lament" },
  { id: "praise", label: "Praise" },
  { id: "pilgrimage", label: "Pilgrimage" },
  { id: "imprecatory", label: "Imprecatory" },
];

export interface PsalmMeta {
  psalm: number;
  genre: PsalmGenre;
  /** The superscription's author, or Anonymous where it is silent. */
  author: string;
}

const DAVID = "David";
const ASAPH = "Asaph";
const KORAH = "Sons of Korah";
const ANON = "Anonymous";

export const PSALM_META: PsalmMeta[] = [
  /* Book I (1-41): David's book, the anonymous four (1, 2, 10, 33) apart. */
  { psalm: 1, genre: "wisdom", author: ANON },
  { psalm: 2, genre: "royal", author: ANON },
  { psalm: 3, genre: "lament", author: DAVID },
  { psalm: 4, genre: "lament", author: DAVID },
  { psalm: 5, genre: "lament", author: DAVID },
  { psalm: 6, genre: "lament", author: DAVID },
  { psalm: 7, genre: "lament", author: DAVID },
  { psalm: 8, genre: "praise", author: DAVID },
  { psalm: 9, genre: "praise", author: DAVID },
  { psalm: 10, genre: "lament", author: ANON },
  { psalm: 11, genre: "praise", author: DAVID },
  { psalm: 12, genre: "lament", author: DAVID },
  { psalm: 13, genre: "lament", author: DAVID },
  { psalm: 14, genre: "wisdom", author: DAVID },
  { psalm: 15, genre: "wisdom", author: DAVID },
  { psalm: 16, genre: "praise", author: DAVID },
  { psalm: 17, genre: "lament", author: DAVID },
  { psalm: 18, genre: "praise", author: DAVID },
  { psalm: 19, genre: "praise", author: DAVID },
  { psalm: 20, genre: "royal", author: DAVID },
  { psalm: 21, genre: "royal", author: DAVID },
  { psalm: 22, genre: "lament", author: DAVID },
  { psalm: 23, genre: "praise", author: DAVID },
  { psalm: 24, genre: "praise", author: DAVID },
  { psalm: 25, genre: "lament", author: DAVID },
  { psalm: 26, genre: "lament", author: DAVID },
  { psalm: 27, genre: "praise", author: DAVID },
  { psalm: 28, genre: "lament", author: DAVID },
  { psalm: 29, genre: "praise", author: DAVID },
  { psalm: 30, genre: "praise", author: DAVID },
  { psalm: 31, genre: "lament", author: DAVID },
  { psalm: 32, genre: "praise", author: DAVID },
  { psalm: 33, genre: "praise", author: ANON },
  { psalm: 34, genre: "praise", author: DAVID },
  { psalm: 35, genre: "imprecatory", author: DAVID },
  { psalm: 36, genre: "wisdom", author: DAVID },
  { psalm: 37, genre: "wisdom", author: DAVID },
  { psalm: 38, genre: "lament", author: DAVID },
  { psalm: 39, genre: "lament", author: DAVID },
  { psalm: 40, genre: "praise", author: DAVID },
  { psalm: 41, genre: "lament", author: DAVID },
  /* Book II (42-72): the first Korah and Asaph collections, then David's. */
  { psalm: 42, genre: "lament", author: KORAH },
  { psalm: 43, genre: "lament", author: ANON },
  { psalm: 44, genre: "lament", author: KORAH },
  { psalm: 45, genre: "royal", author: KORAH },
  { psalm: 46, genre: "praise", author: KORAH },
  { psalm: 47, genre: "praise", author: KORAH },
  { psalm: 48, genre: "praise", author: KORAH },
  { psalm: 49, genre: "wisdom", author: KORAH },
  { psalm: 50, genre: "wisdom", author: ASAPH },
  { psalm: 51, genre: "lament", author: DAVID },
  { psalm: 52, genre: "wisdom", author: DAVID },
  { psalm: 53, genre: "wisdom", author: DAVID },
  { psalm: 54, genre: "lament", author: DAVID },
  { psalm: 55, genre: "lament", author: DAVID },
  { psalm: 56, genre: "lament", author: DAVID },
  { psalm: 57, genre: "lament", author: DAVID },
  { psalm: 58, genre: "imprecatory", author: DAVID },
  { psalm: 59, genre: "imprecatory", author: DAVID },
  { psalm: 60, genre: "lament", author: DAVID },
  { psalm: 61, genre: "lament", author: DAVID },
  { psalm: 62, genre: "praise", author: DAVID },
  { psalm: 63, genre: "lament", author: DAVID },
  { psalm: 64, genre: "lament", author: DAVID },
  { psalm: 65, genre: "praise", author: DAVID },
  { psalm: 66, genre: "praise", author: ANON },
  { psalm: 67, genre: "praise", author: ANON },
  { psalm: 68, genre: "praise", author: DAVID },
  { psalm: 69, genre: "imprecatory", author: DAVID },
  { psalm: 70, genre: "lament", author: DAVID },
  { psalm: 71, genre: "lament", author: ANON },
  { psalm: 72, genre: "royal", author: "Solomon" },
  /* Book III (73-89): Asaph's collection, then Korah's second. */
  { psalm: 73, genre: "wisdom", author: ASAPH },
  { psalm: 74, genre: "lament", author: ASAPH },
  { psalm: 75, genre: "praise", author: ASAPH },
  { psalm: 76, genre: "praise", author: ASAPH },
  { psalm: 77, genre: "lament", author: ASAPH },
  { psalm: 78, genre: "wisdom", author: ASAPH },
  { psalm: 79, genre: "imprecatory", author: ASAPH },
  { psalm: 80, genre: "lament", author: ASAPH },
  { psalm: 81, genre: "praise", author: ASAPH },
  { psalm: 82, genre: "wisdom", author: ASAPH },
  { psalm: 83, genre: "imprecatory", author: ASAPH },
  { psalm: 84, genre: "praise", author: KORAH },
  { psalm: 85, genre: "lament", author: KORAH },
  { psalm: 86, genre: "lament", author: DAVID },
  { psalm: 87, genre: "praise", author: KORAH },
  // 88 names both: "of the sons of Korah... of Heman the Ezrahite".
  { psalm: 88, genre: "lament", author: "Sons of Korah (Heman)" },
  { psalm: 89, genre: "lament", author: "Ethan" },
  /* Book IV (90-106): the oldest psalm opens it; mostly anonymous. */
  { psalm: 90, genre: "lament", author: "Moses" },
  { psalm: 91, genre: "praise", author: ANON },
  { psalm: 92, genre: "praise", author: ANON },
  { psalm: 93, genre: "praise", author: ANON },
  { psalm: 94, genre: "imprecatory", author: ANON },
  { psalm: 95, genre: "praise", author: ANON },
  { psalm: 96, genre: "praise", author: ANON },
  { psalm: 97, genre: "praise", author: ANON },
  { psalm: 98, genre: "praise", author: ANON },
  { psalm: 99, genre: "praise", author: ANON },
  { psalm: 100, genre: "praise", author: ANON },
  { psalm: 101, genre: "royal", author: DAVID },
  { psalm: 102, genre: "lament", author: ANON },
  { psalm: 103, genre: "praise", author: DAVID },
  { psalm: 104, genre: "praise", author: ANON },
  { psalm: 105, genre: "praise", author: ANON },
  { psalm: 106, genre: "lament", author: ANON },
  /* Book V (107-150): the ascent psalms 120-134, the closing hallels. */
  { psalm: 107, genre: "praise", author: ANON },
  { psalm: 108, genre: "praise", author: DAVID },
  { psalm: 109, genre: "imprecatory", author: DAVID },
  { psalm: 110, genre: "royal", author: DAVID },
  { psalm: 111, genre: "praise", author: ANON },
  { psalm: 112, genre: "wisdom", author: ANON },
  { psalm: 113, genre: "praise", author: ANON },
  { psalm: 114, genre: "praise", author: ANON },
  { psalm: 115, genre: "praise", author: ANON },
  { psalm: 116, genre: "praise", author: ANON },
  { psalm: 117, genre: "praise", author: ANON },
  { psalm: 118, genre: "praise", author: ANON },
  { psalm: 119, genre: "wisdom", author: ANON },
  { psalm: 120, genre: "pilgrimage", author: ANON },
  { psalm: 121, genre: "pilgrimage", author: ANON },
  { psalm: 122, genre: "pilgrimage", author: DAVID },
  { psalm: 123, genre: "pilgrimage", author: ANON },
  { psalm: 124, genre: "pilgrimage", author: DAVID },
  { psalm: 125, genre: "pilgrimage", author: ANON },
  { psalm: 126, genre: "pilgrimage", author: ANON },
  { psalm: 127, genre: "pilgrimage", author: "Solomon" },
  { psalm: 128, genre: "pilgrimage", author: ANON },
  { psalm: 129, genre: "pilgrimage", author: ANON },
  { psalm: 130, genre: "pilgrimage", author: ANON },
  { psalm: 131, genre: "pilgrimage", author: DAVID },
  { psalm: 132, genre: "pilgrimage", author: ANON },
  { psalm: 133, genre: "pilgrimage", author: DAVID },
  { psalm: 134, genre: "pilgrimage", author: ANON },
  { psalm: 135, genre: "praise", author: ANON },
  { psalm: 136, genre: "praise", author: ANON },
  { psalm: 137, genre: "imprecatory", author: ANON },
  { psalm: 138, genre: "praise", author: DAVID },
  { psalm: 139, genre: "wisdom", author: DAVID },
  { psalm: 140, genre: "imprecatory", author: DAVID },
  { psalm: 141, genre: "lament", author: DAVID },
  { psalm: 142, genre: "lament", author: DAVID },
  { psalm: 143, genre: "lament", author: DAVID },
  { psalm: 144, genre: "royal", author: DAVID },
  { psalm: 145, genre: "praise", author: DAVID },
  { psalm: 146, genre: "praise", author: ANON },
  { psalm: 147, genre: "praise", author: ANON },
  { psalm: 148, genre: "praise", author: ANON },
  { psalm: 149, genre: "praise", author: ANON },
  { psalm: 150, genre: "praise", author: ANON },
];

/**
 * The five books of the Psalter, marked by the doxologies that close them
 * (41:13, 72:18-19, 89:52, 106:48, and 150 itself). The Number view groups
 * by these.
 */
export const PSALTER_BOOKS: { label: string; from: number; to: number }[] = [
  { label: "Book I", from: 1, to: 41 },
  { label: "Book II", from: 42, to: 72 },
  { label: "Book III", from: 73, to: 89 },
  { label: "Book IV", from: 90, to: 106 },
  { label: "Book V", from: 107, to: 150 },
];

/**
 * The seven collections of Proverbs, bounded by the book's own
 * superscriptions: 1:1, 10:1, the turn at 22:17 ("the words of the wise"),
 * 24:23 ("these things also belong to the wise"), 25:1 ("which the men of
 * Hezekiah king of Judah copied out"), 30:1 (Agur), and 31:1 (Lemuel).
 */
export interface ProverbSection {
  id: string;
  title: string;
  fromChapter: number;
  fromVerse: number;
  toChapter: number;
  toVerse: number;
  /** One honest line on the collection. */
  about: string;
}

export const PROVERB_SECTIONS: ProverbSection[] = [
  {
    id: "discourses",
    title: "The Discourses of Wisdom",
    fromChapter: 1,
    fromVerse: 1,
    toChapter: 9,
    toVerse: 18,
    about: "A father's extended plea to take up wisdom, crowned by wisdom's own voice.",
  },
  {
    id: "solomon-1",
    title: "The First Collection of Solomon",
    fromChapter: 10,
    fromVerse: 1,
    toChapter: 22,
    toVerse: 16,
    about: "Solomon's two-line proverbs, gathered without stated order.",
  },
  {
    id: "words-of-wise",
    title: "The Words of the Wise",
    fromChapter: 22,
    fromVerse: 17,
    toChapter: 24,
    toVerse: 22,
    about: "Thirty sayings of the wise, kin to Egypt's Instruction of Amenemope.",
  },
  {
    id: "more-sayings",
    title: "Further Sayings of the Wise",
    fromChapter: 24,
    fromVerse: 23,
    toChapter: 24,
    toVerse: 34,
    about: "A short appendix on justice, diligence, and the sluggard's field.",
  },
  {
    id: "solomon-2",
    title: "The Second Collection of Solomon",
    fromChapter: 25,
    fromVerse: 1,
    toChapter: 29,
    toVerse: 27,
    about: "More proverbs of Solomon, copied out by the men of Hezekiah.",
  },
  {
    id: "agur",
    title: "The Words of Agur",
    fromChapter: 30,
    fromVerse: 1,
    toChapter: 30,
    toVerse: 33,
    about: "Agur's humble confession, his numbered sayings, and his warnings.",
  },
  {
    id: "lemuel",
    title: "The Words of Lemuel",
    fromChapter: 31,
    fromVerse: 1,
    toChapter: 31,
    toVerse: 31,
    about: "A mother's oracle to her king, closing in the acrostic portrait of the excellent wife.",
  },
];

/* ------------------------- statistics over the KJV ------------------------- */

/** One psalm's full explorer row: the metadata joined to its counts. */
export interface PsalmExplorerEntry extends PsalmMeta {
  verses: number;
  words: number;
}

export interface PsalmsExplorerPayload {
  genres: PsalmGenreInfo[];
  books: { label: string; from: number; to: number }[];
  psalms: PsalmExplorerEntry[];
}

/** One collection's full explorer row: the section joined to its counts. */
export interface ProverbSectionEntry extends ProverbSection {
  /** Display form, e.g. "Proverbs 22:17–24:22". */
  ref: string;
  verses: number;
  words: number;
}

let psalmsCache: Promise<PsalmsExplorerPayload> | null = null;
let proverbsCache: Promise<ProverbSectionEntry[]> | null = null;

/**
 * The Psalms Explorer payload: all 150 psalms with their statistics. The
 * counts walk the shipped KJV psalm by psalm with query.ts's tokenization,
 * the bookmeta discipline, and the payload caches at module scope the way
 * the data libs cache their raw files.
 */
export function buildPsalmsExplorer(): Promise<PsalmsExplorerPayload> {
  if (psalmsCache) return psalmsCache;
  psalmsCache = (async () => {
    const psalms: PsalmExplorerEntry[] = [];
    for (const meta of PSALM_META) {
      const rows = await getChapter("psalms", meta.psalm);
      if (!rows) throw new Error(`wisdommeta: KJV text missing for Psalm ${meta.psalm}`);
      let words = 0;
      for (const row of rows) words += verseWords(row.text).length;
      psalms.push({ ...meta, verses: rows.length, words });
    }
    return { genres: PSALM_GENRES, books: PSALTER_BOOKS, psalms };
  })();
  return psalmsCache;
}

/** The Proverbs Explorer payload: the seven collections with their counts. */
export function buildProverbsExplorer(): Promise<ProverbSectionEntry[]> {
  if (proverbsCache) return proverbsCache;
  proverbsCache = (async () => {
    const sections: ProverbSectionEntry[] = [];
    for (const section of PROVERB_SECTIONS) {
      let verses = 0;
      let words = 0;
      for (let ch = section.fromChapter; ch <= section.toChapter; ch++) {
        const rows = await getChapter("proverbs", ch);
        if (!rows) throw new Error(`wisdommeta: KJV text missing for Proverbs ${ch}`);
        for (const row of rows) {
          if (ch === section.fromChapter && row.verse < section.fromVerse) continue;
          if (ch === section.toChapter && row.verse > section.toVerse) continue;
          verses += 1;
          words += verseWords(row.text).length;
        }
      }
      const start = `${section.fromChapter}:${section.fromVerse}`;
      const end =
        section.fromChapter === section.toChapter
          ? `${section.toVerse}`
          : `${section.toChapter}:${section.toVerse}`;
      sections.push({ ...section, ref: `Proverbs ${start}–${end}`, verses, words });
    }
    return sections;
  })();
  return proverbsCache;
}
