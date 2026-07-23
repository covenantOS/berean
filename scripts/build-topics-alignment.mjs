/**
 * Build the canonical topic alignment between Nave's Topical Bible and
 * Torrey's New Topical Textbook (both public domain, registered in
 * src/lib/rights.ts).
 *
 * Two topical works, two title conventions: Nave files "Angels" under
 * "Angel (a spirit)", and Torrey splits what Nave merges ("death of saints"
 * is its own Torrey entry; Nave covers it as the OF THE RIGHTEOUS section
 * of "Death"). This builder pairs the entries that carry the same concept
 * so the Topic Guide can show one canonical topic across both works.
 *
 * Rows come from two passes:
 *
 *   1. Token-key matches. Titles are normalized (lowercase, punctuation
 *      stripped, stopwords dropped, crude singulars) and paired on equal
 *      keys. Rows where either side carries no references (the source
 *      module's empty cross-reference shells) are dropped, and key
 *      collisions (two Nave entries sharing a key, e.g. "eye" and
 *      "eye for eye") resolve by exact id equality, then id equals key,
 *      then reference count.
 *   2. Hand-reviewed aliases (ALIAS below). Every alias was verified
 *      against the shipped entries: kind "entry" pairs two whole entries
 *      under different titles; kind "section" pairs a Torrey entry with
 *      the named section of the Nave entry that covers it (Nave merges
 *      what Torrey splits). The builder fails if an alias id is unknown
 *      or a claimed section label is absent from the Nave entry.
 *
 * Output: data/topics/alignment.json
 *
 * The alignment is Berean's own editorial work over two public-domain
 * texts; no new source is vendored.
 */
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const TOPICS = path.join(ROOT, "data", "topics");

const STOP = new Set(["the", "of", "or", "and", "a", "an", "to", "in", "on", "for", "with", "by", "under", "is", "c"]);
const sing = (w) =>
  w.endsWith("ies") ? w.slice(0, -3) + "y"
  : w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2)
  : w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") ? w.slice(0, -1)
  : w;
const toks = (s) => {
  const a = s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((x) => x && !STOP.has(x)).map(sing);
  return [...new Set(a)].sort().join(" ");
};

function countRefs(topic) {
  const walk = (nodes) => nodes.reduce((a, nd) => a + nd.refs.length + walk(nd.children), 0);
  return walk(topic.children);
}

function sectionLabels(topic) {
  const out = [];
  const walk = (nodes) => {
    for (const nd of nodes) {
      if (nd.label) out.push(nd.label);
      walk(nd.children ?? []);
    }
  };
  walk(topic.children);
  return out;
}

/**
 * Hand-reviewed aliases, keyed by Torrey id.
 *   naves:     the Nave entry carrying the same concept
 *   canonical: the shared canonical name (lowercase, matching the works'
 *              own title style; the pane capitalizes for display)
 *   kind:      "entry" when the Nave entry is the twin as a whole,
 *              "section" when the Torrey entry is covered as one named
 *              section of the Nave entry (section must name it)
 */
