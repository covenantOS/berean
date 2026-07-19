/**
 * Strong's id helpers safe for the client. lexicon.ts's normalizeStrongs
 * does the same folding but sits in a module that reads the dictionaries
 * from disk, so the hover bus keeps its own twin here.
 */

/**
 * The base id a lemma match keys on: "g26", "G0026", and an extended id
 * like "H7225G" all fold to "G26"; null when the value is no Strong's id.
 */
export function baseStrongsId(id: string): string | null {
  const m = id.trim().toUpperCase().match(/^([GH])0*(\d+)[A-Z]?$/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** The base ids of a word's Strong's list, in order, invalid entries dropped. */
export function baseStrongsIds(ids: string[] | undefined): string[] {
  return (ids ?? [])
    .map((s) => baseStrongsId(s))
    .filter((s): s is string => s !== null);
}
