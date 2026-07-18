#!/usr/bin/env node
/**
 * Aggregate the STEPBible brief lexicons (TBESH for Hebrew, TBESG for Greek)
 * into the per-entry Strong's dictionaries read by src/lib/lexicon.ts.
 *
 * Sources: data/_sources/stepbible/TBESH.txt and TBESG.txt (see
 * PROVENANCE.md; CC BY 4.0, Tyndale House Cambridge / STEPBible.org).
 * Header lines are documentation, not data; only rows beginning with an
 * extended Strong's number (H0001-style) are parsed.
 *
 * Output: the existing data/lexicon/strongs-hebrew.json and
 * strongs-greek.json gain a `tyndale` array on each base entry (existing
 * Strong's fields are left untouched). Each array item is one extended
 * (disambiguated) Strong's variant of the base number: its extended id,
 * the relation it bears to its unified number, the unified id, lemma,
 * transliteration, part-of-speech tag, Tyndale gloss, and the brief
 * definition with source markup flattened to plain text. Base entries that
 * exist in TBESH/TBESG but not in Strong's dictionaries are created with
 * the Tyndale data alone. Attribution is recorded in data/lexicon/_meta.json.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "_sources", "stepbible");
const OUT_DIR = path.join(ROOT, "data", "lexicon");

const ATTRIBUTION =
  "Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). https://github.com/STEPBible/STEPBible-Data";

// eStrong is 4 digits (optionally with a lowercase suffix, H0122a) or a
// 5-digit Greek extra (G20001 and up) for words beyond Strong's set.
const ROW_RE = /^([GH])(\d{4,5})[a-z]?\t/;

/** Flatten the source's light HTML markup to readable plain text. */
function cleanDefinition(raw) {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<ref='[^']*'>/g, "")
    .replace(/<\/ref>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseLexicon(file) {
  const text = fs.readFileSync(path.join(SRC_DIR, file), "utf8");
  // base id (H7225) -> variants[]
  const bases = new Map();
  let rows = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ROW_RE);
    if (!m) continue;
    const cols = line.split("\t");
    if (cols.length < 8) continue;
    rows++;
    const dStrongCol = cols[1].trim();
    // "H7225G = a Meaning of" -> id H7225G, relation "a Meaning of"
    const id = dStrongCol.split(/\s/)[0];
    const relMatch = dStrongCol.match(/=\s*(.+)$/);
    const bm = id.match(/^([GH]\d+)/);
    if (!bm) continue;
    const base = bm[1];
    const variant = {
      id,
      u: cols[2].trim(),
      lemma: cols[3].trim(),
      xlit: cols[4].trim(),
      pos: cols[5].trim(),
      gloss: cols[6].trim(),
      def: cleanDefinition(cols.slice(7).join("\t")),
    };
    if (relMatch && relMatch[1].trim()) variant.rel = relMatch[1].trim();
    if (!bases.has(base)) bases.set(base, []);
    bases.get(base).push(variant);
  }
  return { bases, rows };
}

function mergeIntoDict(dictFile, bases) {
  const file = path.join(OUT_DIR, dictFile);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  let enriched = 0;
  let created = 0;
  for (const [base, variants] of bases) {
    // A Strong's number is stored unpadded (H7225); TBESH pads to 4 digits.
    const key = base.replace(/^([GH])0+(\d+)$/, "$1$2");
    variants.sort((a, z) => a.id.localeCompare(z.id));
    if (!dict[key]) {
      dict[key] = {};
      created++;
    } else {
      enriched++;
    }
    dict[key].tyndale = variants;
  }
  fs.writeFileSync(file, JSON.stringify(dict));
  return { enriched, created };
}

const hebrew = parseLexicon("TBESH.txt");
const greek = parseLexicon("TBESG.txt");

const h = mergeIntoDict("strongs-hebrew.json", hebrew.bases);
const g = mergeIntoDict("strongs-greek.json", greek.bases);

fs.writeFileSync(
  path.join(OUT_DIR, "_meta.json"),
  JSON.stringify(
    {
      id: "lexicon",
      title: "Strong's dictionaries aggregated with TBESH/TBESG",
      attribution: ATTRIBUTION,
      retrieved: "2026-07-18",
      builtBy: "scripts/build-lexicons.mjs",
    },
    null,
    2
  ) + "\n"
);

console.log(
  `tbesh: ${hebrew.rows} rows -> ${hebrew.bases.size} base entries (${h.enriched} merged with Strong's, ${h.created} Tyndale-only)`
);
console.log(
  `tbesg: ${greek.rows} rows -> ${greek.bases.size} base entries (${g.enriched} merged with Strong's, ${g.created} Tyndale-only)`
);
