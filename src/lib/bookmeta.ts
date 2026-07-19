import { CANON } from "./canon";
import { getChapter } from "./bible";
import { verseWords } from "./query";

/**
 * Canon and book metadata: the hand-built per-book dataset behind the Bible
 * Books Explorer. Each of the sixty-six books carries its human author as
 * the church has received it, its genre, an approximate composition range,
 * and one honest line on its contents; chapter counts come from canon.ts and
 * the verse and word statistics are computed from the shipped KJV text.
 *
 * Attribution honesty: self-identifying authors stand bare ("Isaiah",
 * "Paul"); authors the church received by tradition rather than by the
 * text's own signature carry "(traditional)" (the Pentateuch, the Gospels);
 * Hebrews and Esther carry "Unknown", and 2 Peter carries "(contested)"
 * because the dispute reaches inside conservative scholarship.
 *
 * Date honesty: the ranges follow the conservative introductions (the ESV
 * Study Bible family, Ussher's chronology for the early Old Testament) and
 * are approximate by construction, stated as approximate wherever the pane
 * shows them. BC years are negative numbers. Job and Joel are dated
 * genuinely uncertain even among conservative scholars; their ranges are
 * wide on purpose.
 */

export type BookGenre =
  | "law"
  | "history"
  | "wisdom"
  | "poetry"
  | "prophecy"
  | "gospel"
  | "acts"
  | "epistle"
  | "apocalypse";

export interface BookGenreInfo {
  id: BookGenre;
  label: string;
}

/** The genre taxonomy, in the order the canon first earns each kind. */
export const BOOK_GENRES: BookGenreInfo[] = [
  { id: "law", label: "Law" },
  { id: "history", label: "History" },
  { id: "wisdom", label: "Wisdom" },
  { id: "poetry", label: "Poetry" },
  { id: "prophecy", label: "Prophecy" },
  { id: "gospel", label: "Gospel" },
  { id: "acts", label: "Acts" },
  { id: "epistle", label: "Epistle" },
  { id: "apocalypse", label: "Apocalypse" },
];

export interface BookMeta {
  slug: string;
  /** The human author as received; tradition and disputes marked. */
  author: string;
  genre: BookGenre;
  /** Approximate composition range, earliest and latest; BC years negative. */
  writtenFrom: number;
  writtenTo: number;
  /** One honest line on the book's contents. */
  about: string;
}

/* The Torah: Mosaic authorship as received (John 5:46, 2 Chr 34:14), written
 * during the wilderness years between the exodus and Moses' death. */
const MOSES = "Moses (traditional)";
const TORAH: [number, number] = [-1446, -1406];

