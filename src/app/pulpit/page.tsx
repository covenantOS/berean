"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CANON, getBook } from "@/lib/canon";
import {
  StudyProject,
  createProject,
  deleteProject,
  listProjects,
  searchArchive,
} from "@/lib/projects";
import { projects as projectsCollection } from "@/lib/projects";

export default function PulpitPage() {
  const [rows, setRows] = useState<StudyProject[]>([]);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [series, setSeries] = useState("");
  const [date, setDate] = useState("");
  const [book, setBook] = useState("john");
  const [chapter, setChapter] = useState(1);
  const selectedBook = getBook(book);

  useEffect(() => {
    const load = () =>
      setRows(query.trim() ? searchArchive(query).filter((p) => p.kind !== "study") : listProjects("sermon"));
    load();
    return projectsCollection.subscribe(load);
  }, [query]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const b = getBook(book);
    if (!b) return;
    createProject(title.trim() || `${b.name} ${chapter}`, book, chapter, "sermon", {
      series: series.trim() || undefined,
      appointedFor: date || undefined,
    });
    setTitle("");
    setSeries("");
    setDate("");
  }

  const preparing = rows.filter((p) => p.status === "preparing");
  const finished = rows.filter((p) => p.status !== "preparing");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">The Pulpit</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        Sermon preparation as a craftsman&apos;s pipeline: appoint the text, receive the
        Scribe&apos;s cited brief, then carry your own labor from exegesis to delivery.
        Every completed sermon enters the archive, searchable for life.
      </p>

      <form
        onSubmit={add}
        className="mb-10 grid gap-3 rounded-[4px] border border-rule bg-surface p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sermon title (optional)"
          aria-label="Sermon title"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <input
          value={series}
          onChange={(e) => setSeries(e.target.value)}
          placeholder="Series (optional)"
          aria-label="Series"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Appointed date"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
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

      <div className="mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the archive — titles, series, notes, manuscripts…"
          aria-label="Search the sermon archive"
          className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
      </div>

      {preparing.length > 0 && (
        <section className="mb-8">
          <h2 className="small-caps mb-2 text-sm text-muted">In preparation</h2>
          <SermonList rows={preparing} onDelete={deleteProject} />
        </section>
      )}
      <section>
        <h2 className="small-caps mb-2 text-sm text-muted">The archive</h2>
        {finished.length === 0 ? (
          <p className="text-sm text-muted">
            {rows.length === 0
              ? "No sermons yet. Appoint a text above; the Scribe will have the study prepared before you sit down."
              : "Nothing delivered yet — sermons appear here when you mark them delivered."}
          </p>
        ) : (
          <SermonList rows={finished} onDelete={deleteProject} />
        )}
      </section>
    </div>
  );
}

function SermonList({ rows, onDelete }: { rows: StudyProject[]; onDelete: (id: string) => void }) {
  return (
    <ul className="space-y-3">
      {rows.map((p) => {
        const b = getBook(p.book);
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-surface p-4"
          >
            <div>
              <Link
                href={`/pulpit/${p.id}`}
                className="font-editorial text-lg font-bold text-ink no-underline hover:text-sapphire"
              >
                {p.title}
              </Link>
              <p className="small-caps text-xs text-muted">
                {b?.name} {p.chapter}
                {p.series ? ` · ${p.series}` : ""}
                {p.appointedFor ? ` · ${p.appointedFor}` : ""}
                {p.brief ? " · brief prepared" : ""}
                {p.stages?.manuscript ? " · manuscript" : ""}
                {p.status === "delivered" ? " · delivered" : ""}
              </p>
            </div>
            <button
              onClick={() => onDelete(p.id)}
              className="rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
            >
              Delete
            </button>
          </li>
        );
      })}
    </ul>
  );
}
