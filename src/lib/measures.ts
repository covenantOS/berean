/**
 * Weights and measures: the biblical units with their modern equivalents,
 * hand-built for the Tools pane's converter. Each unit stores its value in
 * the kind's modern base (meters, grams, or liters), so any pair converts
 * through one multiplication. Ancient measures were never standardized and
 * the equivalents below are the approximate values most reference works
 * give; the pane says so beside the numbers.
 *
 * Sources for the equivalents: the tables in the ESV and NIV study notes
 * and the standard dictionaries (New Bible Dictionary, ISBE). Lengths run
 * off the common cubit of about 18 inches (the long cubit of Ezekiel 40:5
 * runs a handbreadth longer); weights off the common shekel of about 11.4
 * grams; the ephah and the bath are one measure, dry and liquid, per
 * Ezekiel 45:11. The mina is reckoned at 50 shekels (1 Kings 10:17 reads
 * naturally that way); Ezekiel 45:12 counts 60, one of the places the
 * sources disagree.
 */

export type MeasureKind = "length" | "weight" | "dry" | "liquid";

export const MEASURE_KIND_LABELS: Record<MeasureKind, string> = {
  length: "Length",
  weight: "Weight",
  dry: "Dry volume",
  liquid: "Liquid volume",
};

export interface MeasureRef {
  book: string;
  chapter: number;
  /** The display label, verse included, e.g. "Ezekiel 45:11". */
  label: string;
}

export interface MeasureUnit {
  id: string;
  name: string;
  kind: MeasureKind;
  /** One unit in the kind's base: meters, grams, or liters. */
  inBase: number;
  /** A well-known occurrence, deep-linked from the table. */
  ref?: MeasureRef;
}

const CUBIT = 0.4572; // 18 inches
const SHEKEL = 11.4; // grams
const EPHAH = 22; // liters

/** The biblical units, each kind's ladder built on its base measure. */
export const BIBLICAL_UNITS: MeasureUnit[] = [
  // Length: a cubit is 2 spans, 6 handbreadths, 24 fingers.
  { id: "cubit", name: "Cubit", kind: "length", inBase: CUBIT, ref: { book: "genesis", chapter: 6, label: "Genesis 6:15" } },
  { id: "span", name: "Span", kind: "length", inBase: CUBIT / 2, ref: { book: "exodus", chapter: 28, label: "Exodus 28:16" } },
  { id: "handbreadth", name: "Handbreadth", kind: "length", inBase: CUBIT / 6, ref: { book: "exodus", chapter: 25, label: "Exodus 25:25" } },
  { id: "finger", name: "Finger", kind: "length", inBase: CUBIT / 24, ref: { book: "jeremiah", chapter: 52, label: "Jeremiah 52:21" } },
  // Weight: a talent is 3,000 shekels; a shekel is 2 bekahs, 20 gerahs.
  { id: "talent", name: "Talent", kind: "weight", inBase: 3000 * SHEKEL, ref: { book: "exodus", chapter: 38, label: "Exodus 38:24" } },
  { id: "mina", name: "Mina", kind: "weight", inBase: 50 * SHEKEL, ref: { book: "1-kings", chapter: 10, label: "1 Kings 10:17" } },
  { id: "shekel", name: "Shekel", kind: "weight", inBase: SHEKEL, ref: { book: "exodus", chapter: 30, label: "Exodus 30:13" } },
  { id: "bekah", name: "Bekah", kind: "weight", inBase: SHEKEL / 2, ref: { book: "exodus", chapter: 38, label: "Exodus 38:26" } },
  { id: "gerah", name: "Gerah", kind: "weight", inBase: SHEKEL / 20, ref: { book: "exodus", chapter: 30, label: "Exodus 30:13" } },
  // Dry volume: an ephah is 3 seahs, 10 omers, 18 kabs.
  { id: "ephah", name: "Ephah", kind: "dry", inBase: EPHAH, ref: { book: "ezekiel", chapter: 45, label: "Ezekiel 45:11" } },
  { id: "seah", name: "Seah", kind: "dry", inBase: EPHAH / 3, ref: { book: "genesis", chapter: 18, label: "Genesis 18:6" } },
  { id: "omer", name: "Omer", kind: "dry", inBase: EPHAH / 10, ref: { book: "exodus", chapter: 16, label: "Exodus 16:36" } },
  { id: "kab", name: "Kab", kind: "dry", inBase: EPHAH / 18, ref: { book: "2-kings", chapter: 6, label: "2 Kings 6:25" } },
  // Liquid volume: the bath equals the ephah; a bath is 6 hins, 72 logs.
  { id: "bath", name: "Bath", kind: "liquid", inBase: EPHAH, ref: { book: "ezekiel", chapter: 45, label: "Ezekiel 45:11" } },
  { id: "hin", name: "Hin", kind: "liquid", inBase: EPHAH / 6, ref: { book: "exodus", chapter: 29, label: "Exodus 29:40" } },
  { id: "log", name: "Log", kind: "liquid", inBase: EPHAH / 72, ref: { book: "leviticus", chapter: 14, label: "Leviticus 14:10" } },
];

/** The modern units each kind also answers in, exact definitions. */
export const MODERN_UNITS: MeasureUnit[] = [
  { id: "meter", name: "Meter", kind: "length", inBase: 1 },
  { id: "centimeter", name: "Centimeter", kind: "length", inBase: 0.01 },
  { id: "foot", name: "Foot", kind: "length", inBase: 0.3048 },
  { id: "inch", name: "Inch", kind: "length", inBase: 0.0254 },
  { id: "kilogram", name: "Kilogram", kind: "weight", inBase: 1000 },
  { id: "gram", name: "Gram", kind: "weight", inBase: 1 },
  { id: "pound", name: "Pound", kind: "weight", inBase: 453.59237 },
  { id: "ounce", name: "Ounce", kind: "weight", inBase: 28.349523125 },
  { id: "liter-dry", name: "Liter", kind: "dry", inBase: 1 },
  { id: "bushel", name: "US bushel", kind: "dry", inBase: 35.23907016688 },
  { id: "liter-liquid", name: "Liter", kind: "liquid", inBase: 1 },
  { id: "gallon", name: "US gallon", kind: "liquid", inBase: 3.785411784 },
  { id: "quart", name: "US quart", kind: "liquid", inBase: 0.946352946 },
];

const ALL_UNITS = [...BIBLICAL_UNITS, ...MODERN_UNITS];

export function measureUnit(id: string): MeasureUnit | undefined {
  return ALL_UNITS.find((u) => u.id === id);
}

/** The units of one kind, biblical first, modern behind them. */
export function unitsOfKind(kind: MeasureKind): MeasureUnit[] {
  return ALL_UNITS.filter((u) => u.kind === kind);
}

/** Converts between any two units of a kind through the kind's base. */
export function convertMeasure(value: number, from: MeasureUnit, to: MeasureUnit): number {
  return (value * from.inBase) / to.inBase;
}

/** A readable number: six significant digits at most, grouped. */
export function formatMeasure(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { maximumSignificantDigits: 6 });
}
