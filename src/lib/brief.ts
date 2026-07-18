/**
 * The Scribe's exegetical brief — shared types for the API route and UI.
 *
 * Every claim in a brief carries citations to specific verses, and each
 * citation's quotation is verified server-side against the actual text
 * before the brief is shown. A fabricated citation is the gravest possible
 * failure; unverified quotations are flagged, never silently displayed.
 */

export interface Citation {
  /** Canon slug, e.g. "john" */
  book: string;
  chapter: number;
  verse: number;
  /** Exact words quoted from the verse (KJV) */
  quote: string;
  /** Set server-side: does the quote actually appear in the cited verse? */
  verified?: boolean;
}

export interface BriefSection {
  heading: string;
  body: string;
  citations: Citation[];
}

export interface ExegeticalBrief {
  passage: { book: string; chapter: number };
  overview: string;
  sections: BriefSection[];
  generatedAt: string;
  model: string;
}
