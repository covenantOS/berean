/**
 * Build the confessional corpus: the historic creeds and confessions with
 * their scripture proof texts, parsed and validated against the canon.
 *
 * Inputs (provenance in data/_sources/confessions/PROVENANCE.md):
 *   data/_sources/confessions/wsc.html           — Westminster Shorter
 *     Catechism with the Assembly's proof texts (reformedstandards.com
 *     digitization of the 1647/1648 public-domain text).
 *   data/_sources/confessions/bcf.txt            — the 1677/89 London
 *     Baptist Confession with its scripture proofs (CCEL plain text). The
 *     file's modern "BCF Assistant" editorial material is copyrighted and
 *     is excluded; only the confession, its epistle, its appendix, and the
 *     subscription statement are read.
 *   data/_sources/confessions/schaff-creeds2.txt — Schaff, Creeds of
 *     Christendom vol. II (CCEL plain text), the source the creed texts
 *     below are transcribed from (the lines are cited per document).
 *
 * Outputs: data/confessions/<id>.json per document, plus _meta.json with
 * counts and every anomaly the build met. Every proof reference is
 * normalized to the canonical slugs of src/lib/canon.ts and validated
 * against the shipped KJV text; an unparseable or out-of-canon reference
 * fails the build. The one documented exception: references the source
 * prints that name verses the canon does not contain are kept in the proof's
 * display string, dropped from its parsed refs, and recorded in _meta.json
 * (the digitization's own editorial note is kept beside them).
 *
 * The ecumenical creeds carry no received proof-text apparatus, so their
 * sections ship with empty proof lists by design; the apparatus is a
 * property of the catechism and the confession.
 */
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "data", "_sources", "confessions");
const OUT = path.join(ROOT, "data", "confessions");

const CHAPTERS = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  joshua: 24, judges: 21, ruth: 4, "1-samuel": 31, "2-samuel": 24,
  "1-kings": 22, "2-kings": 25, "1-chronicles": 29, "2-chronicles": 36,
  ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150, proverbs: 31,
  ecclesiastes: 12, "song-of-solomon": 8, isaiah: 66, jeremiah: 52,
  lamentations: 5, ezekiel: 48, daniel: 12, hosea: 14, joel: 3, amos: 9,
  obadiah: 1, jonah: 4, micah: 7, nahum: 3, habakkuk: 3, zephaniah: 3,
  haggai: 2, zechariah: 14, malachi: 4, matthew: 28, mark: 16, luke: 24,
  john: 21, acts: 28, romans: 16, "1-corinthians": 16, "2-corinthians": 13,
  galatians: 6, ephesians: 6, philippians: 4, colossians: 4,
  "1-thessalonians": 5, "2-thessalonians": 3, "1-timothy": 6, "2-timothy": 4,
  titus: 3, philemon: 1, hebrews: 13, james: 5, "1-peter": 5, "2-peter": 3,
  "1-john": 5, "2-john": 1, "3-john": 1, jude: 1, revelation: 22,
};

const FILE_BY_SLUG = {};
for (const slug of Object.keys(CHAPTERS)) {
  FILE_BY_SLUG[slug] = slug.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}
FILE_BY_SLUG["song-of-solomon"] = "SongofSolomon";

/** Verses actually present in the shipped KJV, loaded lazily per book. */
const kjvCache = new Map();
async function kjvVerseSet(slug) {
  if (!kjvCache.has(slug)) {
    const raw = JSON.parse(
      await fs.readFile(path.join(ROOT, "data", "kjv", `${FILE_BY_SLUG[slug]}.json`), "utf8")
    );
    const set = new Set();
    for (const ch of raw.chapters) {
      for (const v of ch.verses) set.add(`${ch.chapter}:${v.verse}`);
    }
    kjvCache.set(slug, set);
  }
  return kjvCache.get(slug);
}

/* The book names of the corpus, both the catechism's modern full names and
 * the confession's seventeenth-century abbreviations, onto canonical slugs. */