const ALIAS = {
  // Whole-entry twins under different titles.
  "woman": { naves: "women", canonical: "woman", kind: "entry" },
  "synagogues": { naves: "synagogue", canonical: "synagogue", kind: "entry" },
  "caves": { naves: "cave", canonical: "caves", kind: "entry" },
  "bottles": { naves: "bottle", canonical: "bottles", kind: "entry" },
  "hypocrites": { naves: "hypocrisy", canonical: "hypocrisy", kind: "entry" },
  "afflictions": { naves: "afflictions-and-adversities", canonical: "afflictions", kind: "entry" },
  "afflicted-duty-toward-the": { naves: "afflicted", canonical: "duty toward the afflicted", kind: "entry" },
  "agriculture-or-husbandry": { naves: "agriculture", canonical: "agriculture", kind: "entry" },
  "angels": { naves: "angel-a-spirit", canonical: "angels", kind: "entry" },
  "apostates": { naves: "apostasy", canonical: "apostasy", kind: "entry" },
  "backsliding": { naves: "backsliders", canonical: "backsliding", kind: "entry" },
  "asp-or-adder": { naves: "asp", canonical: "asp", kind: "entry" },
  "armies-of-israel-the": { naves: "armies", canonical: "armies", kind: "entry" },
  "boldness-holy": { naves: "boldness", canonical: "holy boldness", kind: "entry" },
  "brass-or-copper": { naves: "brass", canonical: "brass", kind: "entry" },
  "call-of-god-the": { naves: "call", canonical: "the call of God", kind: "entry" },
  "courts-of-justice": { naves: "court", canonical: "courts of justice", kind: "entry" },
  "daily-sacrifice-the": { naves: "daily-offering", canonical: "the daily sacrifice", kind: "entry" },
  "dog-the": { naves: "dog-sodomite", canonical: "dog", kind: "entry" },
  "dove-the": { naves: "dove-turtle", canonical: "dove", kind: "entry" },
  "idleness-and-sloth": { naves: "idleness", canonical: "idleness", kind: "entry" },
  "inspiration-of-the-holy-spirit-the": { naves: "inspiration", canonical: "inspiration", kind: "entry" },
  "jordan-the-river": { naves: "jordan", canonical: "the Jordan", kind: "entry" },
  "judea-modern": { naves: "judea", canonical: "Judea", kind: "entry" },
  "justification-before-god": { naves: "justification", canonical: "justification", kind: "entry" },
  "laver-of-brass": { naves: "laver", canonical: "the laver", kind: "entry" },
  "leaven": { naves: "leaven-yeast", canonical: "leaven", kind: "entry" },
  "long-suffering-of-god-the": { naves: "longsuffering", canonical: "the long-suffering of God", kind: "entry" },
  "magistrates": { naves: "magistrate", canonical: "magistrates", kind: "entry" },
  "medo-persian-kingdom": { naves: "persia", canonical: "the Medo-Persian kingdom", kind: "entry" },
  "mercy-of-god-the": { naves: "mercy", canonical: "the mercy of God", kind: "entry" },
  "ministers": { naves: "minister-christian", canonical: "ministers", kind: "entry" },
  "new-birth-the": { naves: "regeneration", canonical: "the new birth", kind: "entry" },
  "nile-the-river": { naves: "nile", canonical: "the Nile", kind: "entry" },
  "oak-tree-the": { naves: "oak", canonical: "the oak", kind: "entry" },
  "olive-tree-the": { naves: "olive", canonical: "the olive", kind: "entry" },
  "plague-or-pestilence-the": { naves: "plague", canonical: "plague", kind: "entry" },
  "pomegranate-tree-the": { naves: "pomegranate", canonical: "the pomegranate", kind: "entry" },
  "pools-and-ponds": { naves: "pool", canonical: "pools", kind: "entry" },
  "purifications-or-baptisms": { naves: "purification", canonical: "purifications", kind: "entry" },
  "rephaim-or-giants-the": { naves: "rephaim", canonical: "the Rephaim", kind: "entry" },
  "reward-of-saints-the": { naves: "reward", canonical: "the reward of saints", kind: "entry" },
  "scorning-and-mocking": { naves: "mocking", canonical: "mocking", kind: "entry" },
  "self-will-and-stubbornness": { naves: "self-will", canonical: "self-will", kind: "entry" },
  "shewbread": { naves: "shewbread-showbread", canonical: "the shewbread", kind: "entry" },
  "theft": { naves: "theft-and-thieves", canonical: "theft", kind: "entry" },
  "tribute": { naves: "tribute-taxes", canonical: "tribute", kind: "entry" },
  "unicorn": { naves: "unicorn-wild-ox-r-v", canonical: "the unicorn", kind: "entry" },
  "usury-or-interest": { naves: "usury", canonical: "usury", kind: "entry" },
  "vail-or-veil": { naves: "veil", canonical: "the veil", kind: "entry" },
  "vail-the-sacred": { naves: "vail", canonical: "the sacred vail", kind: "entry" },
  "waiting-upon-god": { naves: "waiting", canonical: "waiting on God", kind: "entry" },
  "walls": { naves: "walls-of-the-cities", canonical: "walls", kind: "entry" },
  "zeal": { naves: "zeal-religious", canonical: "zeal", kind: "entry" },
  "grace": { naves: "grace-of-god", canonical: "grace", kind: "entry" },
  "gifts-of-god-the": { naves: "gifts-from-god", canonical: "gifts from God", kind: "entry" },
  "law-of-god-the": { naves: "law", canonical: "the law of God", kind: "entry" },
  "doctrines-of-the-gospel-the": { naves: "doctrines", canonical: "doctrines", kind: "entry" },
  "diet-of-the-jews-the": { naves: "food", canonical: "food", kind: "entry" },
  "strangers-in-israel": { naves: "strangers", canonical: "strangers", kind: "entry" },
  "compassion-and-sympathy": { naves: "sympathy", canonical: "sympathy", kind: "entry" },
  "beasts": { naves: "animals", canonical: "beasts", kind: "entry" },
  "ox-the": { naves: "bullock", canonical: "the ox", kind: "entry" },
  "thanksgiving": { naves: "thankfulness", canonical: "thanksgiving", kind: "entry" },
  "roe-the": { naves: "deer", canonical: "the roe", kind: "entry" },
  "hart-the": { naves: "deer", canonical: "the hart", kind: "entry" },
  "sickness": { naves: "disease", canonical: "sickness", kind: "entry" },
  "uprightness": { naves: "righteousness", canonical: "uprightness", kind: "entry" },
  "fatherless": { naves: "orphan", canonical: "the fatherless", kind: "entry" },
  "deluge-the": { naves: "flood", canonical: "the deluge", kind: "entry" },
  "despair": { naves: "despondency", canonical: "despair", kind: "entry" },
  "devil-the": { naves: "satan", canonical: "the devil", kind: "entry" },
  "divination": { naves: "sorcery", canonical: "divination", kind: "entry" },
  "cities-of-refuge": { naves: "refuge", canonical: "cities of refuge", kind: "entry" },
  "trust": { naves: "faith", canonical: "trust", kind: "entry" },
  "charity": { naves: "love", canonical: "charity", kind: "entry" },
  "conversion": { naves: "regeneration", canonical: "conversion", kind: "entry" },
  "murder": { naves: "homicide", canonical: "murder", kind: "entry" },
  "steadfastness": { naves: "stability", canonical: "steadfastness", kind: "entry" },
  "sciences": { naves: "science", canonical: "the sciences", kind: "entry" },
  "tithe": { naves: "tithes", canonical: "the tithe", kind: "entry" },
  "nazarites": { naves: "nazarite", canonical: "Nazarites", kind: "entry" },
  "hedges": { naves: "hedge", canonical: "hedges", kind: "entry" },
  "shoes": { naves: "shoe", canonical: "shoes", kind: "entry" },
  "sieges": { naves: "siege", canonical: "sieges", kind: "entry" },
  "first-born-the": { naves: "firstborn", canonical: "the firstborn", kind: "entry" },
  "girdles": { naves: "girdle", canonical: "girdles", kind: "entry" },
  "obedience-to-god": { naves: "obedience", canonical: "obedience", kind: "entry" },
  "communion-of-the-lords-supper": { naves: "eucharist-the-lords-supper", canonical: "the Lord's Supper", kind: "entry" },
  // The twelve tribe entries, Torrey's "X, the tribe of" against Nave's "X".
  "asher-the-tribe-of": { naves: "asher", canonical: "Asher", kind: "entry" },
  "benjamin-tribe-of": { naves: "benjamin", canonical: "Benjamin", kind: "entry" },
  "dan-the-tribe-of": { naves: "dan", canonical: "Dan", kind: "entry" },
  "ephraim-tribe-of": { naves: "ephraim", canonical: "Ephraim", kind: "entry" },
  "gad-the-tribe-of": { naves: "gad", canonical: "Gad", kind: "entry" },
  "issachar-the-tribe-of": { naves: "issachar", canonical: "Issachar", kind: "entry" },
  "judah-the-tribe-of": { naves: "judah", canonical: "Judah", kind: "entry" },
  "manasseh-the-tribe-of": { naves: "manasseh", canonical: "Manasseh", kind: "entry" },
  "naphtali-the-tribe-of": { naves: "naphtali", canonical: "Naphtali", kind: "entry" },
  "reuben-the-tribe-of": { naves: "reuben", canonical: "Reuben", kind: "entry" },
  "simeon-the-tribe-of": { naves: "simeon", canonical: "Simeon", kind: "entry" },
  "zebulun-the-tribe-of": { naves: "zebulun", canonical: "Zebulun", kind: "entry" },
  // The appointed feasts, Torrey's "feast of X" against Nave's "X".
  "feast-of-jubilee-the": { naves: "jubilee", canonical: "the Jubilee", kind: "entry" },
  "feast-of-pentecost-the": { naves: "pentecost", canonical: "Pentecost", kind: "entry" },
  "feast-of-purim-or-lots-the": { naves: "purim", canonical: "Purim", kind: "entry" },
  "feast-of-sabbatical-year-the": { naves: "sabbatic-year", canonical: "the sabbatic year", kind: "entry" },
  "feast-of-the-new-moon-the": { naves: "new-moon", canonical: "the new moon", kind: "entry" },
  "feast-of-the-passover-the": { naves: "passover", canonical: "the Passover", kind: "entry" },
  "feasts-of-trumpets-the": { naves: "trumpets", canonical: "the feast of trumpets", kind: "entry" },
  // Torrey entries covered as one named section of the Nave entry
  // (Nave merges what Torrey splits). The section label must appear in
  // the Nave entry's own tree; the builder fails when it does not.
  "afflicted-saints": { naves: "afflictions-and-adversities", canonical: "afflicted saints", kind: "section", section: "OF SAINTS" },
  "affliction-consolation-under": { naves: "afflictions-and-adversities", canonical: "consolation under affliction", kind: "section", section: "CONSOLATION IN" },
  "affliction-prayer-under": { naves: "afflictions-and-adversities", canonical: "prayer under affliction", kind: "section", section: "PRAYER IN" },
  "afflictions-made-beneficial": { naves: "afflictions-and-adversities", canonical: "afflictions made beneficial", kind: "section", section: "BENEFITS OF" },
  "afflictions-of-the-wicked-the": { naves: "afflictions-and-adversities", canonical: "the afflictions of the wicked", kind: "section", section: "OF THE WICKED" },
  "anger-of-god-the": { naves: "anger", canonical: "the anger of God", kind: "section", section: "ANGER OF GOD" },
  "anointing-sacred": { naves: "anointing", canonical: "sacred anointing", kind: "section", section: "IN CONSECRATION" },
  "ark-of-the-covenant": { naves: "ark", canonical: "the ark of the covenant", kind: "section", section: "IN THE TABERNACLE" },
  "ascension-of-christ-the": { naves: "ascension", canonical: "the ascension of Christ", kind: "section", section: "Of Jesus" },
  "atonement-the-day-of": { naves: "atonement", canonical: "the day of atonement", kind: "section", section: "DAY OF" },
  "atonement-under-the-law": { naves: "atonement", canonical: "atonement under the law", kind: "section", section: "MADE BY ANIMAL SACRIFICES" },
  "baptism-with-the-holy-spirit": { naves: "baptism", canonical: "baptism with the Holy Spirit", kind: "section", section: "OF THE HOLY SPIRIT" },
  "blindness-spiritual": { naves: "blindness", canonical: "spiritual blindness", kind: "section", section: "SPIRITUAL" },
  "calf-of-gold": { naves: "calf", canonical: "the golden calf", kind: "section", section: "Golden, made by Aaron" },
  "calves-of-jeroboam": { naves: "calf", canonical: "the calves of Jeroboam", kind: "section", section: "Images of, set up in Beth-el and Dan by Jeroboam" },
  "care-overmuch": { naves: "care", canonical: "overmuch care", kind: "section", section: "WORLDLY" },
  "character-of-saints": { naves: "character", canonical: "the character of saints", kind: "section", section: "OF SAINTS" },
  "character-of-the-wicked": { naves: "character", canonical: "the character of the wicked", kind: "section", section: "OF THE WICKED" },
  "cloud-of-glory": { naves: "cloud", canonical: "the cloud of glory", kind: "section", section: "PILLAR OF" },
  "communion-with-god": { naves: "communion", canonical: "communion with God", kind: "section", section: "WITH GOD" },
  "communion-of-saints": { naves: "communion", canonical: "the communion of saints", kind: "section", section: "OF SAINTS" },
  "confessing-christ": { naves: "confession", canonical: "confessing Christ", kind: "section", section: "OF CHRIST" },
  "confession-of-sin": { naves: "confession", canonical: "the confession of sin", kind: "section", section: "OF SIN" },
  "death-of-saints-the": { naves: "death", canonical: "the death of saints", kind: "section", section: "OF THE RIGHTEOUS" },
  "death-of-the-wicked-the": { naves: "death", canonical: "the death of the wicked", kind: "section", section: "OF THE WICKED" },
  "death-spiritual": { naves: "death", canonical: "spiritual death", kind: "section", section: "SPIRITUAL" },
  "death-eternal": { naves: "death", canonical: "eternal death", kind: "section", section: "SECOND" },
  "doctrines-false": { naves: "doctrines", canonical: "false doctrines", kind: "section", section: "FALSE" },
  "early-rising": { naves: "rising", canonical: "early rising", kind: "section", section: "EARLY" },
  "example-of-christ-the": { naves: "example", canonical: "the example of Christ", kind: "section", section: "CHRIST, OUR" },
  "faithfulness-of-god-the": { naves: "faithfulness", canonical: "the faithfulness of God", kind: "section", section: "OF GOD" },
  "forgiveness-of-injuries": { naves: "forgiveness", canonical: "the forgiveness of injuries", kind: "section", section: "OF ENEMIES" },
  "glory-of-god-the": { naves: "glory", canonical: "the glory of God", kind: "section", section: "OF GOD" },
  "happiness-of-saints-in-this-life": { naves: "happiness", canonical: "the happiness of saints", kind: "section", section: "OF THE RIGHTEOUS" },
  "happiness-of-the-wicked-the": { naves: "happiness", canonical: "the happiness of the wicked", kind: "section", section: "OF THE WICKED" },
  "heart-character-of-the-renewed": { naves: "heart", canonical: "the renewed heart", kind: "section", section: "RENEWED" },
  "heart-character-of-the-unrenewed": { naves: "heart", canonical: "the unrenewed heart", kind: "section", section: "THE UNREGENERATE" },
  "high-priest-the": { naves: "priest", canonical: "the high priest", kind: "section", section: "HIGH PRIEST" },
  "holy-land": { naves: "canaan", canonical: "the Holy Land", kind: "section", section: "Land of" },
  "ingratitude-to-god": { naves: "ingratitude", canonical: "ingratitude to God", kind: "section", section: "OF MAN TO GOD" },
  "joy-of-god-over-his-people-the": { naves: "joy", canonical: "the joy of God over his people", kind: "section", section: "Attributed to God" },
  "law-of-moses-the": { naves: "law", canonical: "the law of Moses", kind: "section", section: "OF MOSES" },
  "liberty-christian": { naves: "liberty", canonical: "Christian liberty", kind: "section", section: "FIGURATIVE" },
  "life-eternal": { naves: "life", canonical: "eternal life", kind: "section", section: "EVERLASTING" },
  "life-spiritual": { naves: "life", canonical: "spiritual life", kind: "section", section: "SPIRITUAL" },
  "miracles-of-christ-the": { naves: "miracles", canonical: "the miracles of Christ", kind: "section", section: "OF JESUS, IN CHRONOLOGICAL ORDER" },
  "miraculous-gifts-of-the-holy-spirit": { naves: "miracles", canonical: "the miraculous gifts of the Holy Spirit", kind: "section", section: "MIRACULOUS GIFTS OF THE HOLY SPIRIT" },
  "sin-offering": { naves: "offerings", canonical: "the sin offering", kind: "section", section: "SIN" },
  "trespass-offering": { naves: "offerings", canonical: "the trespass offering", kind: "section", section: "TRESPASS" },
  "wave-offering": { naves: "offerings", canonical: "the wave offering", kind: "section", section: "WAVE" },
  "burnt-offering-the": { naves: "offerings", canonical: "the burnt offering", kind: "section", section: "BURNT" },
  "drink-offering": { naves: "offerings", canonical: "the drink offering", kind: "section", section: "DRINK" },
  "heave-offering": { naves: "offerings", canonical: "the heave offering", kind: "section", section: "HEAVE" },
  "meat-offerings": { naves: "offerings", canonical: "the meat offering", kind: "section", section: "MEAT" },
  "pardon": { naves: "forgiveness", canonical: "pardon", kind: "section", section: "OF SINS" },
  "peace-spiritual": { naves: "peace", canonical: "spiritual peace", kind: "section", section: "SPIRITUAL" },
  "power-of-christ-the": { naves: "power", canonical: "the power of Christ", kind: "section", section: "OF CHRIST" },
  "power-of-god-the": { naves: "power", canonical: "the power of God", kind: "section", section: "OF GOD" },
  "power-of-the-holy-spirit-the": { naves: "power", canonical: "the power of the Holy Spirit", kind: "section", section: "OF THE HOLY SPIRIT" },
  "prayer-answers-to": { naves: "prayer", canonical: "answers to prayer", kind: "section", section: "ANSWERED" },
  "prayer-intercessory": { naves: "prayer", canonical: "intercessory prayer", kind: "section", section: "INTERCESSORY" },
  "precious-stones": { naves: "stones", canonical: "precious stones", kind: "section", section: "PRECIOUS" },
  "reconciliation-with-god": { naves: "reconciliation", canonical: "reconciliation with God", kind: "section", section: "BETWEEN GOD AND MAN" },
  "righteousness-imputed": { naves: "righteousness", canonical: "imputed righteousness", kind: "section", section: "Counted (regarded) for the sake of obedience" },
  "sins-national": { naves: "sin", canonical: "national sins", kind: "section", section: "NATIONAL, PUNISHMENT OF" },
  "temple-the-first": { naves: "temple", canonical: "the first temple", kind: "section", section: "SOLOMON" },
  "temple-the-second": { naves: "temple", canonical: "the second temple", kind: "section", section: "THE SECOND" },
  "types-of-christ": { naves: "types", canonical: "types of Christ", kind: "section", section: "OF THE SAVIOUR" },
  "unity-of-god": { naves: "unity", canonical: "the unity of God", kind: "section", section: "OF THE GODHEAD" },
};

