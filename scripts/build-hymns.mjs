#!/usr/bin/env node
/**
 * Build the Chapel hymnbook from the Open Hymnal Project's 2014.06 ABC
 * release (see data/_sources/openhymnal/PROVENANCE.md).
 *
 * The Open Hymnal marks copyright per hymn part (words, translation,
 * music, setting) inside each abc file, and its copying page places every
 * part listed "public domain" outside copyright in the United States.
 * Only files whose words verify as public domain are admitted; the rule:
 * the copyright line must say "public domain" and must not carry a dated
 * copyright claim on the words or lyrics. Files whose words ride a
 * "free for Christian worship" license (Dumont, Penney, and their kin)
 * fail the first clause and stay out, as do files whose only PD claim
 * covers the music while the words carry a modern copyright.
 *
 * Text comes from the files themselves: the sung underlay (w: lines,
 * syllabified to the notes) gives the verses the score underlays, chunked
 * back into poetic lines against the file's own metrical pattern
 * (%OHMETRICAL); the after-score blocks (W: lines) give the verses printed
 * as text. A refrain prints under verse one alone; the split between
 * verse and refrain is read off the later verses' underlay counts. Every
 * hymn is then checked letter for letter against the release's own ThML
 * text (openhymnal.201406.xml, generated from the same files); a verse
 * that disagrees excludes the hymn, and the exclusion is recorded.
 * Nothing modernized, nothing paraphrased: the words are the score's own.
 *
 * Scripture references come from each file's %OHSCRIP line, mapped off
 * the project's abbreviations onto canonical slugs and validated against
 * the shipped KJV text, the confessions build's rule.
 *
 * Output: data/hymns/index.json (one row per hymn),
 * data/hymns/texts/<id>.json (full records), data/hymns/_meta.json
 * (the build report: admissions, exclusions, validation, dropped refs).
 */
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "data", "_sources", "openhymnal");
const ZIP = path.join(SRC, "OpenHymnal2014.06-abc.zip");
const THML = path.join(SRC, "openhymnal.201406.xml");
const ALLLYRICS = path.join(SRC, "alllyrics.html");
const OUT = path.join(ROOT, "data", "hymns");

/** A verse may wander two syllables from the printed meter (a word sung
 * long or short); beyond that the file is set aside as not chunkable. */
const METER_TOLERANCE = 2;

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

const kjvCache = new Map();
async function kjvVerseSet(slug) {
  if (!kjvCache.has(slug)) {
    const raw = JSON.parse(
      await fs.readFile(path.join(ROOT, "data", "kjv", `${FILE_BY_SLUG[slug]}.json`), "utf8")
    );
    const set = new Set();
    for (const ch of raw.chapters) for (const v of ch.verses) set.add(`${ch.chapter}:${v.verse}`);
    kjvCache.set(slug, set);
  }
  return kjvCache.get(slug);
}

/* The Open Hymnal's scripture abbreviations onto canonical slugs. "Ez" is
 * Ezekiel; Ezra is spelled out when the project means it. */
const OH_BOOKS = {
  gen: "genesis", ex: "exodus", lv: "leviticus", num: "numbers", deut: "deuteronomy",
  josh: "joshua", jdg: "judges", ruth: "ruth", "1sam": "1-samuel", "2sam": "2-samuel",
  "1kgs": "1-kings", "2kgs": "2-kings", "1chr": "1-chronicles", "2chr": "2-chronicles",
  ezra: "ezra", neh: "nehemiah", esth: "esther", job: "job", ps: "psalms",
  pr: "proverbs", eccl: "ecclesiastes", so: "song-of-solomon", is: "isaiah",
  jer: "jeremiah", lam: "lamentations", ez: "ezekiel", dan: "daniel", hos: "hosea",
  joel: "joel", amos: "amos", obad: "obadiah", jon: "jonah", mic: "micah",
  nah: "nahum", hab: "habakkuk", zeph: "zephaniah", hag: "haggai",
  zech: "zechariah", mal: "malachi", mt: "matthew", mk: "mark", lk: "luke",
  jn: "john", acts: "acts", rom: "romans", "1cor": "1-corinthians",
  "2cor": "2-corinthians", gal: "galatians", eph: "ephesians", phil: "philippians",
  col: "colossians", "1thess": "1-thessalonians", "2thess": "2-thessalonians",
  "1tim": "1-timothy", "2tim": "2-timothy", titus: "titus", phlm: "philemon",
  heb: "hebrews", jas: "james", "1pt": "1-peter", "2pt": "2-peter",
  "1jn": "1-john", "2jn": "2-john", "3jn": "3-john", jude: "jude", rev: "revelation",
};

/* ---------- zip reading ---------- */

function listMembers() {
  return execFileSync("unzip", ["-Z1", ZIP])
    .toString("utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.toLowerCase().endsWith(".abc"))
    .sort();
}
function readMember(name) {
  // The release is Latin-1 throughout; no bytes land in the CP1252-only
  // punctuation zone (asserted below), so latin1 is the exact decode.
  return execFileSync("unzip", ["-p", ZIP, name], { maxBuffer: 1 << 26 }).toString("latin1");
}

/* ---------- small text helpers ---------- */

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&middot;/g, "·")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
function stripTags(s) {
  return s.replace(/<[^>]*>/g, "");
}
/** Letters only, lowercase: the comparison stream the two editions are
 * checked against, immune to the page's own spacing artifacts. */