const BOOKS = {
  genesis: "genesis", gen: "genesis", exodus: "exodus", exod: "exodus",
  exo: "exodus", leviticus: "leviticus", lev: "leviticus", levit: "leviticus",
  numbers: "numbers", numb: "numbers", num: "numbers", deuteronomy: "deuteronomy",
  deut: "deuteronomy",
  joshua: "joshua", josh: "joshua", judges: "judges", judg: "judges",
  ruth: "ruth", "1 samuel": "1-samuel", "1 sam": "1-samuel",
  "2 samuel": "2-samuel", "2 sam": "2-samuel", "1 kings": "1-kings",
  "1 king": "1-kings", "2 kings": "2-kings", "2 king": "2-kings",
  "1 chronicles": "1-chronicles", "1 chron": "1-chronicles", "1 chro": "1-chronicles",
  "2 chronicles": "2-chronicles", "2 chron": "2-chronicles", "2 chro": "2-chronicles",
  "2 cro": "2-chronicles",
  ezra: "ezra", nehemiah: "nehemiah", neh: "nehemiah", esther: "esther",
  esth: "esther", job: "job", psalms: "psalms", psalm: "psalms", ps: "psalms",
  psal: "psalms", psa: "psalms", proverbs: "proverbs", prov: "proverbs", pro: "proverbs",
  ecclesiastes: "ecclesiastes", eccles: "ecclesiastes", eccl: "ecclesiastes",
  "song of solomon": "song-of-solomon", "song of songs": "song-of-solomon",
  canticles: "song-of-solomon", cant: "song-of-solomon",
  isaiah: "isaiah", isa: "isaiah", is: "isaiah", jeremiah: "jeremiah",
  jer: "jeremiah", lamentations: "lamentations", lam: "lamentations",
  ezekiel: "ezekiel", ezek: "ezekiel", ezk: "ezekiel", eze: "ezekiel",
  daniel: "daniel", dan: "daniel", hosea: "hosea", hos: "hosea", joel: "joel", amos: "amos",
  obadiah: "obadiah", obad: "obadiah", jonah: "jonah", jon: "jonah",
  micah: "micah", mic: "micah", nahum: "nahum", nah: "nahum",
  habakkuk: "habakkuk", hab: "habakkuk", zephaniah: "zephaniah",
  zeph: "zephaniah", haggai: "haggai", hag: "haggai",
  zechariah: "zechariah", zech: "zechariah", malachi: "malachi", mal: "malachi",
  matthew: "matthew", matt: "matthew", mat: "matthew", mark: "mark",
  mar: "mark", luke: "luke", luk: "luke", john: "john", joh: "john",
  acts: "acts", act: "acts", romans: "romans", rom: "romans", ro: "romans",
  "1 corinthians": "1-corinthians", "1 cor": "1-corinthians",
  "2 corinthians": "2-corinthians", "2 cor": "2-corinthians",
  galatians: "galatians", gal: "galatians", ephesians: "ephesians",
  eph: "ephesians", philippians: "philippians", phil: "philippians",
  phi: "philippians", colossians: "colossians", col: "colossians",
  "1 thessalonians": "1-thessalonians", "1 thess": "1-thessalonians",
  "1 thes": "1-thessalonians", "2 thessalonians": "2-thessalonians",
  "2 thess": "2-thessalonians", "2 thes": "2-thessalonians",
  "1 timothy": "1-timothy", "1 tim": "1-timothy",
  "2 timothy": "2-timothy", "2 tim": "2-timothy", titus: "titus",
  tit: "titus", philemon: "philemon", philem: "philemon",
  hebrews: "hebrews", heb: "hebrews", hebr: "hebrews", james: "james",
  jam: "james", "1 peter": "1-peter", "1 pet": "1-peter",
  "2 peter": "2-peter", "2 pet": "2-peter", "1 john": "1-john",
  "1 joh": "1-john", "2 john": "2-john", "2 joh": "2-john",
  "3 john": "3-john", "3 joh": "3-john", jude: "jude", jud: "jude",
  revelation: "revelation", rev: "revelation", revel: "revelation",
};

/* Book alternation for the old-style tokenizer, longest first so "1 John"
 * wins over "1 Joh" and "Isaiah" over "Is". */
const BOOK_ALT = Object.keys(BOOKS)
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

