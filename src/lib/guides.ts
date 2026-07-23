"use client";

import { collection, type Record_ } from "./store";

/**
 * Custom guides: the reader's named compositions of the Passage Guide's
 * sections, the Logos custom-guide mechanic. A guide is a name and an
 * ordered list of section keys; running one opens the Passage Guide's
 * report on a chapter with the sections filtered and ordered to match.
 * The keys below mirror the sections the guide API composes
 * (src/app/api/pane/guide) and PassageGuide renders; a section the payload
 * leaves empty stays out of the report whether or not a guide asks for it.
 * The sync envelope rides along from day one as everywhere.
 */

export const GUIDE_SECTIONS = [
  { key: "commentary", title: "Commentaries" },
  { key: "crossRefs", title: "Cross References" },
  { key: "parallels", title: "Parallel Passages" },
  { key: "confessions", title: "Confessional Documents" },
  { key: "sermons", title: "Sermons" },
  { key: "people", title: "People" },
  { key: "places", title: "Places" },
  { key: "others", title: "Things" },
  { key: "topics", title: "Topics" },
  { key: "timeline", title: "Timeline" },
  { key: "notableWords", title: "Notable Words" },
  { key: "questions", title: "Questions to Ask" },
  { key: "compareVersions", title: "Compare Versions" },
  { key: "media", title: "Media" },
] as const;

export type GuideSectionKey = (typeof GUIDE_SECTIONS)[number]["key"];

export interface CustomGuide extends Record_ {
  name: string;
  /** Section keys in the guide's order; every key belongs to GUIDE_SECTIONS. */
  sections: GuideSectionKey[];
  /** The collection the Commentaries section answers from: a collection id,
   * null for the whole shelf, absent to follow the workspace's active
   * collection. */
  commentaryCollection?: string | null;
}

const guides = collection<CustomGuide>("berean.guides.v1");
export { guides };

/** The keys a stored or imported record names, deduped, in their given order. */
export function sanitizeSections(raw: unknown): GuideSectionKey[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set<string>(GUIDE_SECTIONS.map((s) => s.key));
  const out: GuideSectionKey[] = [];
  for (const key of raw) {
    if (typeof key === "string" && known.has(key) && !out.includes(key as GuideSectionKey)) {
      out.push(key as GuideSectionKey);
    }
  }
  return out;
}

/** Every section key, with the guide's own order first; the editor's rows. */
export function editorOrder(sections: GuideSectionKey[]): GuideSectionKey[] {
  const rest = GUIDE_SECTIONS.map((s) => s.key).filter((k) => !sections.includes(k));
  return [...sections, ...rest];
}

/** Saves a composition; null when the name or the section set is empty. */
export function saveGuide(
  id: string | null,
  name: string,
  sections: GuideSectionKey[],
  commentaryCollection?: string | null
): CustomGuide | null {
  const trimmed = name.trim().slice(0, 80);
  const clean = sanitizeSections(sections);
  if (!trimmed || clean.length === 0) return null;
  if (id) return guides.update(id, { name: trimmed, sections: clean, commentaryCollection }) ?? null;
  return guides.create({
    name: trimmed,
    sections: clean,
    ...(commentaryCollection !== undefined ? { commentaryCollection } : {}),
  });
}
