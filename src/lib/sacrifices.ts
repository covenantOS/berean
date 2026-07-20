/**
 * The offerings of the law: the five Levitical sacrifices, hand-built for
 * the Tools pane's table. Each entry carries what was offered, who brought
 * it, its purpose, and the key text deep-linked into the reader. The two
 * appointed observances that turn on an offering, the day of atonement and
 * the Passover, follow as a second table; they are days, not offerings,
 * and the table reads them as they stand.
 *
 * Sources: Leviticus 1–7 for the five offerings, Leviticus 16 for the day
 * of atonement, Exodus 12 for the Passover; the dictionary articles of the
 * standard reference works (New Bible Dictionary and ISBE, "Sacrifice and
 * Offerings") for the purposes. The names carry the received Hebrew terms
 * in transliteration; the peace offering is the fellowship offering of the
 * newer versions, the guilt offering the trespass offering of the older.
 */

export interface SacrificeRef {
  book: string;
  chapter: number;
  /** The display label, verses included, e.g. "Leviticus 1:3–9". */
  label: string;
}

export interface Sacrifice {
  name: string;
  /** The received Hebrew term, transliterated. */
  hebrew: string;
  /** What was offered. */
  offered: string;
  /** Who brought it. */
  broughtBy: string;
  /** Its purpose. */
  purpose: string;
  ref: SacrificeRef;
}

/** The five offerings of Leviticus 1–7, in the law's own order. */
export const LEVITICAL_OFFERINGS: Sacrifice[] = [
  {
    name: "Burnt offering",
    hebrew: "olah, the one that goes up",
    offered:
      "An unblemished male of the herd or flock, or a turtledove or pigeon; burned whole on the altar, nothing eaten.",
    broughtBy: "Any Israelite, each bringing according to his means.",
    purpose:
      "Atonement and entire consecration: the whole life given up to God, a pleasing aroma ascending.",
    ref: { book: "leviticus", chapter: 1, label: "Leviticus 1:3–9" },
  },
  {
    name: "Grain offering",
    hebrew: "minchah, the gift",
    offered:
      "Fine flour with oil and frankincense, baked, griddled, or raw; no leaven and no honey, salt always.",
    broughtBy: "Any Israelite; the one offering no animal could still bring this.",
    purpose:
      "Tribute and thanksgiving: a memorial portion burned to the LORD, the remainder the priests' bread.",
    ref: { book: "leviticus", chapter: 2, label: "Leviticus 2:1–3" },
  },
  {
    name: "Peace offering",
    hebrew: "shelamim, the fellowship",
    offered:
      "An unblemished male or female of the herd or flock; the fat burned, the breast and thigh the priests', the rest the offerer's meal.",
    broughtBy: "Any Israelite, in thanksgiving, in a vow, or freely.",
    purpose:
      "Communion: God, priest, and worshipper sharing one table, the only offering the offerer ate.",
    ref: { book: "leviticus", chapter: 3, label: "Leviticus 3:1–5" },
  },
  {
    name: "Sin offering",
    hebrew: "chattath, the purification",
    offered:
      "A bull for the priest or the congregation, a male goat for a ruler, a female goat or lamb for anyone else, birds or flour for the poor.",
    broughtBy: "The one who sinned without intending it, when the sin came to light.",
    purpose:
      "Purification: unintended sin covered and the defiled sanctuary cleansed, the blood carried toward the holy place.",
    ref: { book: "leviticus", chapter: 4, label: "Leviticus 4:1–3" },
  },
  {
    name: "Guilt offering",
    hebrew: "asham, the trespass",
    offered:
      "An unblemished ram, its value in silver shekels, with restitution and a fifth part added.",
    broughtBy: "The one who wronged the LORD's holy things or his neighbor and made it good.",
    purpose:
      "Reparation: the debt repaid in full and a fifth besides, then forgiveness at the altar.",
    ref: { book: "leviticus", chapter: 5, label: "Leviticus 5:14–16" },
  },
];

/**
 * The appointed days that turn on an offering. They are observances rather
 * than offerings of the five, and the table keeps them beside, not among.
 */
export const APPOINTED_OBSERVANCES: Sacrifice[] = [
  {
    name: "Day of Atonement",
    hebrew: "yom kippur, the day of covering",
    offered:
      "A bull for Aaron's house, two goats for the people (one for the LORD, one bearing the sins away), and rams for burnt offerings.",
    broughtBy: "The high priest alone, once a year, entering the holy of holies.",
    purpose:
      "The nation's yearly cleansing: sanctuary, altar, and people made clean from all their sins.",
    ref: { book: "leviticus", chapter: 16, label: "Leviticus 16:29–34" },
  },
  {
    name: "Passover",
    hebrew: "pesach, the passing over",
    offered:
      "An unblemished year-old male lamb or kid for each household, its blood on the doorposts, eaten roasted with unleavened bread and bitter herbs.",
    broughtBy: "Every household of Israel, the father answering the son who asks.",
    purpose:
      "Remembrance: the night the LORD passed over the marked houses and brought Israel out of Egypt.",
    ref: { book: "exodus", chapter: 12, label: "Exodus 12:3–14" },
  },
];