function normLetters(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function nameFlip(s) {
  // "Monk, William Henry (1823-1889)" -> "William Henry Monk (1823-1889)";
  // several people ride one field, semicolon-separated.
  return s
    .split(";")
    .map((part) => {
      const p = part.trim();
      const m = p.match(/^([^,()]+),\s*([^()]+?)\s*(\([^)]*\))?$/);
      return m ? `${m[2].trim()} ${m[1].trim()}${m[3] ? ` ${m[3]}` : ""}` : p;
    })
    .join("; ");
}

/* ---------- copyright admission ---------- */

/**
 * The words-only admission rule. The project's copying page: "All hymns
 * or hymn parts listed as 'public domain' are not under copyright
 * protection in the United States of America", and every non-PD work
 * carries its license on the score. We admit a file when its copyright
 * line claims the public domain and carries no dated copyright on the
 * words; we take the words only, never the music or the setting.
 */
function wordsArePublicDomain(copyLine) {
  const l = copyLine.toLowerCase();
  if (!/public domain/.test(l)) return false;
  if (/(words|lyrics)[^.]*copyright[^.]*\b(19|20)\d\d\b/.test(l)) return false;
  return true;
}

/* ---------- abc parsing ---------- */

function parseAbc(file, text) {
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c >= 0x80 && c <= 0x9f) {
      throw new Error(`${file}: CP1252 punctuation byte 0x${c.toString(16)}; extend the decode`);
    }
  }
  const lines = text.replace(/\r/g, "").split("\n");
  const meta = { scrip: "", metrical: "", author: "", translator: "", composer: "" };
  let title = "";
  const extraTitles = [];
  const cLines = [];
  let lyricSource = "";
  const underlayLines = [];
  const blockLines = [];
  for (const line of lines) {
    let m;
    if ((m = line.match(/^%OH(SCRIP|METRICAL|AUTHOR|TRANSLATOR|COMPOSER)\s+(.*)$/))) {
      const key = { SCRIP: "scrip", METRICAL: "metrical", AUTHOR: "author", TRANSLATOR: "translator", COMPOSER: "composer" }[m[1]];
      meta[key] = decodeEntities(m[2].replace(/\\n/g, " ")).replace(/\s+/g, " ").trim();
    } else if ((m = line.match(/^T:\s*(.+)$/))) {
      if (!title) title = m[1].trim();
      else extraTitles.push(m[1].trim()); // the "(also known as ...)" lines
    } else if ((m = line.match(/^C:\s*(.+)$/))) {
      cLines.push(m[1]);
    } else if ((m = line.match(/^S:\s*(.+)$/))) {
      if (/lyric source/i.test(m[1])) lyricSource = m[1].replace(/^lyric source:\s*/i, "").trim();
    } else if (/^w:/.test(line)) {
      underlayLines.push(line.slice(2));
    } else if (/^W:/.test(line)) {
      blockLines.push(line.slice(2));
    } else if (underlayLines.length && underlayLines[underlayLines.length - 1] !== "") {
      // A non-lyric line ends a system block of the underlay; the boundary
      // decides which verse each syllable line belongs to.
      underlayLines.push("");
    }
  }
  return { meta, title, extraTitles, cLines, lyricSource, underlayLines, blockLines };
}

/** One w: line into a verse number (when printed) and sung syllables. */
function syllablesOf(raw) {
  let line = raw;
  let verse = null;
  const m = line.match(/^\s*(\d+)\s*\.\s*~\s*/);
  if (m) {
    verse = Number(m[1]);
    line = line.slice(m[0].length);
  }
  const syllables = [];
  for (let tok of line.trim().split(/\s+/)) {
    if (!tok || /^[*]+$/.test(tok)) continue; // melisma notes carry no syllable
    tok = tok.replace(/\\-/g, "-"); // printed hyphen splits syllables the same
    tok = tok.replace(/_+$/, ""); // held-syllable extension line
    for (const part of tok.split("~")) {
      if (!part) continue; // "~" glues separate words under one note
      const segs = part.split("-");
      segs.forEach((s, i) => {
        if (s === "") return; // a hyphen's empty neighbor is no syllable
        syllables.push({ text: s, joinNext: i < segs.length - 1 });
      });
    }
  }
  return { verse, syllables };
}

/**
 * The underlay prints every verse under the music, one block per system:
 * numbered "N.~" on the first system, in order after. Refrain words ride
 * under verse one; later verses skip those notes with "*". The refrain
 * can print ahead of the numbered verses ("All Glory, Laud, and Honor")
 * or trail them ("It Is Well"); the first block's numbering says which.
 */
function parseUnderlay(wLines) {
  const streams = new Map();
  let block = [];
  const blocks = [block];
  for (const raw of wLines) {
    if (!raw.trim()) {
      if (block.length) {
        block = [];
        blocks.push(block);
      }
      continue;
    }
    block.push(raw);
  }
  const filled = blocks.filter((b) => b.length);
  for (const b of filled) {
    let cursor = 0;
    for (const raw of b) {
      const { verse, syllables } = syllablesOf(raw);
      cursor = verse ?? cursor + 1;
      if (!streams.has(cursor)) streams.set(cursor, []);
      streams.get(cursor).push(...syllables);
    }
  }
  const refrainBefore = filled.length > 0 && syllablesOf(filled[0][0]).verse == null;
  return { streams, refrainBefore };
}

