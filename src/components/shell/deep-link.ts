import { BOOK_NAME_PATTERN, resolveBookName } from "@/lib/canon";
import { ENTITY_ID_PATTERN } from "./workspace-state";

/**
 * URL deep links for /workspace (the intake itself lives in
 * ./DeepLinkIntake.tsx).
 *
 * /read/[book]/[chapter] stays the app's citation scheme; these query params
 * are how an inbound link lands inside the workspace while /workspace remains
 * one stable URL.
 *
 *   ?ref=<passage>    A reference in the shared abbreviation grammar
 *                     (resolveBookName, src/lib/canon.ts): every form the
 *                     omnibox accepts ("jn 3", "john 3:16") plus the dotted
 *                     forms a URL favors ("jn.3", "1pet.2.9"). A bare chapter
 *                     opens or retargets a reader tab; a verse also selects,
 *                     raising the context strip. Unparseable or out-of-range
 *                     values are ignored.
 *   ?tab=<kind>:<payload>
 *                     Opens a tool tab, validated exactly the way the session
 *                     sanitizer validates that tab kind:
 *                       lexicon:H25              lexicon tab at a Strong's entry
 *                       wordstudy:G25            word study for a Strong's id
 *                       guide:jn.3               Passage Guide for a chapter
 *                       exegetical:jn.3          Exegetical Guide for a chapter
 *                       compare:jn.3             Text Comparison for a chapter
 *                       concordance:romans       a book's concordance
 *                       factbook:H0175           a TIPNR entity's Factbook
 *                       topicguide:naves:prayer  a Nave's or Torrey's entry
 *                     Unknown kinds and bad payloads are ignored, never fatal.
 *
 * Both params together: the reference lands first (openRef, then selectVerse
 * when a verse is present), then the tab opens in the same pane and takes the
 * focus, so the reader sits retargeted behind the tool.
 */

export interface DeepLinkRef {
  /** Canon slug, e.g. "john". */
  book: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
}

/** The ?ref= grammar: the omnibox's separators plus dots between the parts. */
const REF_PARAM_RE = new RegExp(
  `^(${BOOK_NAME_PATTERN})[.\\s]+(\\d{1,3})(?:[.:](\\d{1,3})(?:[-–](\\d{1,3}))?)?$`,
  "i"
);

/** Parses a ?ref= value; null when it does not read as one passage. */
export function parseDeepLinkRef(raw: string): DeepLinkRef | null {
  // "1pet" reads as "1 pet"; the numbered books abbreviate that way here.
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/^(\d)\s*/, "$1 ")
    .replace(/\s+/g, " ");
  const m = value.match(REF_PARAM_RE);
  if (!m) return null;
  const book = resolveBookName(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  const verse = m[3] ? Number(m[3]) : undefined;
  if (verse !== undefined && verse < 1) return null;
  const verseEnd = m[4] ? Number(m[4]) : undefined;
  return {
    book: book.slug,
    chapter,
    ...(verse !== undefined ? { verse } : {}),
    ...(verseEnd !== undefined ? { verseEnd } : {}),
  };
}

export type DeepLinkTab =
  | { kind: "lexicon"; entryId: string }
  | { kind: "wordstudy"; strongsId: string }
  | { kind: "guide"; book: string; chapter: number }
  | { kind: "exegetical"; book: string; chapter: number }
  | { kind: "compare"; book: string; chapter: number }
  | { kind: "concordance"; book: string }
  | { kind: "factbook"; entityId: string }
  | { kind: "topicguide"; work: "naves" | "torreys"; topicId: string };

/** The Strong's pattern the session sanitizer applies to lexicon and word study tabs. */
const STRONGS_PARAM_RE = /^[hg]\d{1,5}$/i;

/** Parses a ?tab= value; null for an unknown kind or a bad payload. */
export function parseDeepLinkTab(raw: string): DeepLinkTab | null {
  const i = raw.indexOf(":");
  if (i <= 0) return null;
  const kind = raw.slice(0, i).trim().toLowerCase();
  const payload = raw.slice(i + 1).trim();
  if (!payload) return null;
  switch (kind) {
    case "lexicon":
    case "wordstudy": {
      if (!STRONGS_PARAM_RE.test(payload)) return null;
      const id = payload.toUpperCase();
      return kind === "lexicon"
        ? { kind: "lexicon", entryId: id }
        : { kind: "wordstudy", strongsId: id };
    }
    case "factbook": {
      if (!ENTITY_ID_PATTERN.test(payload)) return null;
      return { kind: "factbook", entityId: payload };
    }
    case "topicguide": {
      const j = payload.indexOf(":");
      if (j <= 0) return null;
      const work = payload.slice(0, j).trim().toLowerCase();
      const topicId = payload.slice(j + 1).trim().toLowerCase();
      if (work !== "naves" && work !== "torreys") return null;
      if (!/^[a-z0-9-]+$/.test(topicId)) return null;
      return { kind: "topicguide", work, topicId };
    }
    case "guide":
    case "exegetical":
    case "compare": {
      const ref = parseDeepLinkRef(payload);
      if (!ref) return null;
      if (kind === "guide") return { kind: "guide", book: ref.book, chapter: ref.chapter };
      if (kind === "exegetical") {
        return { kind: "exegetical", book: ref.book, chapter: ref.chapter };
      }
      return { kind: "compare", book: ref.book, chapter: ref.chapter };
    }
    case "concordance": {
      const book = resolveBookName(payload.replace(/^(\d)\s*/, "$1 "));
      if (!book) return null;
      return { kind: "concordance", book: book.slug };
    }
    default:
      return null;
  }
}