export const BOOK_META: BookMeta[] = [
  { slug: "genesis", author: MOSES, genre: "law", writtenFrom: TORAH[0], writtenTo: TORAH[1], about: "Creation, the fall, the flood, and the patriarchs from Abraham to Joseph." },
  { slug: "exodus", author: MOSES, genre: "law", writtenFrom: TORAH[0], writtenTo: TORAH[1], about: "Israel delivered from Egypt, covenanted at Sinai, and given the tabernacle." },
  { slug: "leviticus", author: MOSES, genre: "law", writtenFrom: TORAH[0], writtenTo: TORAH[1], about: "The sacrifices, the priesthood, and the holiness code of the covenant." },
  { slug: "numbers", author: MOSES, genre: "law", writtenFrom: TORAH[0], writtenTo: TORAH[1], about: "The wilderness census, the forty years, and the approach to the Jordan." },
  { slug: "deuteronomy", author: MOSES, genre: "law", writtenFrom: -1446, writtenTo: -1406, about: "Moses' farewell sermons renewing the covenant on the plains of Moab." },
  { slug: "joshua", author: "Joshua (traditional)", genre: "history", writtenFrom: -1400, writtenTo: -1350, about: "The conquest and division of the promised land." },
  // The Talmud names Samuel for Judges and Ruth; the texts themselves are unsigned.
  { slug: "judges", author: "Samuel (traditional)", genre: "history", writtenFrom: -1050, writtenTo: -1000, about: "The cycle of apostasy, oppression, and deliverance before the kings." },
  { slug: "ruth", author: "Samuel (traditional)", genre: "history", writtenFrom: -1050, writtenTo: -1000, about: "A Moabite widow's loyalty, and David's line preserved in famine days." },
  // 1 Chr 29:29 grounds the tradition that Samuel, Nathan, and Gad wrote the record.
  { slug: "1-samuel", author: "Samuel, Nathan, and Gad (traditional)", genre: "history", writtenFrom: -1050, writtenTo: -970, about: "The rise of the monarchy: Samuel, Saul, and David's anointing." },
  { slug: "2-samuel", author: "Samuel, Nathan, and Gad (traditional)", genre: "history", writtenFrom: -970, writtenTo: -900, about: "David's reign in full: the covenant, the sin, and the consequences." },
  // The Talmud names Jeremiah for Kings; the record ends with Jehoiachin's release, before the return.
  { slug: "1-kings", author: "Jeremiah (traditional)", genre: "history", writtenFrom: -561, writtenTo: -538, about: "Solomon's glory, the kingdom divided, and the prophets' rise." },
  { slug: "2-kings", author: "Jeremiah (traditional)", genre: "history", writtenFrom: -561, writtenTo: -538, about: "Both kingdoms carried away: Israel to Assyria, Judah to Babylon." },
  { slug: "1-chronicles", author: "Ezra (traditional)", genre: "history", writtenFrom: -450, writtenTo: -425, about: "The genealogies and David's reign, retold for the restored people." },
  { slug: "2-chronicles", author: "Ezra (traditional)", genre: "history", writtenFrom: -450, writtenTo: -425, about: "Solomon's temple through the exile, retold for the restored people." },
  { slug: "ezra", author: "Ezra (traditional)", genre: "history", writtenFrom: -460, writtenTo: -440, about: "The return from Babylon and the temple rebuilt under Ezra's reforms." },
  { slug: "nehemiah", author: "Nehemiah (traditional)", genre: "history", writtenFrom: -445, writtenTo: -420, about: "Jerusalem's walls rebuilt and the covenant renewed under Nehemiah." },
  { slug: "esther", author: "Unknown", genre: "history", writtenFrom: -470, writtenTo: -430, about: "The Jews preserved in Persia through Esther and Mordecai; the feast of Purim." },
  // Job's date is genuinely uncertain: a patriarchal setting, an unknown writer,
  // and no anchor in the text. The range spans the honest guesses.
  { slug: "job", author: "Unknown", genre: "wisdom", writtenFrom: -2000, writtenTo: -1000, about: "A righteous man's suffering, his friends' counsel, and God's answer from the whirlwind." },
  // The superscriptions name David, Asaph, the sons of Korah, Solomon, Moses,
  // Heman, and Ethan; many psalms are unsigned. Psalm 90 to the post-exilic songs.
  { slug: "psalms", author: "David and others", genre: "poetry", writtenFrom: -1440, writtenTo: -430, about: "Israel's hymnbook: 150 songs of praise, lament, thanksgiving, and trust." },
  // Solomon chiefly (Prov 1:1), with Agur and Lemuel, copied through Hezekiah's men (Prov 25:1).
  { slug: "proverbs", author: "Solomon (chiefly)", genre: "wisdom", writtenFrom: -970, writtenTo: -700, about: "Wisdom's sayings for skill in living, gathered chiefly from Solomon." },
  { slug: "ecclesiastes", author: "Solomon (traditional)", genre: "wisdom", writtenFrom: -940, writtenTo: -931, about: "Qoheleth's search for meaning under the sun, ending in the fear of God." },
  { slug: "song-of-solomon", author: "Solomon (traditional)", genre: "poetry", writtenFrom: -970, writtenTo: -931, about: "A song of covenant love between a bridegroom and his bride." },
  { slug: "isaiah", author: "Isaiah", genre: "prophecy", writtenFrom: -740, writtenTo: -680, about: "Judgment and comfort: the Holy One of Israel, the Servant, and the coming kingdom." },
  { slug: "jeremiah", author: "Jeremiah", genre: "prophecy", writtenFrom: -627, writtenTo: -580, about: "The weeping prophet's warnings to Judah before Jerusalem's fall." },
  { slug: "lamentations", author: "Jeremiah (traditional)", genre: "poetry", writtenFrom: -586, writtenTo: -585, about: "Five acrostic laments over Jerusalem's ruin." },
  { slug: "ezekiel", author: "Ezekiel", genre: "prophecy", writtenFrom: -593, writtenTo: -565, about: "Visions of glory, judgment, and restoration among the exiles in Babylon." },
  { slug: "daniel", author: "Daniel (traditional)", genre: "prophecy", writtenFrom: -605, writtenTo: -530, about: "Faithfulness in Babylon, and visions of the kingdoms and the Son of Man." },
  { slug: "hosea", author: "Hosea", genre: "prophecy", writtenFrom: -755, writtenTo: -715, about: "A prophet's marriage as a living parable of God's covenant love." },
  // Joel's date is genuinely uncertain; the early placement (ninth century)
  // is the traditional conservative read, the post-exilic the critical one.
  { slug: "joel", author: "Joel", genre: "prophecy", writtenFrom: -835, writtenTo: -796, about: "The day of the LORD in locusts, judgment, and the Spirit poured out." },
  { slug: "amos", author: "Amos", genre: "prophecy", writtenFrom: -760, writtenTo: -750, about: "A herdsman's roar against the nations and prosperous Israel." },
  { slug: "obadiah", author: "Obadiah", genre: "prophecy", writtenFrom: -586, writtenTo: -553, about: "Edom judged for gloating over Jerusalem's fall." },
  { slug: "jonah", author: "Jonah (traditional)", genre: "prophecy", writtenFrom: -760, writtenTo: -720, about: "A runaway prophet and God's mercy on Nineveh." },
  { slug: "micah", author: "Micah", genre: "prophecy", writtenFrom: -742, writtenTo: -687, about: "Judgment and hope for both kingdoms; Bethlehem named for the Ruler." },
  { slug: "nahum", author: "Nahum", genre: "prophecy", writtenFrom: -663, writtenTo: -612, about: "Nineveh's fall announced: God's justice on the oppressor." },
  { slug: "habakkuk", author: "Habakkuk", genre: "prophecy", writtenFrom: -640, writtenTo: -609, about: "A prophet's questions answered: the just shall live by faith." },
  { slug: "zephaniah", author: "Zephaniah", genre: "prophecy", writtenFrom: -640, writtenTo: -609, about: "The day of the LORD sweeping through Judah and the nations." },
  { slug: "haggai", author: "Haggai", genre: "prophecy", writtenFrom: -520, writtenTo: -520, about: "Rebuild the house: four messages stirring the returned exiles." },
  { slug: "zechariah", author: "Zechariah", genre: "prophecy", writtenFrom: -520, writtenTo: -470, about: "Night visions and messianic promises for the temple builders." },
  { slug: "malachi", author: "Malachi", genre: "prophecy", writtenFrom: -460, writtenTo: -430, about: "The last prophetic word before the silence: covenant charges and the coming messenger." },
  // The Gospels and Acts are unsigned texts; the names ride on the uniform
  // tradition of the early church.
  { slug: "matthew", author: "Matthew (traditional)", genre: "gospel", writtenFrom: 50, writtenTo: 70, about: "Jesus the Messiah and King, written with Israel's Scriptures in view." },
  { slug: "mark", author: "Mark (traditional)", genre: "gospel", writtenFrom: 55, writtenTo: 65, about: "Jesus the Servant in swift action; the shortest gospel." },
  { slug: "luke", author: "Luke (traditional)", genre: "gospel", writtenFrom: 58, writtenTo: 65, about: "Jesus the Son of Man, an ordered account for Theophilus." },
  { slug: "john", author: "John (traditional)", genre: "gospel", writtenFrom: 85, writtenTo: 95, about: "Jesus the Son of God, written that readers may believe and live." },
  { slug: "acts", author: "Luke (traditional)", genre: "acts", writtenFrom: 62, writtenTo: 70, about: "The Spirit's work from Jerusalem to Rome: the church's first thirty years." },
  { slug: "romans", author: "Paul", genre: "epistle", writtenFrom: 56, writtenTo: 57, about: "The gospel of righteousness by faith, laid out for the church at Rome." },
  { slug: "1-corinthians", author: "Paul", genre: "epistle", writtenFrom: 53, writtenTo: 55, about: "Order for a fractured church: the cross, the body, and the resurrection." },
  { slug: "2-corinthians", author: "Paul", genre: "epistle", writtenFrom: 55, writtenTo: 56, about: "Paul's defense of his ministry and the grace of giving." },
  { slug: "galatians", author: "Paul", genre: "epistle", writtenFrom: 48, writtenTo: 55, about: "No other gospel: justification by faith apart from works of the law." },
  { slug: "ephesians", author: "Paul", genre: "epistle", writtenFrom: 60, writtenTo: 62, about: "The church as Christ's body, blessed with every spiritual blessing." },
  { slug: "philippians", author: "Paul", genre: "epistle", writtenFrom: 61, writtenTo: 62, about: "Joy in chains: the mind of Christ and pressing toward the prize." },
  { slug: "colossians", author: "Paul", genre: "epistle", writtenFrom: 60, writtenTo: 62, about: "Christ preeminent over every power and philosophy." },
  { slug: "1-thessalonians", author: "Paul", genre: "epistle", writtenFrom: 50, writtenTo: 51, about: "Comfort about the Lord's coming and the dead in Christ." },
  { slug: "2-thessalonians", author: "Paul", genre: "epistle", writtenFrom: 50, writtenTo: 51, about: "The man of lawlessness and the day of the Lord, correcting alarm." },
  { slug: "1-timothy", author: "Paul", genre: "epistle", writtenFrom: 62, writtenTo: 64, about: "Charge to Timothy: order the household of God." },
  { slug: "2-timothy", author: "Paul", genre: "epistle", writtenFrom: 66, writtenTo: 67, about: "Paul's last letter: guard the deposit, preach the word." },
  { slug: "titus", author: "Paul", genre: "epistle", writtenFrom: 62, writtenTo: 64, about: "Order for the Cretan churches: elders, sound doctrine, good works." },
  { slug: "philemon", author: "Paul", genre: "epistle", writtenFrom: 60, writtenTo: 62, about: "A runaway slave received back as a brother." },
  { slug: "hebrews", author: "Unknown", genre: "epistle", writtenFrom: 64, writtenTo: 68, about: "Christ better than angels, Moses, and Aaron; the new covenant's once-for-all sacrifice." },
  { slug: "james", author: "James, the Lord's brother", genre: "epistle", writtenFrom: 45, writtenTo: 48, about: "Faith that works: wisdom for the scattered twelve tribes." },
  { slug: "1-peter", author: "Peter", genre: "epistle", writtenFrom: 62, writtenTo: 64, about: "Living hope for exiles suffering under Rome." },
  // The Petrine authorship is disputed even among conservative scholars; the
  // letter stands in the canon and the dispute is named.
  { slug: "2-peter", author: "Peter (contested)", genre: "epistle", writtenFrom: 65, writtenTo: 68, about: "A farewell warning against false teachers, with the day of the Lord in view." },
  { slug: "1-john", author: "John (traditional)", genre: "epistle", writtenFrom: 90, writtenTo: 95, about: "Fellowship, love, and assurance against the deceivers." },
  { slug: "2-john", author: "John (traditional)", genre: "epistle", writtenFrom: 90, writtenTo: 95, about: "Walk in truth and love; receive no deceiver." },
  { slug: "3-john", author: "John (traditional)", genre: "epistle", writtenFrom: 90, writtenTo: 95, about: "Hospitality commended: Gaius, Diotrephes, and Demetrius." },
  { slug: "jude", author: "Jude, the Lord's brother", genre: "epistle", writtenFrom: 65, writtenTo: 80, about: "Contend for the faith once delivered against hidden intruders." },
  { slug: "revelation", author: "John", genre: "apocalypse", writtenFrom: 94, writtenTo: 96, about: "The unveiling of Jesus Christ: letters, seals, trumpets, bowls, and the city of God." },
];