function wordsOf(syllables) {
  const words = [];
  let cur = "";
  for (const s of syllables) {
    cur += s.text;
    if (!s.joinNext) {
      words.push(cur);
      cur = "";
    }
  }
  if (cur) words.push(cur);
  return words;
}
function lineText(lineSyllables) {
  return wordsOf(lineSyllables).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Chunk one verse's syllable stream into poetic lines against the meter.
 * The meter sets each line's target length; the stream may wander by a
 * syllable or two, so the break points are fit by cost: deviation from
 * the target is dear, a break after punctuation is cheap, and a break
 * inside a hyphenated word is forbidden.
 */
function chunkStream(syllables, pattern) {
  const n = syllables.length;
  const L = pattern.length;
  const INF = 1e9;
  const lineCost = (i, j, target) => {
    const len = j - i;
    let c = Math.abs(len - target) * 10;
    if (len === 0) c += 1000;
    if (j > i && /[,;:.!?]["'”’)\]]*$/.test(syllables[j - 1].text)) c -= 3;
    return c;
  };
  const dp = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(INF));
  const parent = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(-1));
  dp[0][0] = 0;
  for (let l = 1; l <= L; l++) {
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i < j; i++) {
        if (i > 0 && syllables[i - 1].joinNext) continue; // a word spans the break
        const v = dp[l - 1][i] + lineCost(i, j, pattern[l - 1]);
        if (v < dp[l][j]) {
          dp[l][j] = v;
          parent[l][j] = i;
        }
      }
    }
  }
  if (!Number.isFinite(dp[L][n])) return null;
  const lines = [];
  let j = n;
  for (let l = L; l >= 1; l--) {
    const i = parent[l][j];
    if (Math.abs(j - i - pattern[l - 1]) > METER_TOLERANCE) return null;
    lines.unshift(syllables.slice(i, j));
    j = i;
  }
  if (j !== 0) return null;
  return lines;
}

/**
 * The printed meter tokenized: plain numbers, plus the project's refrain
 * annotations ("Gloria18", "Alleluia8", "with Alleluias"). An annotation
 * counts notes, not syllables, so its syllable count is solved from the
 * underlay, never trusted from the label.
 */
function meterTokens(metrical) {
  const tokens = [];
  for (const raw of metrical.split(/\s+/)) {
    if (!raw) continue;
    if (/^\d+$/.test(raw)) tokens.push({ n: Number(raw) });
    else if (/^with$/i.test(raw)) continue; // "with Alleluias": the label rides the next token
    else if (/^Alleluias?$/i.test(raw)) tokens.push({ anno: true, label: "Alleluia", notes: null });
    else {
      const m = raw.match(/^([A-Za-z]+)(\d+)$/);
      if (m) tokens.push({ anno: true, label: m[1], notes: Number(m[2]) });
      else return null; // Irregular, CHORAL, Peculiar, empty: no verse meter
    }
  }
  return tokens.length ? tokens : null;
}

/**
 * Verses after the first carry no refrain under the score, so their count
 * reads the split between verse lines and refrain lines in the printed
 * meter, give or take the wandering syllable. Verse one then checks
 * against the whole pattern, refrain included.
 */
