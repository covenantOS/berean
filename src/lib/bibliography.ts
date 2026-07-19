import { getRights, type RightsEntry } from "./rights";

/**
 * Bibliography styles — the citation-style formatter over the rights
 * registry (src/lib/rights.ts). The registry is the only metadata the
 * catalog genuinely carries: title, rights holder (the author or corporate
 * body where one is named), license, source URL, and retrieval date. What
 * the registry does not carry (publisher, publication year, place) is
 * omitted per each style's rules, never invented. Turabian's bibliography
 * form follows Chicago's, so the two share one rule. Pure over the entry
 * handed in, so the list pane re-runs it on style switches and a harness
 * can run it without a browser.
 */

export type BibStyle = "apa" | "mla" | "chicago" | "turabian";

export const BIB_STYLES: { key: BibStyle; label: string }[] = [
  { key: "apa", label: "APA" },
  { key: "mla", label: "MLA" },
  { key: "chicago", label: "Chicago" },
  { key: "turabian", label: "Turabian" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The author element the registry can honestly offer: the rights holder
 * when it names a person or corporate body. "Public domain" and "To be
 * selected" are rights statements, not authors, so they yield none and the
 * entry leads with its title, the way every style handles authorless works.
 */
function authorOf(entry: RightsEntry): string | null {
  const h = entry.rightsHolder;
  if (h.startsWith("Public domain") || h.startsWith("To be")) return null;
  return h;
}

/** The first URL in the source string; null when the source is not one. */
function urlOf(entry: RightsEntry): string | null {
  const m = /https?:\/\/[^\s]+/.exec(entry.source);
  return m ? m[0] : null;
}

/** The retrieval date parsed; null when the registry carries none. */
function retrievedOf(entry: RightsEntry): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.sourceRetrieved);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * One bibliography entry in the requested style. Every entry arranges the
 * same honest fields: author when named, title always, then the source as
 * an accessed online work, since the registry's provenance is a URL and a
 * retrieval date. Missing elements drop out per the style's rules.
 */
export function formatBibEntry(entry: RightsEntry, style: BibStyle): string {
  const author = authorOf(entry);
  const title = entry.title;
  const url = urlOf(entry);
  const retrieved = retrievedOf(entry);
  const accessed =
    retrieved && `${MONTHS[retrieved.month - 1]} ${retrieved.day}, ${retrieved.year}`;

  switch (style) {
    case "apa": {
      // APA 7, work without a date on a website: Author. (n.d.). Title.
      // Retrieved date and URL when known; the retrieval statement is APA's
      // own rule for content that changes.
      const lead = author ? `${author}. (n.d.). ${title}.` : `${title}. (n.d.).`;
      if (url && accessed) return `${lead} Retrieved ${accessed}, from ${url}`;
      if (url) return `${lead} ${url}`;
      return lead;
    }
    case "mla": {
      // MLA 9: Author. Title. URL. Accessed day-month-year; an authorless
      // work begins with its title.
      const parts: string[] = [];
      if (author) parts.push(`${author}.`);
      parts.push(`${title}.`);
      if (url) parts.push(`${url}.`);
      if (url && retrieved) {
        parts.push(`Accessed ${retrieved.day} ${MONTHS[retrieved.month - 1]} ${retrieved.year}.`);
      }
      return parts.join(" ");
    }
    case "chicago":
    case "turabian": {
      // Chicago 17 bibliography, website content; Turabian's bibliography
      // follows Chicago: Author. Title. Accessed date. URL.
      const parts: string[] = [];
      if (author) parts.push(`${author}.`);
      parts.push(`${title}.`);
      if (accessed) parts.push(`Accessed ${accessed}.`);
      if (url) parts.push(`${url}.`);
      return parts.join(" ");
    }
  }
}

/** Every item of a bibliography document, formatted in order; registry ids
 * that no longer resolve are dropped rather than cited blind. */
export function formatBibliography(resourceIds: string[], style: BibStyle): string {
  return resourceIds
    .map((id) => getRights(id))
    .filter((e): e is RightsEntry => e !== undefined)
    .map((e) => formatBibEntry(e, style))
    .join("\n\n");
}
