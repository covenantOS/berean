import { getBook } from "./canon";

/**
 * The Sermon Starter's ranking rules, kept pure so the route composes with
 * them and a harness can prove them. No dataset reads here: the route hands
 * in the pooled cross-references and the themes' key verses, and these
 * functions dedupe and rank them.
 */

/** A candidate related text, from either source. */
export interface KeyPassageCandidate {
  slug: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  /** Treasury of Scripture Knowledge votes; a theme citation carries none. */
  votes: number;
}

/** A ranked key passage with its provenance. */
export interface KeyPassage {
  ref: string;
  slug: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  /** Treasury votes, 0 throughout the shipped build. */
  votes: number;
  /** How many of the chapter's verses cite this text. */
  senders: number;
  /** A preaching theme's entry also cites this text. */
  topicCited: boolean;
}

/**
 * Key Passages: the chapter's pooled cross-references and the themes' key
 * verses, deduplicated and ranked. The shipped cross-reference build emits
 * no Treasury vote counts (scripts/build-crossrefs.mjs writes votes as 0),
 * so the operative signal is the sender count: how many of the chapter's
 * verses point at the text. The ranking rule, stated in the pane's hint:
 * the texts the most verses of the chapter cite come first, a theme
 * citation breaks a tie, first sighting settles the rest. Refs inside the
 * guide's own chapter drop out; the preacher already has that text. A
 * passage both sources cite counts once, gaining the theme mark; duplicate
 * cross-reference targets add their senders and keep their widest range.
 */
export function rankKeyPassages(
  crossRefs: KeyPassageCandidate[],
  themeRefs: Omit<KeyPassageCandidate, "votes">[],
  self: { slug: string; chapter: number },
  limit = 14
): KeyPassage[] {
  interface Row extends KeyPassageCandidate {
    /** How many of the chapter's verses cite this text. */
    senders: number;
    topicCited: boolean;
    /** First sighting across both sources, the final tiebreak. */
    order: number;
  }
  const byKey = new Map<string, Row>();
  let order = 0;
  const keyOf = (r: { slug: string; chapter: number; verse: number }) =>
    `${r.slug}:${r.chapter}:${r.verse}`;
  const isSelf = (r: { slug: string; chapter: number }) =>
    r.slug === self.slug && r.chapter === self.chapter;

  for (const r of crossRefs) {
    if (isSelf(r)) continue;
    const key = keyOf(r);
    const row = byKey.get(key);
    if (row) {
      row.senders += 1;
      row.votes = Math.max(row.votes, r.votes);
      if (r.endVerse !== undefined) {
        row.endVerse = Math.max(row.endVerse ?? r.endVerse, r.endVerse);
      }
      continue;
    }
    byKey.set(key, { ...r, senders: 1, topicCited: false, order: order++ });
  }
  for (const r of themeRefs) {
    if (isSelf(r)) continue;
    const key = keyOf(r);
    const row = byKey.get(key);
    if (row) {
      row.topicCited = true;
      if (r.endVerse !== undefined) {
        row.endVerse = Math.max(row.endVerse ?? r.endVerse, r.endVerse);
      }
      continue;
    }
    byKey.set(key, { ...r, votes: 0, senders: 0, topicCited: true, order: order++ });
  }

  return [...byKey.values()]
    .sort((a, b) => {
      if (a.senders !== b.senders) return b.senders - a.senders;
      if (a.votes !== b.votes) return b.votes - a.votes;
      if (a.topicCited !== b.topicCited) return a.topicCited ? -1 : 1;
      return a.order - b.order;
    })
    .slice(0, limit)
    .map((r) => ({
      ref: formatKeyPassage(r),
      slug: r.slug,
      chapter: r.chapter,
      verse: r.verse,
      ...(r.endVerse !== undefined && r.endVerse !== r.verse ? { endVerse: r.endVerse } : {}),
      votes: r.votes,
      senders: r.senders,
      topicCited: r.topicCited,
    }));
}

/** Display form of a key passage: "Romans 8:28", "Romans 8:28–30". */
function formatKeyPassage(r: { slug: string; chapter: number; verse: number; endVerse?: number }) {
  const name = getBook(r.slug)?.name ?? r.slug;
  const start = `${r.chapter}:${r.verse}`;
  return `${name} ${r.endVerse !== undefined && r.endVerse !== r.verse ? `${start}–${r.endVerse}` : start}`;
}

/**
 * The chapter's key verse, for the verse card handoff: the verse sending
 * the most cross-references, with ties broken toward the verse the themes
 * cite more, then the earlier verse. The shipped build carries no Treasury
 * vote counts, so the send count is the honest signal. A chapter with no
 * cross-references falls to the theme counts alone; an unfurnished chapter
 * opens at verse 1.
 */
export function pickKeyVerse(pooled: { sourceVerse: number }[], themeVerses: number[]): number {
  const tally = new Map<number, { sends: number; themes: number }>();
  for (const r of pooled) {
    const row = tally.get(r.sourceVerse) ?? { sends: 0, themes: 0 };
    row.sends += 1;
    tally.set(r.sourceVerse, row);
  }
  for (const v of themeVerses) {
    const row = tally.get(v) ?? { sends: 0, themes: 0 };
    row.themes += 1;
    tally.set(v, row);
  }
  const best = [...tally.entries()].sort(
    (a, b) => b[1].sends - a[1].sends || b[1].themes - a[1].themes || a[0] - b[0]
  )[0];
  return best ? best[0] : 1;
}
