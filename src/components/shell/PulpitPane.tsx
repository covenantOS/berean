"use client";

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
import { useWorkspaceDispatch } from "./WorkspaceContext";

type KindFilter = "all" | "sermon" | "study";

/**
 * The Pulpit pane: the project list, moved from the retired /pulpit and
 * /study pages. One record model serves both rooms (src/lib/projects.ts), so
 * one list carries sermons and studies with a kind filter between them, the
 * desk's filter pattern. The archive search covers every completed handling
 * of the Word; a new project appoints its text and opens straight into its
 * own tab, and rows open the same way. Delete stays on the row.
 */
export default function PulpitPane() {
  const { dispatch } = useWorkspaceDispatch();
  const [rows, setRows] = useState<StudyProject[]>([]);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"sermon" | "study">("sermon");
  const [series, setSeries] = useState("");
  const [date, setDate] = useState("");
  const [book, setBook] = useState("john");
  const [chapter, setChapter] = useState(1);
  const selectedBook = getBook(book);

  useEffect(() => {
    const load = () =>
      setRows(
        (query.trim() ? searchArchive(query) : listProjects()).filter(
          (p) => kindFilter === "all" || p.kind === kindFilter
        )
      );
    load();
    return projectsCollection.subscribe(load);
  }, [query, kindFilter]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const b = getBook(book);
    if (!b) return;
    const p = createProject(title.trim() || `${b.name} ${chapter}`, book, chapter, kind, {
      series: series.trim() || undefined,
      appointedFor: date || undefined,
    });
    setTitle("");
    setSeries("");
    setDate("");
    dispatch({ type: "openProject", projectId: p.id, title: p.title });
  }

  const preparing = rows.filter((p) => p.status === "preparing");
  const finished = rows.filter((p) => p.status !== "preparing");

  return (
    <div className="mx-auto max-w-4xl">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">The Pulpit</p>
        <h2 className="mt-0.5 font-editorial text-lg font-semibold">
          Sermon preparation as a craftsman&apos;s pipeline
        </h2>
        <p className="no-print mt-0.5 text-[0.68rem] text-muted">
          Appoint the text, receive the Scribe&apos;s cited brief, then carry your own labor from
          exegesis to delivery · every completed sermon enters the archive, searchable for life ·
          nothing leaves this device
        </p>
      </header>

      <form
        onSubmit={add}
        className="glass no-print mt-6 mb-8 grid gap-3 rounded-[4px] p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "sermon" | "study")}
          aria-label="Kind"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          <option value="sermon">Sermon</option>
          <option value="study">Study</option>
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          aria-label="Project title"
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
          className="fx-press rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Appoint the text
        </button>
        <button
          type="button"
          title={`Open the Sermon Starter for ${selectedBook?.name ?? book} ${chapter}`}
          onClick={() => dispatch({ type: "openSermonStarter", book, chapter })}
          className="fx-press rounded-[4px] border border-rule bg-paper px-4 py-2 text-sm text-ink hover:border-sapphire"
        >
          Sermon starter
        </button>
      </form>

      <div className="no-print mb-6 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the archive — titles, series, notes, manuscripts…"
          aria-label="Search the project archive"
          className="min-w-0 flex-1 rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as KindFilter)}
          aria-label="Filter by kind"
          className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm"
        >
          <option value="all">All work</option>
          <option value="sermon">Sermons</option>
          <option value="study">Studies</option>
        </select>
      </div>

      {preparing.length > 0 && (
        <section className="mb-8">
          <h3 className="small-caps mb-2 text-sm text-muted">In preparation</h3>
          <ProjectList rows={preparing} />
        </section>
      )}
      <section>
        <h3 className="small-caps mb-2 text-sm text-muted">The archive</h3>
        {finished.length === 0 ? (
          <p className="text-sm text-muted">
            {rows.length === 0
              ? "No projects yet. Appoint a text above; the Scribe will have the study prepared before you sit down."
              : "Nothing delivered yet — sermons appear here when you mark them delivered."}
          </p>
        ) : (
          <ProjectList rows={finished} />
        )}
      </section>
    </div>
  );
}

function ProjectList({ rows }: { rows: StudyProject[] }) {
  const { dispatch } = useWorkspaceDispatch();
  return (
    <ul className="fx-stagger space-y-3">
      {rows.map((p, i) => {
        const b = getBook(p.book);
        return (
          <li
            key={p.id}
            style={{ "--i": Math.min(i, 10) } as React.CSSProperties}
            className="glass glass-hover flex items-center justify-between gap-3 rounded-[4px] p-4"
          >
            <div>
              <button
                type="button"
                onClick={() => dispatch({ type: "openProject", projectId: p.id, title: p.title })}
                title={`Open ${p.title}`}
                className="font-editorial text-left text-lg font-bold text-ink hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {p.title}
              </button>
              <p className="small-caps text-xs text-muted">
                {p.kind === "study" ? "study · " : ""}
                {b?.name} {p.chapter}
                {p.series ? ` · ${p.series}` : ""}
                {p.appointedFor ? ` · ${p.appointedFor}` : ""}
                {p.brief ? " · brief prepared" : ""}
                {p.stages?.manuscript ? " · manuscript" : ""}
                {p.status === "delivered" ? " · delivered" : ""}
              </p>
            </div>
            <button
              onClick={() => deleteProject(p.id)}
              className="fx-press no-print rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
            >
              Delete
            </button>
          </li>
        );
      })}
    </ul>
  );
}
