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
