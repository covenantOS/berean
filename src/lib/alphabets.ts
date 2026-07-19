/**
 * The Greek and Hebrew alphabets, hand-built for the Tools pane: each
 * letter with its name, transliteration, pronunciation hint, and the value
 * it carries when the letters serve as numerals. The same tables drive the
 * numeric converter (a number spelled in letters, letters summed back to a
 * number) and the text converter (script to transliteration; Greek also
 * transliteration back to script, where the mapping has one answer).
 *
 * Sources: the standard grammars. Letter names, sounds, and values follow
 * Gesenius-Kautzsch for Hebrew and Smyth for Greek; the numeral schemes are
 * the ones the manuscripts use, Hebrew hundreds climbing past 400 by
 * compounding tav (500 as tav-qof, and so on), Greek pressing the three
 * archaic letters back into service (digamma 6, qoppa 90, sampi 900) with
 * the keraia mark closing a numeral. The cantillation table lists the
 * accents TAHOT's pointed text actually carries, with their roles after
 * Wickes and Gesenius §15.
 */

export interface LetterInfo {
  glyph: string;
  name: string;
  /** The transliteration the text converter writes. */
  translit: string;
  /** A plain pronunciation hint. */
  sound: string;
  /** The letter's value as a numeral. */
  value: number;
}

/* ---------- Hebrew ---------- */

export const HEBREW_LETTERS: LetterInfo[] = [
  { glyph: "א", name: "Alef", translit: "ʾ", sound: "silent; a pause in the throat", value: 1 },
  { glyph: "ב", name: "Bet", translit: "b", sound: "b; v without the dot", value: 2 },
  { glyph: "ג", name: "Gimel", translit: "g", sound: "g as in go", value: 3 },
  { glyph: "ד", name: "Dalet", translit: "d", sound: "d as in door", value: 4 },
  { glyph: "ה", name: "He", translit: "h", sound: "h as in house", value: 5 },
  { glyph: "ו", name: "Waw", translit: "w", sound: "w as in water", value: 6 },
  { glyph: "ז", name: "Zayin", translit: "z", sound: "z as in zeal", value: 7 },
  { glyph: "ח", name: "Het", translit: "ḥ", sound: "ch as in Bach", value: 8 },
  { glyph: "ט", name: "Tet", translit: "ṭ", sound: "t, pressed", value: 9 },
  { glyph: "י", name: "Yod", translit: "y", sound: "y as in yes", value: 10 },
  { glyph: "כ", name: "Kaf", translit: "k", sound: "k; ch as in Bach without the dot", value: 20 },
  { glyph: "ל", name: "Lamed", translit: "l", sound: "l as in lamp", value: 30 },
  { glyph: "מ", name: "Mem", translit: "m", sound: "m as in mother", value: 40 },
  { glyph: "נ", name: "Nun", translit: "n", sound: "n as in name", value: 50 },
  { glyph: "ס", name: "Samekh", translit: "s", sound: "s as in song", value: 60 },
  { glyph: "ע", name: "Ayin", translit: "ʿ", sound: "a catch deep in the throat", value: 70 },
  { glyph: "פ", name: "Pe", translit: "p", sound: "p; f without the dot", value: 80 },
  { glyph: "צ", name: "Tsade", translit: "ṣ", sound: "ts as in nets", value: 90 },
  { glyph: "ק", name: "Qof", translit: "q", sound: "k from the back of the throat", value: 100 },
  { glyph: "ר", name: "Resh", translit: "r", sound: "r, rolled lightly", value: 200 },
  { glyph: "ש", name: "Shin / Sin", translit: "š", sound: "sh with the right dot, s with the left", value: 300 },
  { glyph: "ת", name: "Tav", translit: "t", sound: "t as in table", value: 400 },
];

/** The five letters that change shape at a word's end, value unchanged. */
export const HEBREW_FINALS: Record<string, string> = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ",
};

const H_ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const H_TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
/* Past 400 the hundreds compound on tav: 500 tav-qof through 900 tav-tav-qof. */
const H_HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];

/**
 * A number spelled in Hebrew letters, 1 through 999. Fifteen and sixteen
 * take tet-waw and tet-zayin rather than yod-he and yod-waw, the letters
 * of the Name staying unwritten.
 */
export function hebrewNumeral(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 999) return null;
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const t = Math.floor(rest / 10);
  const o = rest % 10;
  let body: string;
  if (rest === 15) body = "טו";
  else if (rest === 16) body = "טז";
  else body = H_TENS[t] + H_ONES[o];
  return H_HUNDREDS[h] + body;
}

/* ---------- Greek ---------- */

