/**
 * The names of God: the received names and titles, hand-built for the Tools
 * pane's table. Each entry carries its meaning, the first or key occurrence
 * deep-linked into the reader, and one honest line of note. The Hebrew
 * compounds (the Yahweh- names) are place and altar names as often as
 * titles, and the table reads them as they stand.
 *
 * Sources: the name lists of the standard reference works (New Bible
 * Dictionary and ISBE, "Names of God"; the Scofield notes on the compound
 * names; Young's and Strong's lexicons for the meanings). Renderings of the
 * compounds differ among the works: Yahweh-Yireh as "will provide" or "will
 * see to it", El Shaddai's root disputed. The table gives the received
 * sense and leaves the disputes to the dictionaries.
 */

export interface NameRef {
  book: string;
  chapter: number;
  /** The display label, verse included, e.g. "Exodus 3:14". */
  label: string;
}

export interface NameOfGod {
  name: string;
  meaning: string;
  ref: NameRef;
  note: string;
}

/** The Old Testament names, in the order the text first gives them. */
export const OT_NAMES: NameOfGod[] = [
  {
    name: "Elohim",
    meaning: "God, the strong One",
    ref: { book: "genesis", chapter: 1, label: "Genesis 1:1" },
    note: "The first name in Scripture; plural in form, singular in its verbs, the Creator of all.",
  },
  {
    name: "El Elyon",
    meaning: "God Most High",
    ref: { book: "genesis", chapter: 14, label: "Genesis 14:18" },
    note: "Melchizedek's title for the possessor of heaven and earth.",
  },
  {
    name: "Adonai",
    meaning: "Lord, Master",
    ref: { book: "genesis", chapter: 15, label: "Genesis 15:2" },
    note: "The title of ownership and rule; spoken aloud where the covenant name stands.",
  },
  {
    name: "El Roi",
    meaning: "the God who sees",
    ref: { book: "genesis", chapter: 16, label: "Genesis 16:13" },
    note: "Hagar's name in the wilderness, for the God who found her.",
  },
  {
    name: "El Shaddai",
    meaning: "God Almighty",
    ref: { book: "genesis", chapter: 17, label: "Genesis 17:1" },
    note: "The name under which the covenant of circumcision was given to Abraham.",
  },
  {
    name: "El Olam",
    meaning: "the Everlasting God",
    ref: { book: "genesis", chapter: 21, label: "Genesis 21:33" },
    note: "Abraham's name at Beersheba, the God without beginning or end.",
  },
  {
    name: "Yahweh-Yireh",
    meaning: "the LORD will provide",
    ref: { book: "genesis", chapter: 22, label: "Genesis 22:14" },
    note: "Abraham's name for Moriah after the ram took Isaac's place.",
  },
  {
    name: "YHWH",
    meaning: "the covenant name, \"I AM WHO I AM\"",
    ref: { book: "exodus", chapter: 3, label: "Exodus 3:14" },
    note: "Israel's personal name for God, some 6,800 times in the text; the KJV prints it LORD in small capitals.",
  },
  {
    name: "Yahweh-Rapha",
    meaning: "the LORD who heals",
    ref: { book: "exodus", chapter: 15, label: "Exodus 15:26" },
    note: "Named at Marah, where the bitter water went sweet.",
  },
  {
    name: "Yahweh-Nissi",
    meaning: "the LORD my banner",
    ref: { book: "exodus", chapter: 17, label: "Exodus 17:15" },
    note: "Moses' altar after Amalek fell, his hands held up until sunset.",
  },
  {
    name: "Yahweh-M'Kaddesh",
    meaning: "the LORD who sanctifies",
    ref: { book: "leviticus", chapter: 20, label: "Leviticus 20:8" },
    note: "The God who sets his people apart, and says so in the law.",
  },
  {
    name: "Yahweh-Shalom",
    meaning: "the LORD is peace",
    ref: { book: "judges", chapter: 6, label: "Judges 6:24" },
    note: "Gideon's altar at Ophrah, built where the angel spoke peace to him.",
  },
  {
    name: "Yahweh-Sabaoth",
    meaning: "the LORD of hosts",
    ref: { book: "1-samuel", chapter: 1, label: "1 Samuel 1:3" },
    note: "The commander of heaven's armies; first named at Shiloh.",
  },
  {
    name: "Yahweh-Tsidkenu",
    meaning: "the LORD our righteousness",
    ref: { book: "jeremiah", chapter: 23, label: "Jeremiah 23:6" },
    note: "The name of the coming Branch, David's righteous heir.",
  },
  {
    name: "Yahweh-Shammah",
    meaning: "the LORD is there",
    ref: { book: "ezekiel", chapter: 48, label: "Ezekiel 48:35" },
    note: "The name of the city in Ezekiel's closing vision.",
  },
];

/** The New Testament's names and titles for him, the list's second table. */
export const NT_NAMES: NameOfGod[] = [
  {
    name: "Immanuel",
    meaning: "God with us",
    ref: { book: "matthew", chapter: 1, label: "Matthew 1:23" },
    note: "Isaiah's sign to Ahaz (Isaiah 7:14), fulfilled at Bethlehem.",
  },
  {
    name: "The Word",
    meaning: "God's self-expression, made flesh",
    ref: { book: "john", chapter: 1, label: "John 1:1" },
    note: "John's name for the Son before Bethlehem: with God, and God.",
  },
  {
    name: "Alpha and Omega",
    meaning: "the first and the last",
    ref: { book: "revelation", chapter: 1, label: "Revelation 1:8" },
    note: "The Lord God's own title near the canon's end, the beginning and the ending.",
  },
];