/**
 * The old-style reference grammar of the confession's apparatus: "2 Tim. 3.
 * 15,16,17.", "Ps. 19. 7. and 119. 130.", "1 Cor. 11, 13, 14. & ch. 14. 26. &
 * 40.", "Jud. 4.". A book token opens a clause; the first number after it is
 * the chapter (the verse for a one-chapter book); following numbers are
 * verses, however separated; a dash closes a range; "ch." reopens the
 * chapter, "v." continues verses in the open chapter; a number too large for
 * the open chapter's verse count opens a new chapter (the digitization
 * renders the original's roman psalm numbers in arabic, so "Psal. 32:5. &
 * 51." is Psalm 32:5 and Psalm 51). Open-ended "&c." adds no reference; the
 * drop is counted, the display string keeps it.
 */
function parseOldRefs(input, verseCount) {
  const notes = [];
  let text = input.replace(/\[Note:\s*([^\]]+)\]/gi, (_m, n) => {
    notes.push(n.trim());
    return " ";
  });
  /* The digitization's pointer to its page images, kept as a note. */
  text = text.replace(/:?\s*See the original\.?/i, () => {
    notes.push("See the original.");
    return " ";
  });
  const etc = (text.match(/&c\.?/g) ?? []).length;
  text = text.replace(/&c\.?/g, " ");

  const TOKEN = new RegExp(
    `(${BOOK_ALT})\\.?(?!\\w)|(chap|ch)\\.?\\s*|(v)\\.\\s*|(\\d{1,3})\\s*|([-–])\\s*|(&|%|and|with)\\s*|[.,:;]\\s*|(\\S+)\\s*`,
    "gi"
  );
  const refs = [];
  const unparsed = [];
  let book = null;
  let chapter = null;
  let mode = "idle"; // idle | chapter | verses
  let dash = false;
  let last = null;
  const emitChapterIfOpen = () => {
    if (book && chapter !== null && last === null) {
      refs.push({ slug: book, chapter });
    }
  };
  for (const m of text.matchAll(TOKEN)) {
    const [, bk, ch, v, num, dashTok, conj, junk] = m;
    if (junk !== undefined) {
      unparsed.push(junk);
      continue;
    }
    if (bk !== undefined) {
      emitChapterIfOpen();
      book = BOOKS[bk.toLowerCase()];
      chapter = null;
      mode = "chapter";
      dash = false;
      last = null;
      continue;
    }
    if (ch !== undefined) {
      // "ch.": the chapter continuation; the book stays open.
      emitChapterIfOpen();
      chapter = null;
      mode = "chapter";
      dash = false;
      last = null;
      continue;
    }
    if (v !== undefined) {
      // "v.": verses continue in the open chapter.
      mode = "verses";
      continue;
    }
    if (conj !== undefined) continue;
    if (dashTok !== undefined) {
      dash = true;
      continue;
    }
    if (num === undefined) continue;
    const n = Number(num);
    if (!book) {
      unparsed.push(num);
      continue;
    }
    if (mode === "chapter" || chapter === null) {
      if (CHAPTERS[book] === 1) {
        // One-chapter books cite the verse directly: "Jud. 4." is Jude 4.
        chapter = 1;
        last = { slug: book, chapter: 1, from: n, to: n };
        refs.push(last);
        mode = "verses";
      } else {
        emitChapterIfOpen();
        chapter = n;
        last = null;
        mode = "verses";
      }
      dash = false;
      continue;
    }
    if (dash && last) {
      last.to = n;
      dash = false;
      continue;
    }
    const vc = verseCount(book, chapter);
    if (vc !== null && n > vc && n <= CHAPTERS[book]) {
      // Too large for the open chapter's verses yet a chapter the book
      // holds: a new chapter opens (the roman psalm numbers of the print,
      // rendered arabic). A number beyond the book's chapter count stays a
      // verse; the validator judges it.
      emitChapterIfOpen();
      chapter = n;
      last = null;
      dash = false;
      continue;
    }
    last = { slug: book, chapter, from: n, to: n };
    refs.push(last);
  }
  emitChapterIfOpen();
  return { refs, notes, etc, unparsed };
}