export const GREEK_LETTERS: LetterInfo[] = [
  { glyph: "α", name: "Alpha", translit: "a", sound: "a as in father", value: 1 },
  { glyph: "β", name: "Beta", translit: "b", sound: "b as in book", value: 2 },
  { glyph: "γ", name: "Gamma", translit: "g", sound: "g as in go; ng before γ κ χ ξ", value: 3 },
  { glyph: "δ", name: "Delta", translit: "d", sound: "d as in door", value: 4 },
  { glyph: "ε", name: "Epsilon", translit: "e", sound: "e as in met", value: 5 },
  { glyph: "ζ", name: "Zeta", translit: "z", sound: "z as in daze", value: 7 },
  { glyph: "η", name: "Eta", translit: "ē", sound: "a as in air, held long", value: 8 },
  { glyph: "θ", name: "Theta", translit: "th", sound: "th as in thin", value: 9 },
  { glyph: "ι", name: "Iota", translit: "i", sound: "i as in machine", value: 10 },
  { glyph: "κ", name: "Kappa", translit: "k", sound: "k as in keep", value: 20 },
  { glyph: "λ", name: "Lambda", translit: "l", sound: "l as in lamp", value: 30 },
  { glyph: "μ", name: "Mu", translit: "m", sound: "m as in mother", value: 40 },
  { glyph: "ν", name: "Nu", translit: "n", sound: "n as in name", value: 50 },
  { glyph: "ξ", name: "Xi", translit: "x", sound: "x as in axe", value: 60 },
  { glyph: "ο", name: "Omicron", translit: "o", sound: "o as in not", value: 70 },
  { glyph: "π", name: "Pi", translit: "p", sound: "p as in pen", value: 80 },
  { glyph: "ρ", name: "Rho", translit: "r", sound: "r, rolled lightly", value: 100 },
  { glyph: "σ", name: "Sigma", translit: "s", sound: "s as in song; ς at a word's end", value: 200 },
  { glyph: "τ", name: "Tau", translit: "t", sound: "t as in table", value: 300 },
  { glyph: "υ", name: "Upsilon", translit: "y", sound: "French u, German ü", value: 400 },
  { glyph: "φ", name: "Phi", translit: "ph", sound: "ph as in phone", value: 500 },
  { glyph: "χ", name: "Chi", translit: "ch", sound: "ch as in Bach", value: 600 },
  { glyph: "ψ", name: "Psi", translit: "ps", sound: "ps as in lapse", value: 700 },
  { glyph: "ω", name: "Omega", translit: "ō", sound: "o as in note, held long", value: 800 },
];

/** The three archaic letters the numeral system keeps for 6, 90, and 900. */
export const GREEK_NUMERAL_ONLY: LetterInfo[] = [
  { glyph: "ϛ", name: "Digamma", translit: "w", sound: "numeral only, for six", value: 6 },
  { glyph: "ϟ", name: "Qoppa", translit: "q", sound: "numeral only, for ninety", value: 90 },
  { glyph: "ϡ", name: "Sampi", translit: "s", sound: "numeral only, for nine hundred", value: 900 },
];

const G_ONES = ["", "α", "β", "γ", "δ", "ε", "ϛ", "ζ", "η", "θ"];
const G_TENS = ["", "ι", "κ", "λ", "μ", "ν", "ξ", "ο", "π", "ϟ"];
const G_HUNDREDS = ["", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω", "ϡ"];

/** The keraia, the mark that closes a numeral spelled in letters. */
export const KERAIA = "ʹ";

/** A number spelled in Greek letters, 1 through 999, keraia appended. */
export function greekNumeral(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 999) return null;
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  return G_HUNDREDS[h] + G_TENS[t] + G_ONES[o] + KERAIA;
}

/* ---------- letters summed back to numbers ---------- */

const HEBREW_VALUES = new Map<string, number>(
  HEBREW_LETTERS.map((l) => [l.glyph, l.value])
);
const GREEK_VALUES = new Map<string, number>(
  [...GREEK_LETTERS, ...GREEK_NUMERAL_ONLY].map((l) => [l.glyph, l.value])
);
GREEK_VALUES.set("ς", 200);

/** Hebrew letters summed as a numeral; pointing and accents are ignored. */
export function hebrewLettersValue(text: string): number {
  let sum = 0;
  for (const ch of text) {
    const base = HEBREW_FINALS[ch] ?? ch;
    sum += HEBREW_VALUES.get(base) ?? 0;
  }
  return sum;
}

/** Greek letters summed as a numeral; accents, breathings, keraia ignored. */
export function greekLettersValue(text: string): number {
  let sum = 0;
  for (const ch of text.normalize("NFD")) {
    if (/[̀-ͯ]/.test(ch)) continue;
    sum += GREEK_VALUES.get(ch.toLowerCase()) ?? 0;
  }
  return sum;
}

/* ---------- transliteration ---------- */

const HEBREW_XLIT = new Map<string, string>(
  HEBREW_LETTERS.map((l) => [l.glyph, l.translit])
);

