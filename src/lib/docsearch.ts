import type { ListDocument, StudyDocument } from "./documents";
import type { MarginNote } from "./marginalia";
import type { PrayerList, PrayerRequest } from "./prayers";
import { getRights } from "./rights";

/**
 * Docs Search — the user's own collections answered by a query. The
 * concordance searches the canon; this searches what the user has written
 * and gathered: marginalia (journal entries ride the same note collection),
 * Writing Desk manuscripts, passage and word lists, clippings (excerpt and
 * citation both answer), bibliographies (the cited work's registry title
 * and holder answer), and prayer requests. Matching is a plain case-folded
 * substring, honest at the scale of one device's localStorage; the precise
 * grammar in query.ts answers verse-shaped questions and does not compose
 * with prose. Pure over the rows handed in, so the pane re-runs it against
 * live collections and a harness can run it without a browser.
 */

/** Characters of context kept on each side of a match in a snippet. */
const CONTEXT = 60;

export type DocHit =
  | { kind: "note"; note: MarginNote; snippet: string }
  | { kind: "manuscript"; doc: StudyDocument; snippet: string }
  | { kind: "list"; doc: ListDocument; snippet: string }
  | { kind: "prayer"; list: PrayerList; request: PrayerRequest; snippet: string };

export interface DocResults {
  notes: Extract<DocHit, { kind: "note" }>[];
  manuscripts: Extract<DocHit, { kind: "manuscript" }>[];
  lists: Extract<DocHit, { kind: "list" }>[];
  prayers: Extract<DocHit, { kind: "prayer" }>[];
}

export function resultCount(r: DocResults): number {
  return r.notes.length + r.manuscripts.length + r.lists.length + r.prayers.length;
}

/**
 * The matched text with context around the first match; null when the
 * needle is absent. Case folds by lowercasing, the same fold the
 * concordance's substring path uses.
 */
function snippetOf(text: string, needle: string): string | null {
  const i = text.toLowerCase().indexOf(needle);
  if (i < 0) return null;
  const from = Math.max(0, i - CONTEXT);
  const to = Math.min(text.length, i + needle.length + CONTEXT);
  return `${from > 0 ? "…" : ""}${text.slice(from, to).trim()}${to < text.length ? "…" : ""}`;
}

/** The first field that answers, as a snippet; null when none does. */
function firstMatch(fields: (string | undefined)[], needle: string): string | null {
  for (const f of fields) {
    if (!f) continue;
    const s = snippetOf(f, needle);
    if (s !== null) return s;
  }
  return null;
}

export function searchDocs(
  q: string,
  collections: {
    notes: MarginNote[];
    documents: StudyDocument[];
    lists: ListDocument[];
    prayers: PrayerList[];
  }
): DocResults {
  const needle = q.trim().toLowerCase();
  const out: DocResults = { notes: [], manuscripts: [], lists: [], prayers: [] };
  if (needle.length < 2) return out;

  for (const note of collections.notes) {
    const snippet = snippetOf(note.text, needle);
    if (snippet !== null) out.notes.push({ kind: "note", note, snippet });
  }

  for (const doc of collections.documents) {
    const snippet = firstMatch([doc.body, doc.title, doc.topic, doc.series, doc.venue], needle);
    if (snippet !== null) out.manuscripts.push({ kind: "manuscript", doc, snippet });
  }

  for (const doc of collections.lists) {
    const fields: string[] = [doc.title];
    for (const item of doc.items) {
      if (item.note) fields.push(item.note);
      if ("lemma" in item) {
        if (item.lemma) fields.push(item.lemma);
        if (item.gloss) fields.push(item.gloss);
      }
      if ("citation" in item) {
        fields.push(item.text, item.citation);
      }
      if ("resourceId" in item) {
        /* A bibliography item answers by the work itself: its title and
         * the names the registry carries, so "Calvin" finds the cited
         * Commentaries. */
        const work = getRights(item.resourceId);
        if (work) fields.push(work.title, work.rightsHolder, work.license);
      }
    }
    const snippet = firstMatch(fields, needle);
    if (snippet !== null) out.lists.push({ kind: "list", doc, snippet });
  }

  for (const list of collections.prayers) {
    for (const request of list.requests) {
      const snippet = firstMatch(
        [request.title, request.details, request.category, ...request.tags, list.title],
        needle
      );
      if (snippet !== null) out.prayers.push({ kind: "prayer", list, request, snippet });
    }
  }

  return out;
}