/** Auto rows to suppress even when the token keys match (none needed so
 * far; kept so future data refreshes can veto a false friend). */
const VETO = new Set();

export { ALIAS, toks, countRefs, sectionLabels };

async function main() {
  const naves = JSON.parse(await fs.readFile(path.join(TOPICS, "naves.json"), "utf8"));
  const torreys = JSON.parse(await fs.readFile(path.join(TOPICS, "torreys.json"), "utf8"));
  const naveById = new Map(naves.topics.map((t) => [t.id, t]));
  const torreyById = new Map(torreys.topics.map((t) => [t.id, t]));

  const errors = [];
  const rows = new Map(); // torrey id -> row

  // Pass 1: token-key matches.
  const naveByKey = new Map();
  for (const x of naves.topics) {
    const k = toks(x.title);
    if (!k) continue;
    if (!naveByKey.has(k)) naveByKey.set(k, []);
    naveByKey.get(k).push(x);
  }
  const droppedShells = [];
  for (const t of torreys.topics) {
    if (ALIAS[t.id]) continue; // alias rows win
    const k = toks(t.title);
    const cands = naveByKey.get(k) ?? [];
    if (cands.length === 0) continue;
    const live = cands.filter((c) => countRefs(c) > 0);
    if (live.length === 0 || countRefs(t) === 0) {
      droppedShells.push(`${t.id} -> ${cands.map((c) => c.id).join("|")}`);
      continue;
    }
    let pick;
    if (live.length === 1) pick = live[0];
    else {
      pick =
        live.find((c) => c.id === t.id) ??
        live.find((c) => c.id === k) ??
        [...live].sort((a, b) => countRefs(b) - countRefs(a))[0];
    }
    if (VETO.has(`${t.id}:${pick.id}`)) continue;
    rows.set(t.id, { canonical: pick.title, kind: "entry", naves: pick.id, torreys: t.id });
  }

  // Pass 2: hand-reviewed aliases.
  for (const [torreyId, spec] of Object.entries(ALIAS)) {
    const t = torreyById.get(torreyId);
    if (!t) {
      errors.push(`alias key ${torreyId}: no such Torrey topic`);
      continue;
    }
    const n = naveById.get(spec.naves);
    if (!n) {
      errors.push(`alias ${torreyId} -> ${spec.naves}: no such Nave topic`);
      continue;
    }
    if (countRefs(t) === 0 || countRefs(n) === 0) {
      errors.push(`alias ${torreyId} -> ${spec.naves}: one side carries no references`);
      continue;
    }
    if (spec.kind === "section") {
      const labels = sectionLabels(n);
      if (!labels.some((l) => l.includes(spec.section))) {
        errors.push(`alias ${torreyId} -> ${spec.naves}: no section matching "${spec.section}"`);
        continue;
      }
    }
    rows.set(torreyId, {
      canonical: spec.canonical,
      kind: spec.kind,
      naves: spec.naves,
      torreys: torreyId,
      ...(spec.kind === "section" ? { section: spec.section } : {}),
    });
  }

  if (errors.length > 0) {
    console.error("Alignment build failed:");
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  const out = [...rows.values()].sort((a, b) => a.canonical.localeCompare(b.canonical));
  const sharedNave = new Map();
  for (const r of out) sharedNave.set(r.naves, (sharedNave.get(r.naves) ?? 0) + 1);
  const file = {
    generated: new Date().toISOString().slice(0, 10),
    note: "Canonical topic alignment between Nave's Topical Bible and Torrey's New Topical Textbook (both public domain). kind entry: the two entries are the same topic. kind section: the Torrey entry is covered as the named section of the Nave entry (Nave merges what Torrey splits). Built by scripts/build-topics-alignment.mjs; the alignment itself is Berean's editorial work.",
    rows: out,
  };
  await fs.writeFile(path.join(TOPICS, "alignment.json"), JSON.stringify(file));
  const sections = out.filter((r) => r.kind === "section").length;
  console.log(`alignment: ${out.length} rows (${out.length - sections} entry, ${sections} section)`);
  console.log(`torrey coverage: ${out.length} of ${torreys.topics.length} topics aligned`);
  console.log(`dropped token-key shells: ${droppedShells.length}`);
  console.log(`nave entries shared by multiple rows: ${[...sharedNave.values()].filter((n) => n > 1).length}`);
}

if (process.argv[1] && process.argv[1].endsWith("build-topics-alignment.mjs")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