/**
 * Hebrew script to transliteration, consonant by consonant; final forms
 * read as their base letters, and sin transliterates as shin does, the
 * dots falling with the rest of the pointing. The vowel points and the
 * cantillation accents stay behind, the consonants carrying no vowels.
 */
export function hebrewToTranslit(text: string): string {
  let out = "";
  for (const ch of text) {
    if (/[֑-ׇ]/.test(ch)) continue; // points, accents, the shin and sin dots
    const base = HEBREW_FINALS[ch] ?? ch;
    out += HEBREW_XLIT.get(base) ?? (/[א-ת]/.test(ch) ? "" : ch);
  }
  return out;
}

const GREEK_XLIT = new Map<string, string>([
  ...GREEK_LETTERS.map((l) => [l.glyph, l.translit] as [string, string]),
  ["ς", "s"],
]);

/** Greek script to transliteration; accents and breathings drop away. */
export function greekToTranslit(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFD")) {
    if (/[̀-ͯ]/.test(ch)) continue;
    out += GREEK_XLIT.get(ch.toLowerCase()) ?? (/[Ͱ-Ͽἀ-῾]/.test(ch) ? "" : ch);
  }
  return out;
}

/* The reverse path, longest tokens first; plain e and o land on epsilon
 * and omicron, eta and omega answering to their long-marked ē and ō. */
const XLIT_TO_GREEK: [string, string][] = [
  ["ps", "ψ"],
  ["ph", "φ"],
  ["ch", "χ"],
  ["th", "θ"],
  ["ē", "η"],
  ["ō", "ω"],
  ...[...GREEK_XLIT.entries()]
    .filter(([g]) => g !== "ς")
    .map(([g, x]) => [x, g] as [string, string])
    .filter(([x]) => x.length === 1),
];

/**
 * Greek transliteration back to script. The marked vowels ē and ō keep eta
 * and omega unambiguous; sigma closes as ς after anything that is not a
 * letter of its own word. Tokens with no mapping pass through untouched.
 */
export function translitToGreek(text: string): string {
  let out = "";
  let i = 0;
  const lower = text.toLowerCase();
  while (i < lower.length) {
    const hit = XLIT_TO_GREEK.find(([x]) => lower.startsWith(x, i));
    if (hit) {
      let glyph = hit[1];
      if (glyph === "σ") {
        const next = lower[i + 1];
        if (next === undefined || next === " " || !/[a-zēō]/.test(next)) glyph = "ς";
      }
      out += glyph;
      i += hit[0].length;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

/* ---------- cantillation ---------- */

export interface Cantillation {
  /** The accent as it prints in the pointed text, on a dotted circle. */
  mark: string;
  name: string;
  /** Disjunctive accents divide the verse; conjunctive ones bind words. */
  role: string;
}

/**
 * The major accents TAHOT's pointed text carries, disjunctive first, in
 * roughly descending weight. Roles after Wickes and Gesenius §15: the
 * disjunctives mark the verse's pauses, the conjunctives bind a word to
 * the word that follows.
 */
export const CANTILLATIONS: Cantillation[] = [
  { mark: "◌ֽ", name: "Silluq", role: "closes the verse, before sof pasuq" },
  { mark: "◌׃", name: "Sof pasuq", role: "the verse's own full stop" },
  { mark: "◌֑", name: "Athnach", role: "the verse's great mid-pause" },
  { mark: "◌֒", name: "Segolta", role: "major pause early in a half-verse" },
  { mark: "◌֔", name: "Zaqef qatan", role: "pause dividing a half-verse" },
  { mark: "◌֕", name: "Zaqef gadol", role: "the weightier zaqef" },
  { mark: "◌֖", name: "Tifcha", role: "pause before silluq or athnach" },
  { mark: "◌֗", name: "Revia", role: "pause inside a segment" },
  { mark: "◌֘", name: "Zarqa", role: "pause looking back over a segment" },
  { mark: "◌֙", name: "Pashta", role: "pause doubling at a word's end" },
  { mark: "◌֚", name: "Yetiv", role: "pause standing in for pashta" },
  { mark: "◌֣", name: "Munach", role: "conjunctive, binds word to word" },
  { mark: "◌֤", name: "Mahapakh", role: "conjunctive, binds word to word" },
  { mark: "◌֥", name: "Mercha", role: "conjunctive, the common binder" },
  { mark: "◌֦", name: "Mercha kefula", role: "conjunctive, the doubled mercha" },
  { mark: "◌֧", name: "Darga", role: "conjunctive, often before tifcha" },
  { mark: "◌֨", name: "Qadma", role: "conjunctive, often before geresh" },
  { mark: "◌֩", name: "Telisha qetana", role: "conjunctive, the lesser telisha" },
  { mark: "◌֪", name: "Yerach ben yomo", role: "conjunctive, one word before a pause" },
];