function splitMeter(streams, tokens) {
  const nums = [...streams.keys()].sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) return { error: `underlay verse numbering gap (${nums.join(", ")})` };
  }
  const counts = nums.map((n) => streams.get(n).length);
  const t1 = counts[0];
  const pattern = tokens.map((t) => t.n ?? 0);
  const annos = tokens.filter((t) => t.anno).length;
  const numericSum = pattern.reduce((a, b) => a + b, 0);
  const later = counts.slice(1);
  const t2 = later.length ? [...later].sort((a, b) => a - b)[Math.floor(later.length / 2)] : null;
  if (t2 != null && later.some((c) => Math.abs(c - t2) > METER_TOLERANCE)) {
    return { error: `underlay verse syllable counts differ (${counts.join("/")})` };
  }

  // Annotated meters: the annotation's syllables are solved, not read.
  if (annos) {
    if (annos > 1) return { error: "more than one metrical annotation" };
    const idx = tokens.findIndex((t) => t.anno);
    const before = pattern.slice(0, idx);
    const after = pattern.slice(idx + 1);
    if (t2 != null && t1 - t2 > METER_TOLERANCE) {
      // The annotation marks a refrain printed under verse one alone.
      if (Math.abs(numericSum - t2) > METER_TOLERANCE) {
        return { error: `annotated meter does not sum to the verse count ${t2}` };
      }
      return { versePattern: [...before, ...after], refrainPattern: [t1 - t2] };
    }
    const t = t2 ?? t1;
    if (t2 != null && Math.abs(t1 - t2) > METER_TOLERANCE) {
      return { error: `underlay verse syllable counts differ (${counts.join("/")})` };
    }
    const x = t - numericSum;
    if (x < 1) return { error: "metrical annotation carries no syllables" };
    return { versePattern: [...before, x, ...after], refrainPattern: [] };
  }

  // Plain numeric meters.
  if (t2 == null) {
    if (Math.abs(t1 - numericSum) > METER_TOLERANCE) {
      return { error: `lone underlaid verse carries ${t1} syllables, the meter wants ${numericSum}` };
    }
    return { versePattern: pattern, refrainPattern: [] };
  }
  let bestK = 0;
  let bestDev = Infinity;
  for (let k = 1; k <= pattern.length; k++) {
    const dev = Math.abs(pattern.slice(0, k).reduce((a, b) => a + b, 0) - t2);
    if (dev < bestDev) {
      bestDev = dev;
      bestK = k;
    }
  }
  if (bestDev > METER_TOLERANCE) return { error: `no prefix of the meter sums to the verse count ${t2}` };
  if (bestK === pattern.length) {
    if (Math.abs(t1 - t2) > METER_TOLERANCE) {
      // The later verses fit the whole printed meter while verse one runs
      // long: the score prints a refrain the meter does not count. Its
      // lines are broken at its own punctuation instead.
      if (t1 - numericSum > METER_TOLERANCE) {
        return { versePattern: pattern, refrainPattern: [], freeRefrain: true };
      }
      return { error: `verse one carries ${t1} syllables, the verse meter wants ${t2}` };
    }
    return { versePattern: pattern, refrainPattern: [] };
  }
  if (Math.abs(t1 - numericSum) > METER_TOLERANCE) {
    // The meter's trailing numbers try to count the refrain but fall
    // short of what verse one sings; break the overflow at punctuation
    // and let the text editions arbitrate the words.
    if (t1 > numericSum) {
      return { versePattern: pattern.slice(0, bestK), refrainPattern: [], freeRefrain: true };
    }
    return { error: `verse one carries ${t1} syllables, the meter wants ${numericSum} with its refrain` };
  }
  return { versePattern: pattern.slice(0, bestK), refrainPattern: pattern.slice(bestK) };
}

/**
 * Chunk the verse part of a stream that runs on into an uncounted
 * refrain: the best fit of the meter over a prefix of the stream, with
 * the rest handed to the refrain's own punctuation.
 */
function chunkStreamPrefix(syllables, pattern) {
  const n = syllables.length;
  const L = pattern.length;
  const INF = 1e9;
  const lineCost = (i, j, target) => {
    const len = j - i;
    let c = Math.abs(len - target) * 10;
    if (len === 0) c += 1000;
    if (j > i && /[,;:.!?]["'”’)\]]*$/.test(syllables[j - 1].text)) c -= 3;
    return c;
  };
  const dp = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(INF));
  const parent = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(-1));
  dp[0][0] = 0;
  for (let l = 1; l <= L; l++) {
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i < j; i++) {
        if (i > 0 && syllables[i - 1].joinNext) continue;
        const v = dp[l - 1][i] + lineCost(i, j, pattern[l - 1]);
        if (v < dp[l][j]) {
          dp[l][j] = v;
          parent[l][j] = i;
        }
      }
    }
  }
  // The verse ends where L lines cost least; the meter's sum anchors it.
  const target = pattern.reduce((a, b) => a + b, 0);
  let best = -1;
  let bestCost = INF;
  for (let j = 1; j <= n; j++) {
    const slack = Math.abs(j - target) > METER_TOLERANCE ? 100 : 0;
    if (dp[L][j] + slack < bestCost) {
      bestCost = dp[L][j] + slack;
      best = j;
    }
  }
  if (best < 0 || !Number.isFinite(bestCost)) return null;
  const lines = [];
  let j = best;
  for (let l = L; l >= 1; l--) {
    const i = parent[l][j];
    lines.unshift(syllables.slice(i, j));
    j = i;
  }
  return { lines, consumed: best };
}

/**
 * A refrain the meter does not count, broken at its own punctuation:
 * after a full stop, an exclamation, a question, a semicolon, or a colon;
 * a comma only where a long line forces it.
 */
function chunkRefrainFree(syllables) {
  if (!syllables.length) return null;
  const breaks = [];
  let start = 0;
  for (let i = 0; i < syllables.length; i++) {
    if (syllables[i].joinNext) continue;
    if (/[.!?;:]["'”’)\]]*$/.test(syllables[i].text) && i > start) {
      breaks.push([start, i + 1]);
      start = i + 1;
    }
  }
  breaks.push([start, syllables.length]);
  let lines = breaks.map(([i, j]) => syllables.slice(i, j)).filter((l) => l.length);
  const LONG = 12;
  if (lines.some((l) => l.length > LONG)) {
    const out = [];
    for (const line of lines) {
      if (line.length <= LONG) {
        out.push(line);
        continue;
      }
      let s = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i].joinNext) continue;
        if (/[,]["'”’)\]]*$/.test(line[i].text) && i - s >= 4 && i + 1 < line.length) {
          out.push(line.slice(s, i + 1));
          s = i + 1;
        }
      }
      if (s < line.length) out.push(line.slice(s));
    }
    lines = out;
  }
  return lines;
}