const META_BY_SLUG = new Map(BOOK_META.map((m) => [m.slug, m]));

export function getBookMeta(slug: string): BookMeta | undefined {
  return META_BY_SLUG.get(slug);
}

/* ------------------------- statistics over the KJV ------------------------- */

/** One book's full explorer row: the canon record, the metadata, the counts. */
export interface BookExplorerEntry extends BookMeta {
  name: string;
  testament: "OT" | "NT";
  division: string;
  chapters: number;
  verses: number;
  words: number;
}

let explorerCache: Promise<BookExplorerEntry[]> | null = null;

/**
 * The explorer payload: every book's metadata joined to its statistics. The
 * counts walk the shipped KJV chapter by chapter (the reader's own path,
 * src/lib/bible.ts) with query.ts's tokenization, so a word here is a word
 * the concordance search would match. The payload caches at module scope the
 * way the data libs cache their raw files.
 */
export function buildBookExplorer(): Promise<BookExplorerEntry[]> {
  if (explorerCache) return explorerCache;
  explorerCache = (async () => {
    const entries: BookExplorerEntry[] = [];
    for (const book of CANON) {
      const meta = META_BY_SLUG.get(book.slug);
      if (!meta) throw new Error(`bookmeta: no metadata for ${book.slug}`);
      let verses = 0;
      let words = 0;
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        const rows = await getChapter(book.slug, chapter);
        if (!rows) throw new Error(`bookmeta: KJV text missing for ${book.slug} ${chapter}`);
        verses += rows.length;
        for (const row of rows) words += verseWords(row.text).length;
      }
      entries.push({
        ...meta,
        name: book.name,
        testament: book.testament,
        division: book.division,
        chapters: book.chapters,
        verses,
        words,
      });
    }
    return entries;
  })();
  return explorerCache;
}
