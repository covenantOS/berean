import type { ListDocument, StudyDocument } from "./documents";
import type { VerseHighlight } from "./highlights";
import type { MarginNote } from "./marginalia";
import type { PersonalBook } from "./personalbooks";
import type { PrayerList, PrayerRequest } from "./prayers";
import type { PrintBook } from "./printbooks";
import { getRights } from "./rights";

/**
 * Docs Search: the user's own collections answered by a query. The
 * concordance searches the canon; this searches what the user has written
 * and gathered: marginalia (journal entries ride the same note collection),
 * highlighted verses (the reference and the worn style's name answer; the
 * verse's text stays out, since it lives behind the bible routes and this
 * matcher runs synchronously), Writing Desk manuscripts, passage and word
 * lists, clippings (excerpt and citation both answer), bibliographies (the
 * cited work's registry title and holder answer), personal books (title,
 * author, and the imported body), print books (the physical shelf's
 * cataloguing: title, author, ISBN, shelf note, and notes), and prayer
 * requests.
 * Matching is a plain case-folded substring, honest at the scale of one
 * device's localStorage; the precise grammar in query.ts answers
 * verse-shaped questions and does not compose with prose. Pure over the
 * rows handed in, so the pane re-runs it against live collections and a
 * harness can run it without a browser.
 */

/** Characters of context kept on each side of a match in a snippet. */
const CONTEXT = 60;

/** A highlighted verse shaped for search: the panes resolve the reference
 * and the style's name, since both want book names from the canon table. */
export interface HighlightRow {
  highlight: VerseHighlight;
  reference: string;
  style: string;
}

export type DocHit =
  | { kind: "note"; note: MarginNote; snippet: string }
  | { kind: "highlight"; row: HighlightRow; snippet: string }
  | { kind: "manuscript"; doc: StudyDocument; snippet: string }
  | { kind: "list"; doc: ListDocument; snippet: string }
  | { kind: "personalbook"; book: PersonalBook; snippet: string }
  | { kind: "printbook"; book: PrintBook; snippet: string }
  | { kind: "prayer"; list: PrayerList; request: PrayerRequest; snippet: string };

export interface DocResults {
  notes: Extract<DocHit, { kind: "note" }>[];
  highlights: Extract<DocHit, { kind: "highlight" }>[];
  manuscripts: Extract<DocHit, { kind: "manuscript" }>[];
  lists: Extract<DocHit, { kind: "list" }>[];
  personalBooks: Extract<DocHit, { kind: "personalbook" }>[];
  printBooks: Extract<DocHit, { kind: "printbook" }>[];
  prayers: Extract<DocHit, { kind: "prayer" }>[];
}

export function resultCount(r: DocResults): number {
  return (
    r.notes.length +
    r.highlights.length +
    r.manuscripts.length +
    r.lists.length +
    r.personalBooks.length +
    r.printBooks.length +
    r.prayers.length
  );
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
    highlights: HighlightRow[];
    documents: StudyDocument[];
    lists: ListDocument[];
    personalBooks: PersonalBook[];
    printBooks: PrintBook[];
    prayers: PrayerList[];
  }
): DocResults {
  const needle = q.trim().toLowerCase();
  const out: DocResults = {
    notes: [],
    highlights: [],
    manuscripts: [],
    lists: [],
    personalBooks: [],
    printBooks: [],
    prayers: [],
  };
  if (needle.length < 2) return out;

  for (const note of collections.notes) {
    const snippet = snippetOf(note.text, needle);
    if (snippet !== null) out.notes.push({ kind: "note", note, snippet });
  }

  for (const row of collections.highlights) {
    const snippet = firstMatch([row.style, row.reference], needle);
    if (snippet !== null) out.highlights.push({ kind: "highlight", row, snippet });
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

  for (const book of collections.personalBooks) {
    /* A personal book answers by its title, its author, and its body: the
     * whole imported text indexes, the way a manuscript's does. */
    const snippet = firstMatch([book.title, book.author, book.body], needle);
    if (snippet !== null) out.personalBooks.push({ kind: "personalbook", book, snippet });
  }

  for (const book of collections.printBooks) {
    /* A print book answers by its cataloguing alone; no body exists on the
     * device to index, the copy being paper. */
    const snippet = firstMatch(
      [book.title, book.author, book.isbn, book.location, book.notes],
      needle
    );
    if (snippet !== null) out.printBooks.push({ kind: "printbook", book, snippet });
  }

  for (const list of collections.prayers) {    for (const request of list.requests) {
      const snippet = firstMatch(
        [request.title, request.details, request.category, ...request.tags, list.title],
        needle
      );
      if (snippet !== null) out.prayers.push({ kind: "prayer", list, request, snippet });
    }
  }

  return out;
}
