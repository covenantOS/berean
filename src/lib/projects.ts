"use client";

import type { ExegeticalBrief } from "./brief";

/**
 * Sermon/teaching study projects, stored on this device only (same
 * placeholder-persistence rationale as marginalia — see docs/adr/0001).
 */

export interface StudyProject {
  id: string;
  title: string;
  book: string; // canon slug
  chapter: number;
  notes: string;
  brief: ExegeticalBrief | null;
  visibility: "private";
  createdAt: string;
  updatedAt: string;
}

const KEY = "berean.projects.v1";

function read(): StudyProject[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as StudyProject[];
  } catch {
    return [];
  }
}

function write(projects: StudyProject[]) {
  window.localStorage.setItem(KEY, JSON.stringify(projects));
}

export function listProjects(): StudyProject[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): StudyProject | undefined {
  return read().find((p) => p.id === id);
}

export function createProject(title: string, book: string, chapter: number): StudyProject {
  const now = new Date().toISOString();
  const project: StudyProject = {
    id: crypto.randomUUID(),
    title,
    book,
    chapter,
    notes: "",
    brief: null,
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  };
  const projects = read();
  projects.push(project);
  write(projects);
  return project;
}

export function updateProject(id: string, patch: Partial<Pick<StudyProject, "notes" | "brief" | "title">>) {
  const projects = read();
  const p = projects.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, patch, { updatedAt: new Date().toISOString() });
  write(projects);
}

export function deleteProject(id: string) {
  write(read().filter((p) => p.id !== id));
}
