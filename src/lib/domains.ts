import { promises as fs } from "fs";
import path from "path";

/**
 * The semantic-domain sense tables behind the Word Study guide's Semantic
 * Domains section: for each base Strong's id, the lemma's attested senses
 * with their domain assignments from the UBS dictionaries (CC BY-SA 4.0,
 * United Bible Societies; built by scripts/build-domains.mjs, rights id
 * `ubs-dictionaries`).
 *
 * The Greek table comes from the UBS Dictionary of the Greek New Testament,
 * adapted from Louw & Nida's Greek-English Lexicon Based on Semantic
 * Domains: each sense carries the Louw-Nida entry code ("33.98"), the domain
 * and subdomain names, and the dictionary's short definition. The Hebrew
 * table comes from the UBS Dictionary of Biblical Hebrew: the SDBH domain
 * hierarchy is its own taxonomy, not Louw-Nida, and the surface says so.
 */

export interface GreekDomainSense {
  /** Louw-Nida entry code, e.g. "33.98". */
  entry: string;
  /** Top-level domain name, e.g. "Communication". */
  domain: string;
  /** Subdomain name, e.g. "Speak, Talk". */
  subdomain: string;
  /** The dictionary's short definition of the sense. */
  sense: string;
  /** The dictionary's glosses, comma-joined. */
  glosses: string;
  /** Scripture references the source lists for the sense (attestation count). */
  refs: number;
}

export interface HebrewDomainSense {
  /** SDBH hierarchical domain code, e.g. "001001001". */
  code: string;
  /** Domain name, e.g. "Deities". */
  domain: string;
  /** The dictionary's short definition of the sense. */
  sense: string;
  /** The dictionary's glosses, comma-joined. */
  glosses: string;
  /** Scripture references the source lists for the sense (attestation count). */
  refs: number;
}

type GreekTable = Record<string, GreekDomainSense[]>;
type HebrewTable = Record<string, HebrewDomainSense[]>;

const caches = new Map<string, Promise<Record<string, unknown[]> | null>>();

async function loadTable(file: string): Promise<Record<string, unknown[]> | null> {
  let cache = caches.get(file);
  if (!cache) {
    // The in-flight promise is cached: concurrent lookups share the one read.
    cache = (async () => {
      try {
        const target = path.join(process.cwd(), "data", "domains", file);
        return JSON.parse(await fs.readFile(target, "utf8")) as Record<string, unknown[]>;
      } catch {
        return null;
      }
    })();
    caches.set(file, cache);
  }
  return cache;
}

/**
 * Louw-Nida domain senses for a Greek Strong's id (base form, "G3056").
 * Null when the table is missing; an empty list when the lemma is not
 * covered by the dictionary.
 */
export async function getGreekDomains(greekId: string): Promise<GreekDomainSense[] | null> {
  const table = (await loadTable("greek.json")) as GreekTable | null;
  if (!table) return null;
  return table[greekId] ?? [];
}

/**
 * SDBH domain senses for a Hebrew Strong's id (base form, "H430"; the
 * Aramaic vocabulary interleaved in Strong's Hebrew sequence is included).
 * Null when the table is missing; an empty list when the lemma is not
 * covered by the dictionary.
 */
export async function getHebrewDomains(hebrewId: string): Promise<HebrewDomainSense[] | null> {
  const table = (await loadTable("hebrew.json")) as HebrewTable | null;
  if (!table) return null;
  return table[hebrewId] ?? [];
}

/* --------------------- domain resolution for search --------------------- */

export interface DomainResolution {
  /** Padded base Strong's ids ("G3056", "H0430") carrying a matched sense. */
  ids: Set<string>;
  /** Display label: the term resolved against the dictionary's names. */
  label: string;
  /** ids.size, for the surfaces' "N lemmas answer" line. */
  lemmas: number;
  lang: "greek" | "hebrew" | "both";
}

/** "G25" -> "G0025": the padded form the morph engine's tokens carry. */
function padId(id: string): string {
  const m = /^([GH])0*(\d+)$/.exec(id);
  return m ? `${m[1]}${m[2].padStart(4, "0")}` : id;
}

/**
 * Resolve a domain query to the lemmas its dictionaries assign to the
 * domain. A dotted number is an exact Louw-Nida entry ("33.98"); a bare
 * number is a Louw-Nida domain prefix on the Greek side ("33" for 33.x)
 * and an SDBH code prefix on the Hebrew side; anything else resolves
 * against the domain and subdomain names, exact first, then prefix when
 * the term has three or more letters. Null when nothing answers, so the
 * search can say so instead of guessing.
 */
export async function resolveDomain(term: string): Promise<DomainResolution | null> {
  const q = term.trim();
  if (!q) return null;
  const greek = (await loadTable("greek.json")) as GreekTable | null;
  const hebrew = (await loadTable("hebrew.json")) as HebrewTable | null;

  const ids = new Set<string>();
  const names = new Set<string>();
  const subs = new Set<string>();
  let greekHit = false;
  let hebrewHit = false;

  const codeMatch = /^(\d+)(\.\d+)?$/.exec(q);
  if (codeMatch) {
    const [, whole, dotted] = codeMatch;
    if (greek) {
      for (const [id, senses] of Object.entries(greek)) {
        for (const s of senses) {
          const hit = dotted ? s.entry === q : s.entry.startsWith(`${whole}.`);
          if (!hit) continue;
          greekHit = true;
          ids.add(padId(id));
          if (s.domain) names.add(s.domain);
        }
      }
    }
    // SDBH codes are undotted hierarchies; a dotted Louw-Nida entry has no
    // Hebrew reading, so only the bare-number form reaches this side.
    if (!dotted && hebrew) {
      for (const [id, senses] of Object.entries(hebrew)) {
        for (const s of senses) {
          if (!s.code.startsWith(whole)) continue;
          hebrewHit = true;
          ids.add(padId(id));
          if (s.domain) names.add(s.domain);
        }
      }
    }
  } else {
    const fold = q.toLowerCase();
    const tryNames = (prefix: boolean) => {
      if (greek) {
        for (const [id, senses] of Object.entries(greek)) {
          for (const s of senses) {
            const domain = s.domain.toLowerCase();
            const subdomain = s.subdomain.toLowerCase();
            const domainHit = prefix ? domain.startsWith(fold) : domain === fold;
            const subHit = prefix ? subdomain.startsWith(fold) : subdomain === fold;
            if (!domainHit && !subHit) continue;
            greekHit = true;
            ids.add(padId(id));
            if (s.domain) names.add(s.domain);
            if (subHit && !domainHit && s.subdomain) subs.add(s.subdomain);
          }
        }
      }
      if (hebrew) {
        for (const [id, senses] of Object.entries(hebrew)) {
          for (const s of senses) {
            const domain = s.domain.toLowerCase();
            const hit = prefix ? domain.startsWith(fold) : domain === fold;
            if (!hit) continue;
            hebrewHit = true;
            ids.add(padId(id));
            if (s.domain) names.add(s.domain);
          }
        }
      }
    };
    tryNames(false);
    if (ids.size === 0 && fold.length >= 3) tryNames(true);
  }

  if (ids.size === 0) return null;
  const label = [...(codeMatch ? [q] : []), ...names, ...subs].join(" · ");
  const lang = greekHit && hebrewHit ? "both" : greekHit ? "greek" : "hebrew";
  return { ids, label, lemmas: ids.size, lang };
}