/** The after-score W: blocks: numbered verses, one poetic line per line. */
function parseBlocks(blockLines) {
  const verses = new Map();
  let cur = null;
  let orphans = 0;
  for (const raw of blockLines) {
    if (!raw.trim()) {
      cur = null;
      continue;
    }
    const m = raw.match(/^\s*(\d+)\s*\.\s*/);
    if (m) {
      cur = Number(m[1]);
      if (!verses.has(cur)) verses.set(cur, []);
      const rest = raw.slice(m[0].length).trim().replace(/\s+/g, " ");
      if (rest) verses.get(cur).push(rest);
      continue;
    }
    const t = raw.trim().replace(/\s+/g, " ");
    if (!t) continue;
    if (cur == null) orphans++;
    else verses.get(cur).push(t);
  }
  return { verses, orphans };
}

/* ---------- the ThML edition (validation witness) ---------- */

/**
 * The release's own ThML text: one div3 per score, verse paragraphs that
 * may carry the refrain baked before the verse number ("All glory, laud
 * and honor... 1. Thou art the King") or after the verse's last line.
 */
function parseThml(xml) {
  const entries = [];
  const parts = xml.split(/<div3 title="[^"]*">/);
  const heads = [...xml.matchAll(/<div3 title="([^"]*)">/g)].map((m) => m[1]);
  for (let i = 1; i < parts.length; i++) {
    const body = parts[i];
    const h3 = body.match(/<h3>([\s\S]*?)<\/h3>/i);
    const rawTitle = h3 ? decodeEntities(stripTags(h3[1])).replace(/\s+/g, " ").trim() : heads[i - 1].replace(/_/g, " ");
    const verses = new Map();
    let credit = "";
    for (const pm of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const italic = /<i>/i.test(pm[0].slice(0, 12));
      const t = decodeEntities(stripTags(pm[1])).replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (italic || /^(words|music|setting|copyright)\s*:/i.test(t)) {
        if (/words\s*:|copyright\s*:/i.test(t) && !credit) credit = t;
        continue;
      }
      // Verse numbers may sit inside the paragraph, the refrain before them.
      const marks = [...t.matchAll(/(?:^|\s)(\d{1,2})\.\s/g)];
      if (!marks.length) continue;
      const pre = t.slice(0, marks[0].index).trim();
      for (let k = 0; k < marks.length; k++) {
        const n = Number(marks[k][1]);
        const start = marks[k].index + marks[k][0].length;
        const end = k + 1 < marks.length ? marks[k + 1].index : t.length;
        verses.set(n, { pre: k === 0 ? pre : "", text: t.slice(start, end).trim() });
      }
    }
    entries.push({ rawTitle, verses, credit });
  }
  return entries;
}

/** "It Is Well With My Soul(When Peace Like a River)" and the
 * "...(also known as X or Y)" form both name alternates after the title. */
