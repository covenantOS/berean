"use client";

import type { ExegeticalBrief } from "./brief";
import { collection, type Record_ } from "./store";

/**
 * Study and sermon projects — one project model shared by the Reading Desk,
 * the Library, and the Pulpit. A sermon is a study project carried through
 * the Pulpit's pipeline stages; nothing is duplicated between rooms.
 */

export const PIPELINE_STAGES = [
  { key: "exegesis", label: "Exegetical notes" },
  { key: "argument", label: "Argument of the sermon" },
  { key: "outline", label: "Outline" },
  { key: "manuscript", label: "Manuscript" },
  { key: "delivery", label: "Delivery notes" },
] as const;

export type StageKey = (typeof PIPELINE_STAGES)[number]["key"];

export type ProjectKind = "study" | "sermon" | "lesson";
export type ProjectStatus = "preparing" | "delivered" | "archived";

export interface StudyProject extends Record_ {
  title: string;
  kind: ProjectKind;
  book: string; // canon slug
  chapter: number;
  /** Free study notes (the Reading Desk's contribution). */
  notes: string;
  /** The Scribe's cited brief, if requested. */
  brief: ExegeticalBrief | null;
  /** The Pulpit pipeline; each stage is the preacher's own text. */
  stages: Partial<Record<StageKey, string>>;
  series?: string;
  /** ISO date the sermon is appointed for (binds to the Almanac). */
  appointedFor?: string;
  status: ProjectStatus;
}

const projects = collection<StudyProject>("berean.projects.v1");
export { projects };

/** Older records (pre-Pulpit) lack kind/stages/status; normalize on read. */
export function normalize(p: StudyProject): StudyProject {
  return {
    ...p,
    kind: p.kind ?? "study",
    stages: p.stages ?? {},
    status: p.status ?? "preparing",
  };
}

export function listProjects(kind?: ProjectKind): StudyProject[] {
  return projects
    .list()
    .map(normalize)
    .filter((p) => !kind || p.kind === kind)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): StudyProject | undefined {
  const p = projects.get(id);
  return p ? normalize(p) : undefined;
}

export function createProject(
  title: string,
  book: string,
  chapter: number,
  kind: ProjectKind = "study",
  extra?: Partial<Pick<StudyProject, "series" | "appointedFor">>
): StudyProject {
  return projects.create({
    title,
    kind,
    book,
    chapter,
    notes: "",
    brief: null,
    stages: {},
    status: "preparing",
    ...extra,
  });
}

export function updateProject(
  id: string,
  patch: Partial<
    Pick<StudyProject, "notes" | "brief" | "title" | "stages" | "series" | "appointedFor" | "status" | "kind">
  >
) {
  projects.update(id, patch);
}

export function updateStage(id: string, stage: StageKey, text: string) {
  const p = getProject(id);
  if (!p) return;
  projects.update(id, { stages: { ...p.stages, [stage]: text } });
}

export function deleteProject(id: string) {
  projects.remove(id);
}

/** Lifetime archive search: every completed handling of the Word, searchable. */
export function searchArchive(query: string): StudyProject[] {
  const q = query.trim().toLowerCase();
  return listProjects().filter((p) => {
    if (q.length === 0) return true;
    const haystack = [p.title, p.series ?? "", p.notes, ...Object.values(p.stages ?? {})]
      .join("\n")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Past projects on the same chapter — "you handled this text four years ago." */
export function priorHandlings(book: string, chapter: number, excludeId?: string): StudyProject[] {
  return listProjects().filter((p) => p.book === book && p.chapter === chapter && p.id !== excludeId);
}
