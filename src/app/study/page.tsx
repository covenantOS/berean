"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import { StudyProject, createProject, deleteProject, listProjects } from "@/lib/projects";

export default function StudyPage() {
  const [projects, setProjects] = useState<StudyProject[]>([]);
  const [title, setTitle] = useState("");
  const [book, setBook] = useState("john");
  const [chapter, setChapter] = useState(1);
  const selectedBook = getBook(book);

  useEffect(() => {
    setProjects(listProjects());
  }, []);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const b = getBook(book);
    if (!b) return;
    const name = title.trim() || `${b.name} ${chapter}`;
    createProject(name, book, chapter);
    setProjects(listProjects());
    setTitle("");
  }

  function remove(id: string) {
    deleteProject(id);
    setProjects(listProjects());
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Study Projects</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        A study project binds your work on an appointed passage: the text, your
        notes, and the Scribe&apos;s cited exegetical brief. Projects are
        private and stored only on this device.
      </p>

      <form
        onSubmit={add}
        className="mb-10 grid gap-3 rounded-[4px] border border-rule bg-surface p-5 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title (optional)"
          aria-label="Project title"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <select
          value={book}
          onChange={(e) => {
            setBook(e.target.value);
            setChapter(1);
          }}
          aria-label="Book"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          {CANON.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={chapter}
          onChange={(e) => setChapter(Number(e.target.value))}
          aria-label="Chapter"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          {Array.from({ length: selectedBook?.chapters ?? 1 }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Appoint the text
        </button>
      </form>

      {projects.length === 0 ? (
        <p className="text-sm text-muted">
          No projects yet. Appoint a passage above to begin — the project holds
          your notes and the Scribe&apos;s brief for that chapter.
        </p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const b = getBook(p.book);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-surface p-4"
              >
                <div>
                  <Link
                    href={`/study/${p.id}`}
                    className="font-editorial text-lg font-bold text-ink no-underline hover:text-sapphire"
                  >
                    {p.title}
                  </Link>
                  <p className="small-caps text-xs text-muted">
                    {b?.name} {p.chapter}
                    {p.brief ? " · brief prepared" : ""}
                    {p.notes ? " · notes" : ""}
                  </p>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