/** The catechism's modern reference form: "Psalm 73:25-28", "Genesis 1". */
function parseModernRef(raw) {
  const m = /^([1-3]?\s?[A-Za-z][A-Za-z ]*?)\s+(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/.exec(raw.trim());
  if (!m) return null;
  const slug = BOOKS[m[1].toLowerCase()];
  if (!slug) return null;
  const chapter = Number(m[2]);
  if (m[3] === undefined) return { slug, chapter };
  const from = Number(m[3]);
  const to = m[4] ? Number(m[4]) : from;
  return { slug, chapter, from, to };
}

/** Validate one parsed ref against the canon and the shipped KJV text. */
async function validateRef(ref) {
  const chapters = CHAPTERS[ref.slug];
  if (!chapters || ref.chapter < 1 || ref.chapter > chapters) return false;
  if (ref.from === undefined) return true;
  const set = await kjvVerseSet(ref.slug);
  if (!set.has(`${ref.chapter}:${ref.from}`)) return false;
  if (ref.to !== undefined && ref.to !== ref.from && !set.has(`${ref.chapter}:${ref.to}`)) {
    return false;
  }
  return true;
}

/* ---------- the Westminster Shorter Catechism ---------- */

function decodeEntities(s) {
  return s
    .replace(/&rsquo;|&#8217;|&#039;/g, "'")
    .replace(/&lsquo;|&#8216;/g, "'")
    .replace(/&ldquo;|&#8220;|&quot;/g, '"')
    .replace(/&rdquo;|&#8221;/g, '"')
    .replace(/&mdash;|&#8212;/g, ", ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

async function buildWsc() {
  const html = await fs.readFile(path.join(SRC, "wsc.html"), "utf8");
  const sections = [];
  const anomalies = [];
  const qRe =
    /<div id=question-(\d+) class="question toc-anchor"><h3>\s*Q \d+: (.*?)\s*<\/h3><p>(.*?)<\/p><ul class=footnotes>(.*?)<\/ul><\/div>/gs;
  let questionCount = 0;
  for (const m of html.matchAll(qRe)) {
    questionCount++;
    const num = Number(m[1]);
    const question = decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim();
    let answer = m[3].replace(/<strong>Answer:<\/strong>\s*/, "");
    answer = decodeEntities(
      answer.replace(/<sup>(\w+)<\/sup>/g, "[$1]").replace(/<[^>]+>/g, "")
    ).trim();
    const proofs = [];
    const liRe = /<li>\s*(\w+):\s*(.*?)<\/li>/gs;
    for (const li of m[4].matchAll(liRe)) {
      const mark = li[1];
      const raws = [];
      /* The anchors' title attributes carry the reference strings; their
       * data-content attribute values hold markup with ">" inside, so the
       * opening tag cannot be matched on [^>]*. */
      const aRe = /<a\b[^>]*\btitle="([^"]+)"/g;
      for (const a of li[2].matchAll(aRe)) raws.push(decodeEntities(a[1]).trim());
      if (raws.length === 0) {
        anomalies.push(`WSC Q${num} proof ${mark}: no reference anchors in the source list item`);
        continue;
      }
      const refs = [];
      for (const raw of raws) {
        const ref = parseModernRef(raw);
        if (!ref) throw new Error(`WSC Q${num} proof ${mark}: cannot parse "${raw}"`);
        refs.push(ref);
      }
      proofs.push({ mark, raw: raws.join(", "), refs });
    }
    sections.push({
      id: `q${num}`,
      label: `Question ${num}`,
      title: question,
      paragraphs: [answer],
      proofs,
    });
  }
  if (questionCount !== 107) {
    throw new Error(`WSC: expected 107 questions, parsed ${questionCount}`);
  }
  return {
    doc: {
      id: "wsc",
      title: "The Westminster Shorter Catechism",
      subtitle: "With the Assembly's proof texts",
      years: "1647",
      kind: "catechism",
      frontMatter: [],
      backMatter: [],
      sections,
    },
    anomalies,
  };
}

/* ---------- the 1689 London Baptist Confession ---------- */

const ROMAN = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18,
  XIX: 19, XX: 20, XXI: 21, XXII: 22, XXIII: 23, XXIV: 24, XXV: 25,
  XXVI: 26, XXVII: 27, XXVIII: 28, XXIX: 29, XXX: 30, XXXI: 31, XXXII: 32,
};

/** Blocks of the plain text: paragraphs split on blank lines, unwrapped;
 * the rule lines that part text from apparatus are stripped first. */
function blocks(text) {
  return text
    .replace(/^\s*_{5,}\s*$/gm, "")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s*\n\s*/g, " ").trim())
    .filter((b) => b.length > 0);
}

async function buildBcf() {
  let text = await fs.readFile(path.join(SRC, "bcf.txt"), "utf8");
  const anomalies = [];
  const marginal = [];
  /* Two scripture references the print sets in the margin are glued into the
   * prose by the plain-text digitization; restore the prose and keep the
   * references as proofs at the clause they annotate. */
  const repairs = [
    {
      find: /free\s+Hos\. 1\.7to work,/,
      expect: "free Hos. 1.7to work,",
      replace: "free to work,",
      proof: { mark: "m1", raw: "Hos. 1.7", refs: [{ slug: "hosea", chapter: 1, from: 7, to: 7 }] },
      chapter: 5,
    },
    {
      find: /it,\s*Gen\. 2\.16,17\.and/,
      expect: "it,Gen. 2.16,17.and",
      replace: "it, and",
      proof: {
        mark: "m2",
        raw: "Gen. 2.16,17",
        refs: [{ slug: "genesis", chapter: 2, from: 16, to: 17 }],
      },
      chapter: 6,
    },
  ];
  for (const r of repairs) {
    if (!r.find.test(text)) throw new Error(`BCF: expected marginal repair site "${r.expect}"`);
    text = text.replace(r.find, r.replace);
    marginal.push(r);
  }

  const chapStart = text.indexOf("  CHAP. I.");
  const appendixStart = text.indexOf("AN APPENDIX");
  const finis = text.indexOf("FINIS", appendixStart);
  const subStart = text.indexOf("Subscribers to the Confession of Faith", finis);
  if (chapStart < 0 || appendixStart < 0 || finis < 0 || subStart < 0) {
    throw new Error("BCF: document boundaries not found");
  }

  /* Front matter: the epistle to the reader, between the CCEL header and
   * the first chapter. */
  const head = text.slice(0, chapStart);
  const epistleStart = head.indexOf("Courteous Reader,");
  if (epistleStart < 0) throw new Error("BCF: epistle not found");
  const epistle = blocks(head.slice(epistleStart));
  const frontMatter = [{ heading: "To the Judicious and Impartial Reader", paragraphs: epistle }];

  /* Back matter: the confession's own appendix through FINIS, then the
   * subscription statement. The subscriber name list that follows is a
   * two-column ditto-mark table the plain text mangles; it is omitted and
   * the omission is recorded in _meta.json. */
  const appendix = blocks(text.slice(appendixStart + "AN APPENDIX".length, finis));
  const subBlock = blocks(text.slice(subStart + "Subscribers to the Confession of Faith".length));
  const namesAt = subBlock.findIndex((b) => /^\[\d+\]Hanserd Knollys/.test(b));
  const subscription = namesAt > 0 ? subBlock.slice(0, namesAt) : [subBlock[0]];
  const backMatter = [
    { heading: "An Appendix", paragraphs: appendix },
    { heading: "The Subscription", paragraphs: subscription },
  ];

  /* The chapters and their apparatus. */
  const body = text.slice(chapStart, appendixStart);
  const chapterRe = /^ {2}CHAP\. ([IVX]+)\.\s*$/gm;
  const starts = [];
  for (const m of body.matchAll(chapterRe)) {
    starts.push({ roman: m[1], index: m.index, end: m.index + m[0].length });
  }
  if (starts.length !== 32) throw new Error(`BCF: expected 32 chapters, found ${starts.length}`);

  const verseCount = (slug, chapter) => {
    const vs = kjvCache.get(slug);
    if (!vs) return null;
    let max = 0;
    for (const key of vs) {
      const [c, v] = key.split(":");
      if (Number(c) === chapter && Number(v) > max) max = Number(v);
    }
    return max > 0 ? max : null;
  };

  const sections = [];
  let etcTotal = 0;
  for (let i = 0; i < starts.length; i++) {
    const num = ROMAN[starts[i].roman];
    const chunk = body.slice(starts[i].end, i + 1 < starts.length ? starts[i + 1].index : undefined);
    /* The rule line parts the chapter's text from its footnotes. */
    const ruleAt = chunk.search(/^\s*_{5,}\s*$/m);
    if (ruleAt < 0) throw new Error(`BCF chapter ${num}: no apparatus rule line`);
    const textPart = chunk.slice(0, ruleAt);
    const footPart = chunk.slice(ruleAt);
    const paras = blocks(textPart);
    const title = paras.shift().replace(/\.$/, "");
    const proofs = [];
    for (const b of blocks(footPart)) {
      const fm = /^\[(\d+)\]\s*(.*)$/s.exec(b);
      if (!fm) throw new Error(`BCF chapter ${num}: footnote block without a mark: "${b.slice(0, 60)}"`);
      const mark = fm[1];
      const body2 = fm[2].trim();
      const parsed = parseOldRefs(body2, verseCount);
      etcTotal += parsed.etc;
      if (parsed.unparsed.length > 0) {
        throw new Error(
          `BCF chapter ${num} footnote ${mark}: unparsed tokens ${JSON.stringify(parsed.unparsed)} in "${body2}"`
        );
      }
      if (parsed.refs.length === 0 && parsed.notes.length === 0) {
        throw new Error(`BCF chapter ${num} footnote ${mark}: no references parsed from "${body2}"`);
      }
      const raw = body2.replace(/\[Note:\s*[^\]]+\]/gi, "").replace(/\s{2,}/g, " ").trim();
      const proof = { mark, raw, refs: parsed.refs };
      if (parsed.notes.length > 0) proof.note = parsed.notes.join(" ");
      proofs.push(proof);
    }
    /* The marginal references restored above sit at known chapters. */
    for (const r of marginal.filter((x) => x.chapter === num)) {
      r.proof.note =
        "Printed in the margin beside this clause; the plain-text digitization glues it into the prose, and the build restores it here.";
      proofs.push(r.proof);
    }
    sections.push({
      id: `ch${num}`,
      label: `Chapter ${num}`,
      title,
      paragraphs: paras,
      proofs,
    });
  }

  return {
    doc: {
      id: "lbc1689",
      title: "The 1689 London Baptist Confession of Faith",
      subtitle: "Thirty-Two Articles of Christian Faith and Practice with Scripture Proofs",
      years: "1677/1689",
      kind: "confession",
      frontMatter,
      backMatter,
      sections,
    },
    anomalies,
    etcTotal,
  };
}

/* ---------- the creeds ----------

 * Transcribed from Schaff, Creeds of Christendom vol. II (the vendored
 * schaff-creeds2.txt), his editorial brackets and footnote marks removed;
 * the source lines are cited per document. The ecumenical creeds carry no
 * received proof-text apparatus, so their proof lists are empty by design. */

function article(id, label, text) {
  return { id, label, title: "", paragraphs: [text], proofs: [] };
}

function buildApostles() {
  /* Schaff II, "I. THE APOSTLES' CREED. (a) RECEIVED FORM." (vendored lines
   * 3084-3096). His parenthetical "(begotten)" and bracketed glosses
   * "[Hades, spirit-world]", "[flesh]" are his annotations and are removed. */
  return {
    id: "apostles-creed",
    title: "The Apostles' Creed",
    subtitle: "The received form",
    years: "2nd-8th century",
    kind: "creed",
    frontMatter: [],
    backMatter: [],
    sections: [
      article("a1", "Article 1", "I believe in God the Father Almighty; Maker of heaven and earth."),
      article(
        "a2",
        "Article 2",
        "And in Jesus Christ his only Son our Lord; who was conceived by the Holy Ghost, born of the Virgin Mary;"
      ),
      article(
        "a3",
        "Article 3",
        "suffered under Pontius Pilate, was crucified, dead, and buried; he descended into hell;"
      ),
      article("a4", "Article 4", "the third day he rose from the dead;"),
      article(
        "a5",
        "Article 5",
        "he ascended into heaven; and sitteth at the right hand of God the Father Almighty;"
      ),
      article("a6", "Article 6", "from thence he shall come to judge the quick and the dead."),
      article("a7", "Article 7", "I believe in the Holy Ghost;"),
      article("a8", "Article 8", "the holy catholic Church; the communion of saints;"),
      article("a9", "Article 9", "the forgiveness of sins;"),
      article("a10", "Article 10", "the resurrection of the body;"),
      article("a11", "Article 11", "and the life everlasting. Amen."),
    ],
  };
}

function buildNicene() {
  /* Schaff II prints the Nicæno-Constantinopolitan text (381) in the creed
   * tables and verbatim in the Ancoratus formula of Epiphanius (vendored
   * lines 2164-2301), which he states agrees with the 381 form word for
   * word except the retained 325 clauses "that is, of the substance of the
   * Father" and "God of God" and the concluding anathema; those retentions
   * are removed here. The 325 form and its anathema are printed in the same
   * tables (the anathema verbatim at lines 2295-2301). */
  return {
    id: "nicene-creed",
    title: "The Nicene Creed",
    subtitle: "The creed of Nicaea (325) as received at Constantinople (381)",
    years: "325/381",
    kind: "creed",
    frontMatter: [],
    backMatter: [
      {
        heading: "The creed of the 318 fathers at Nicaea, 325",
        paragraphs: [
          "We believe in one God, the Father Almighty, Maker of all things visible and invisible;",
          "And in one Lord Jesus Christ, the Son of God, begotten of the Father, the only-begotten; that is, of the substance of the Father, God of God, Light of Light, very God of very God, begotten, not made, being of one substance with the Father; by whom all things were made, both in heaven and on earth; who for us men, and for our salvation, came down and was incarnate, and was made man; he suffered, and the third day he rose again, ascended into heaven; from thence he shall come to judge the quick and the dead.",
          "And in the Holy Ghost.",
          "But those who say, There was a time when he was not, and, He was not before he was begotten, or, He was made of nothing, or of another substance or essence, saying that the Son of God is effluent or variable, these the Catholic and Apostolic Church anathematizes.",
        ],
      },
    ],
    sections: [
      article(
        "a1",
        "Article 1",
        "We believe in one God, the Father Almighty, Maker of heaven and earth, and of all things visible and invisible;"
      ),
      article(
        "a2",
        "Article 2",
        "And in one Lord Jesus Christ, the only-begotten Son of God, begotten of the Father before all worlds, Light of Light, very God of very God, begotten, not made, being of one substance with the Father; by whom all things were made;"
      ),
      article(
        "a3",
        "Article 3",
        "who for us men, and for our salvation, came down from heaven, and was incarnate by the Holy Ghost and the Virgin Mary, and was made man;"
      ),
      article(
        "a4",
        "Article 4",
        "he was crucified for us under Pontius Pilate, and suffered, and was buried;"
      ),
      article("a5", "Article 5", "and the third day he rose again, according to the Scriptures;"),
      article("a6", "Article 6", "and ascended into heaven, and sitteth on the right hand of the Father;"),
      article(
        "a7",
        "Article 7",
        "and he shall come again, with glory, to judge the quick and the dead; of whose kingdom there shall be no end;"
      ),
      article(
        "a8",
        "Article 8",
        "And in the Holy Ghost, the Lord, and Giver of life, who proceedeth from the Father, who with the Father and the Son together is worshiped and glorified, who spake by the Prophets;"
      ),
      article("a9", "Article 9", "in one holy Catholic and Apostolic Church;"),
      article("a10", "Article 10", "we acknowledge one baptism for the remission of sins;"),
      article("a11", "Article 11", "and we look for the resurrection of the dead,"),
      article("a12", "Article 12", "and the life of the world to come. Amen."),
    ],
  };
}

function buildChalcedon() {
  /* Schaff II, the Chalcedonian symbol (vendored lines 4044-4061): his
   * bracketed alternatives "[rational]", "[coessential]" and the Greek and
   * Latin columns are the apparatus, not the decree, and are removed. */
  return {
    id: "chalcedon",
    title: "The Definition of Chalcedon",
    subtitle: "The symbol of the fourth ecumenical council",
    years: "451",
    kind: "creed",
    frontMatter: [],
    backMatter: [],
    sections: [
      article(
        "s1",
        "Section 1",
        "We, then, following the holy Fathers, all with one consent, teach men to confess one and the same Son, our Lord Jesus Christ, the same perfect in Godhead and also perfect in manhood; truly God and truly man, of a reasonable soul and body; consubstantial with the Father according to the Godhead, and consubstantial with us according to the Manhood; in all things like unto us, without sin;"
      ),
      article(
        "s2",
        "Section 2",
        "begotten before all ages of the Father according to the Godhead, and in these latter days, for us and for our salvation, born of the Virgin Mary, the Mother of God, according to the Manhood;"
      ),
      article(
        "s3",
        "Section 3",
        "one and the same Christ, Son, Lord, Only-begotten, to be acknowledged in two natures, inconfusedly, unchangeably, indivisibly, inseparably; the distinction of natures being by no means taken away by the union, but rather the property of each nature being preserved, and concurring in one Person and one Subsistence, not parted or divided into two persons,"
      ),
      article(
        "s4",
        "Section 4",
        "but one and the same Son, and only begotten, God the Word, the Lord Jesus Christ, as the prophets from the beginning have declared concerning him, and the Lord Jesus Christ himself has taught us, and the Creed of the holy Fathers has handed down to us."
      ),
    ],
  };
}

/* ---------- validation and output ---------- */

async function validateDoc(doc) {
  let refs = 0;
  let wholeChapter = 0;
  const dropped = [];
  for (const section of doc.sections) {
    for (const proof of section.proofs) {
      const kept = [];
      for (const ref of proof.refs) {
        if (await validateRef(ref)) {
          kept.push(ref);
          refs++;
          if (ref.from === undefined) wholeChapter++;
        } else {
          dropped.push({ section: section.id, mark: proof.mark, raw: proof.raw, ref });
        }
      }
      proof.refs = kept;
    }
  }
  return { refs, wholeChapter, dropped };
}

const CREED_BLURBS = {
  "apostles-creed":
    "The baptismal creed of the Western church, received in this form by the eighth century.",
  "nicene-creed":
    "The faith confessed at Nicaea in 325 against Arius, received in this enlarged form at Constantinople in 381.",
  chalcedon:
    "The fourth ecumenical council's definition of the one Christ in two natures, 451.",
};

async function main() {
  /* Preload every book's verse set so the old-style parser can judge verse
   * counts (its chapter-vs-verse rule) and validation can run. */
  for (const slug of Object.keys(CHAPTERS)) await kjvVerseSet(slug);

  const wsc = await buildWsc();
  const bcf = await buildBcf();
  const creeds = [buildApostles(), buildNicene(), buildChalcedon()].map((doc) => ({
    ...doc,
    blurb: CREED_BLURBS[doc.id],
  }));

  const docs = [
    { doc: wsc.doc, anomalies: wsc.anomalies },
    { doc: bcf.doc, anomalies: bcf.anomalies },
    ...creeds.map((doc) => ({ doc, anomalies: [] })),
  ];

  await fs.mkdir(OUT, { recursive: true });
  const meta = { generated: new Date().toISOString(), documents: {}, anomalies: [] };
  for (const { doc, anomalies } of docs) {
    const { refs, wholeChapter, dropped } = await validateDoc(doc);
    const seenDropped = new Set();
    for (const d of dropped) {
      /* The source prints references the canon does not contain (the
       * digitization's own note marks the known cases). The display string
       * stays as printed; the parsed ref drops out and is recorded once
       * per proof. */
      const key = `${d.section}:${d.mark}`;
      if (seenDropped.has(key)) continue;
      seenDropped.add(key);
      meta.anomalies.push(
        `${doc.id} ${d.section} proof ${d.mark}: printed reference beyond the canon dropped from the index (${d.raw})`
      );
    }
    for (const a of anomalies) meta.anomalies.push(`${doc.id}: ${a}`);
    const notes = doc.sections.reduce(
      (n, s) => n + s.proofs.filter((p) => p.note !== undefined).length,
      0
    );
    meta.documents[doc.id] = {
      sections: doc.sections.length,
      proofs: doc.sections.reduce((n, s) => n + s.proofs.length, 0),
      refs,
      wholeChapterRefs: wholeChapter,
      editorialNotes: notes,
      ...(doc.id === "lbc1689"
        ? {
            /* Open-ended "&c." continuations the print carries; they add no
             * reference. Marginal references restored from the prose are
             * recorded in PROVENANCE.md and ride as notes on their proofs. */
            openEndedEtc: bcf.etcTotal,
            marginalRestored: 2,
          }
        : {}),
    };
    await fs.writeFile(
      path.join(OUT, `${doc.id}.json`),
      JSON.stringify({ generated: meta.generated, ...doc }, null, 2) + "\n"
    );
  }
  await fs.writeFile(path.join(OUT, "_meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(JSON.stringify(meta.documents, null, 2));
  console.log(`anomalies: ${meta.anomalies.length}`);
  for (const a of meta.anomalies) console.log(`  ${a}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