function splitTitle(raw) {
  const aka = raw.match(/^(.*?)\s*\(also known as (.*)\)\s*$/i);
  if (aka) {
    const alts = aka[2].split(/\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
    return { title: aka[1].trim(), altTitles: alts };
  }
  const paren = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (paren) return { title: paren[1].trim(), altTitles: [paren[2].trim()] };
  return { title: raw.trim(), altTitles: [] };
}
function titleKey(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The project's current all-lyrics page, the fallback witness for the
 * handful of scores the 2014.06 ThML omits. Same paragraph shape as the
 * ThML; a newer revision can disagree with the 2014.06 score, and a
 * disagreement still excludes the hymn.
 */
function parseAllLyricsPage(html) {
  const entries = [];
  for (const chunk of html.split(/<h3>/i).slice(1)) {
    const end = chunk.indexOf("</h3>");
    if (end < 0) continue;
    const rawTitle = decodeEntities(stripTags(chunk.slice(0, end))).replace(/\s+/g, " ").trim();
    const body = chunk.slice(end + 6);
    const verses = new Map();
    let credit = "";
    for (const pm of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const italic = /<i>/i.test(pm[0].slice(0, 12));
      const t = decodeEntities(stripTags(pm[1])).replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (italic || /^(words|music|setting|copyright)\s*:/i.test(t)) {
        if (/words\s*:|copyright\s*:/i.test(t) && !credit) credit = t;
        continue;
      }
      const marks = [...t.matchAll(/(?:^|\s)(\d{1,2})\.\s/g)];
      if (!marks.length) continue;
      const pre = t.slice(0, marks[0].index).trim();
      for (let k = 0; k < marks.length; k++) {
        const n = Number(marks[k][1]);
        const start = marks[k].index + marks[k][0].length;
        const end = k + 1 < marks.length ? marks[k + 1].index : t.length;
        verses.set(n, { pre: k === 0 ? pre : "", text: t.slice(start, end).trim() });
      }
    }
    entries.push({ rawTitle, verses, credit });
  }
  return entries;
}

/* ---------- scripture references ---------- */

/**
 * The %OHSCRIP line, piece by piece: "1Thess 5:17, Ps 5:3,12, Mk 11:24-25".
 * The book carries forward; a bare number after a chapter:verse piece is
 * another verse of that chapter where the verse exists ("Ps 5:3,12"),
 * another chapter where it does not ("Ps 63:6-8, 73" is Psalm 73). A piece
 * naming no verse of the canon is a documented source error: it drops out
 * of the index and into the build report, the confessions rule.
 */
async function parseScrip(scrip, file, dropped) {
  const refs = [];
  let book = null;
  let chapterCtx = null;
  for (const piece of scrip.split(",")) {
    const p = piece.trim();
    if (!p) continue;
    const m = p.match(/^([1-3]?[A-Za-z]+)?\s*(\d+)(?:\s*-\s*(\d+))?(?::(\d+)[a-z]?(?:\s*-\s*(\d+)[a-z]?)?)?$/);
    if (!m) throw new Error(`${file}: unparseable OHSCRIP piece "${p}" in "${scrip}"`);
    if (m[1]) {
      const slug = OH_BOOKS[m[1].toLowerCase()];
      if (!slug) throw new Error(`${file}: unknown OHSCRIP book "${m[1]}"`);
      book = slug;
      chapterCtx = null;
    }
    if (!book) throw new Error(`${file}: OHSCRIP piece "${p}" names no book`);
    let chapter = Number(m[2]);
    const chapterTo = m[3] !== undefined ? Number(m[3]) : undefined;
    let from = m[4] !== undefined ? Number(m[4]) : undefined;
    let to = m[5] !== undefined ? Number(m[5]) : from;
    if (from === undefined && chapterTo !== undefined) {
      // A chapter range: "Rev 4-6" is Revelation 4 through 6.
      let ok = true;
      for (let c = chapter; c <= chapterTo; c++) {
        if (c >= 1 && c <= CHAPTERS[book]) refs.push({ book, chapter: c });
        else {
          dropped.push({ file, piece: p, reason: `${book} ${c} is beyond the canon` });
          ok = false;
          break;
        }
      }
      chapterCtx = null;
      continue;
    }
    if (from === undefined && chapterCtx != null) {
      // No colon: a verse of the current chapter when it exists, else a chapter.
      const set = await kjvVerseSet(book);
      if (set.has(`${chapterCtx}:${chapter}`)) {
        from = chapter;
        to = chapter;
        chapter = chapterCtx;
      }
    }
    if (!(chapter >= 1 && chapter <= CHAPTERS[book])) {
      dropped.push({ file, piece: p, reason: `${book} ${chapter} is beyond the canon` });
      continue;
    }
    if (from === undefined) {
      refs.push({ book, chapter });
      chapterCtx = null;
      continue;
    }
    const set = await kjvVerseSet(book);
    let ok = true;
    for (let v = from; v <= to; v++) {
      if (!set.has(`${chapter}:${v}`)) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      dropped.push({ file, piece: p, reason: `${book} ${chapter}:${from}${to !== from ? `-${to}` : ""} is no verse of the canon` });
      continue;
    }
    refs.push(to !== from ? { book, chapter, from, to } : { book, chapter, from });
    chapterCtx = chapter;
  }
  return refs;
}

/* ---------- assembly ---------- */

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const members = listMembers();
  const thmlEntries = parseThml(await fs.readFile(THML, "utf8"));
  const thmlByTitle = new Map();
  for (const e of thmlEntries) {
    const { title } = splitTitle(e.rawTitle);
    const key = titleKey(title);
    if (!thmlByTitle.has(key)) thmlByTitle.set(key, []);
    thmlByTitle.get(key).push(e);
  }
  const thmlCursor = new Map();
  const allEntries = parseAllLyricsPage(await fs.readFile(ALLLYRICS, "utf8"));
  const allByTitle = new Map();
  for (const e of allEntries) {
    const { title } = splitTitle(e.rawTitle);
    const key = titleKey(title);
    if (!allByTitle.has(key)) allByTitle.set(key, []);
    allByTitle.get(key).push(e);
  }
  const allCursor = new Map();

  const report = {
    files: members.length,
    thmlScores: thmlEntries.length,
    admitted: 0,
    excluded: [],
    droppedRefs: [],
    selections: [],
    validated: 0,
    hymns: 0,
    merged: 0,
  };
  const records = [];

  for (const file of members) {
    const text = readMember(file);
    const parsed = parseAbc(file, text);
    const startLen = report.excluded.length;
    const fail = (reason) => report.excluded.push({ file, reason });
    const failed = () => report.excluded.length > startLen;

    const copyLine = parsed.cLines.find((l) => /copyright/i.test(l)) ?? "";
    if (!wordsArePublicDomain(copyLine)) {
      fail(`words not verified public domain (${copyLine.trim() || "no copyright line"})`);
      continue;
    }
    if (!parsed.title) {
      fail("no title");
      continue;
    }
    const tokens = meterTokens(parsed.meta.metrical);
    if (!tokens) {
      fail(`no verse meter "${parsed.meta.metrical}"`);
      continue;
    }

    // The sung verses, chunked into poetic lines against the meter.
    const { streams, refrainBefore } = parseUnderlay(parsed.underlayLines);
    let verses = new Map();
    let refrain = null;
    let versePattern = tokens.filter((t) => !t.anno).map((t) => t.n);
    if (streams.size) {
      const split = splitMeter(streams, tokens);
      if (split.error) {
        fail(split.error);
        continue;
      }
      versePattern = split.versePattern;
      const { refrainPattern, freeRefrain } = split;
      const full = [...versePattern, ...refrainPattern];
      for (const [n, stream] of streams) {
        if (n === 1 && freeRefrain) {
          const pre = chunkStreamPrefix(stream, versePattern);
          const free = pre && chunkRefrainFree(stream.slice(pre.consumed));
          if (!pre || !free || !free.length) {
            fail("the uncounted refrain will not break into lines");
            break;
          }
          verses.set(1, pre.lines.map(lineText));
          refrain = free.map(lineText);
          continue;
        }
        const chunk = chunkStream(stream, n === 1 ? full : versePattern);
        if (!chunk) {
          fail(`verse ${n} will not fit the meter`);
          break;
        }
        if (n === 1 && refrainPattern.length) {
          if (refrainBefore) {
            refrain = chunk.slice(0, refrainPattern.length).map(lineText);
            verses.set(1, chunk.slice(refrainPattern.length).map(lineText));
          } else {
            verses.set(1, chunk.slice(0, versePattern.length).map(lineText));
            refrain = chunk.slice(versePattern.length).map(lineText);
          }
        } else {
          verses.set(n, chunk.map(lineText));
        }
      }
      if (failed()) continue;
    }

    // The after-score verses, printed as clean text; they outrank the
    // underlay where both carry a verse, and they fill the verses the
    // score does not underlay.
    const blocks = parseBlocks(parsed.blockLines);
    if (blocks.orphans) {
      fail(`${blocks.orphans} after-score lines outside any verse`);
      continue;
    }
    for (const [n, lines] of blocks.verses) verses.set(n, lines);

    const nums = [...verses.keys()].sort((a, b) => a - b);
    if (!nums.length) {
      fail("no verses recovered");
      continue;
    }
    if (nums.some((n, i) => n !== i + 1)) {
      fail(`verse numbering gap (${nums.join(", ")})`);
      continue;
    }

    // The witnesses: the release's ThML text first, the project's current
    // all-lyrics page second; both come from the same project's editions
    // of the same scores. Matching either one letter for letter, verse
    // for verse, admits the hymn; matching neither excludes it. Where the
    // page carries more verses than the score underlays, the score's own
    // selection ships, recorded as such.
    const key = titleKey(splitTitle(parsed.title).title);
    const candidates = [];
    const pool = thmlByTitle.get(key) ?? [];
    const cursor = thmlCursor.get(key) ?? 0;
    if (pool[cursor]) candidates.push({ kind: "thml", witness: pool[cursor] });
    thmlCursor.set(key, cursor + 1);
    const apool = allByTitle.get(key) ?? [];
    const acursor = allCursor.get(key) ?? 0;
    if (apool[acursor]) candidates.push({ kind: "alllyrics", witness: apool[acursor] });
    allCursor.set(key, acursor + 1);
    if (!candidates.length) {
      fail("no text edition to verify against");
      continue;
    }
    const refrainLetters = refrain ? normLetters(refrain.join(" ")) : "";
    let witnessKind = null;
    let firstBad = null;
    for (const { kind, witness } of candidates) {
      let badVerse = null;
      if (witness.verses.size < nums.length) {
        badVerse = `count ${nums.length} against the ${kind} text's ${witness.verses.size}`;
      } else {
        for (const n of nums) {
          const mine = normLetters(verses.get(n).join(" "));
          const w = witness.verses.get(n);
          if (!w) {
            badVerse = n;
            break;
          }
          const page = normLetters(`${w.pre} ${w.text}`);
          const shapes = refrainLetters
            ? [mine, mine + refrainLetters, refrainLetters + mine]
            : [mine];
          if (!shapes.includes(page)) {
            badVerse = n;
            if (process.env.HYMN_DEBUG === file) {
              console.log("MINE  :", JSON.stringify(verses.get(n)));
              console.log("REFR  :", refrain ? JSON.stringify(refrain) : "(none)");
              console.log("PAGE♦ :", JSON.stringify(w.pre));
              console.log("PAGE  :", JSON.stringify(w.text));
            }
            break;
          }
        }
      }
      if (badVerse == null) {
        witnessKind = kind;
        if (witness.verses.size > nums.length) {
          report.selections.push({ file, scoreVerses: nums.length, pageVerses: witness.verses.size });
        }
        break;
      }
      if (firstBad == null) firstBad = { kind, badVerse };
    }
    if (!witnessKind) {
      fail(`the ${firstBad.kind} text disagrees at verse ${firstBad.badVerse}`);
      continue;
    }
    report.validated++;
    if (witnessKind === "alllyrics") report.allLyricsValidated = (report.allLyricsValidated ?? 0) + 1;
    const witness = candidates.find((c) => c.kind === witnessKind).witness;

    const refs = await parseScrip(parsed.meta.scrip || "", file, report.droppedRefs);
    // Alternate titles ride the abc's own trailing T: lines and both
    // editions' parentheticals.
    const altTitles = [
      ...new Set(
        [parsed.title, ...parsed.extraTitles, witness.rawTitle]
          .flatMap((t) => splitTitle(t).altTitles)
          .filter(Boolean)
      ),
    ];
    const authorRaw = parsed.meta.author;
    const translatorRaw = parsed.meta.translator;
    const composerRaw = parsed.meta.composer;
    const creditLine = parsed.cLines.find((l) => /^words:/i.test(l.trim())) ?? "";
    const tuneMatch = (parsed.cLines.find((l) => /music:/i.test(l)) ?? "").match(/music:\s*'([^']+)'/i);
    const tuneName = tuneMatch
      ? tuneMatch[1].trim()
      : file.replace(/\.abc$/i, "").split("-").slice(1).join("-").replace(/_/g, " ") || "Unknown tune";

    records.push({
      file,
      title: splitTitle(parsed.title).title,
      altTitles,
      author: authorRaw && !/^(none|unknown)$/i.test(authorRaw) ? nameFlip(authorRaw) : null,
      translator: translatorRaw && !/^(none|unknown)$/i.test(translatorRaw) ? nameFlip(translatorRaw) : null,
      meter: versePattern.join("."),
      credit: creditLine.replace(/^words:\s*/i, "").trim(),
      tune: { name: tuneName, composer: composerRaw && !/^(none|unknown)$/i.test(composerRaw) ? nameFlip(composerRaw) : null },
      lyricSource: parsed.lyricSource || null,
      firstLine: verses.get(1)[0],
      verses: nums.map((n) => verses.get(n)),
      refrain,
      refs,
    });
    report.admitted++;
  }

  // One hymn, several scores: merge files whose words agree; keep variant
  // texts (the two Mighty Fortress translations) as separate hymns.
  const hymns = [];
  for (const rec of records) {
    const words = normLetters(`${rec.title} ${rec.verses.map((v) => v.join(" ")).join(" ")}`);
    const existing = hymns.find((h) => h._words === words);
    if (existing) {
      existing.tunes.push(rec.tune);
      const seen = new Set(existing.refs.map((r) => `${r.book}:${r.chapter}:${r.from ?? ""}:${r.to ?? ""}`));
      for (const r of rec.refs) {
        const k = `${r.book}:${r.chapter}:${r.from ?? ""}:${r.to ?? ""}`;
        if (!seen.has(k)) {
          seen.add(k);
          existing.refs.push(r);
        }
      }
      if (rec.lyricSource && !existing.lyricSources.includes(rec.lyricSource)) {
        existing.lyricSources.push(rec.lyricSource);
      }
      report.merged++;
      continue;
    }
    hymns.push({
      _words: words,
      title: rec.title,
      altTitles: rec.altTitles,
      author: rec.author,
      translator: rec.translator,
      meter: rec.meter,
      credit: rec.credit,
      tunes: [rec.tune],
      lyricSources: rec.lyricSource ? [rec.lyricSource] : [],
      firstLine: rec.firstLine,
      verses: rec.verses,
      refrain: rec.refrain,
      refs: rec.refs,
    });
  }

  // Slugs: the title's own; variant texts of one title part company by
  // the translator's (or author's) surname, then by a plain counter.
  const byBase = new Map();
  for (const h of hymns) {
    const base = slugify(h.title);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(h);
  }
  for (const [base, group] of byBase) {
    if (group.length === 1) {
      group[0].id = base;
      continue;
    }
    const seen = new Set();
    for (const h of group) {
      const person = (h.translator ?? h.author ?? "").replace(/\([^)]*\)/g, "").trim();
      const surname = person.split(/\s+/).pop() ?? "";
      const distinctive = surname && !/^(unknown|anonymous|composite)$/i.test(surname);
      let slug = distinctive
        ? `${base}-${surname.toLowerCase()}`
        : h.tunes[0]
          ? `${base}-${slugify(h.tunes[0].name)}`
          : base;
      let n = 2;
      while (seen.has(slug)) slug = `${base}-${n++}`;
      seen.add(slug);
      h.id = slug;
    }
  }

  await fs.rm(path.join(OUT, "texts"), { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, "texts"), { recursive: true });
  const index = [];
  for (const h of hymns) {
    const { _words, ...pub } = h;
    await fs.writeFile(path.join(OUT, "texts", `${h.id}.json`), JSON.stringify(pub, null, 1) + "\n");
    index.push({
      id: h.id,
      title: h.title,
      altTitles: h.altTitles.length ? h.altTitles : undefined,
      author: h.author,
      translator: h.translator,
      meter: h.meter,
      tunes: h.tunes.map((t) => t.name),
      firstLine: h.firstLine,
      verses: h.verses.length,
      refrain: Boolean(h.refrain),
    });
  }
  index.sort((a, b) => a.title.localeCompare(b.title));
  await fs.writeFile(OUT + "/index.json", JSON.stringify({ hymns: index }, null, 1) + "\n");
  report.hymns = hymns.length;
  await fs.writeFile(OUT + "/_meta.json", JSON.stringify(report, null, 1) + "\n");

  console.log(`files: ${report.files}, admitted: ${report.admitted}, hymns: ${report.hymns} (merged ${report.merged} duplicates)`);
  console.log(`validated against the ThML text: ${report.validated}; exclusions: ${report.excluded.length}; dropped refs: ${report.droppedRefs.length}`);
  for (const e of report.excluded.slice(0, 30)) console.log(`  - ${e.file}: ${e.reason}`);
  if (report.excluded.length > 30) console.log(`  … and ${report.excluded.length - 30} more (see _meta.json)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
