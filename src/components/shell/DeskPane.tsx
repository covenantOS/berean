"use client";

import { useState } from "react";
import { DOCUMENT_KINDS, DocumentKind, documents, wordCount } from "@/lib/documents";
import { useCollection } from "@/lib/hooks";
import { useWorkspace } from "./WorkspaceContext";

type SortKey = "updated" | "date" | "title";

/**
 * The Writing Desk pane: the manuscript list, moved from the retired /desk
 * page. Kinds and series filter, three sorts answer, and a new manuscript
 * opens straight into its own tab. Rows open the same way; delete stays on
 * the row. Everything reads and writes the documents collection, so the
 * rails and Docs Search follow every change.
 */
export default function DeskPane() {
  const { dispatch } = useWorkspace();
  const rows = useCollection(documents);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKind>("article");
  const [kindFilter, setKindFilter] = useState<"all" | DocumentKind>("all");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const doc = documents.create({ title: title.trim() || "Untitled manuscript", kind, body: "" });
    setTitle("");
    dispatch({ type: "openManuscript", docId: doc.id, title: doc.title });
  }

  const filtered = rows
    .filter((d) => kindFilter === "all" || d.kind === kindFilter)
    .filter((d) => seriesFilter === "all" || d.series === seriesFilter)
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      /* Appointed date: undated work sinks to the foot of the list. */
      if (sort === "date") return (b.date ?? "").localeCompare(a.date ?? "");
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const seriesOptions = [
    ...new Set(rows.map((d) => d.series).filter((s): s is string => Boolean(s))),
  ].sort();

  return (
    <div className="mx-auto max-w-4xl" data-print-root>
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">The Writing Desk</p>
        <h2 className="mt-0.5 font-editorial text-lg font-semibold">A manuscript room</h2>
        <p className="no-print mt-0.5 text-[0.68rem] text-muted">
          Scripture inserts as verified quotation, never from memory · footnotes behave like
          footnotes · the Scribe reads drafts as an honest critic and the words on the page remain
          yours · nothing leaves this device
        </p>
      </header>

      <form
        onSubmit={add}
        className="no-print mt-6 mb-8 grid gap-3 rounded-[4px] border border-rule bg-surface p-5 sm:grid-cols-[1fr_auto_auto]"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Manuscript title"
          aria-label="Manuscript title"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DocumentKind)}
          aria-label="Kind"
          className="rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          {DOCUMENT_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Open a manuscript
        </button>
      </form>

      <div className="no-print mb-6 flex flex-wrap gap-2">
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as "all" | DocumentKind)}
          aria-label="Filter by kind"
          className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm"
        >
          <option value="all">All kinds</option>
          {DOCUMENT_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}s
            </option>
          ))}
        </select>
        {seriesOptions.length > 0 && (
          <select
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
            aria-label="Filter by series"
            className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm"
          >
            <option value="all">Every series</option>
            {seriesOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort order"
          className="rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm"
        >
          <option value="updated">Last touched</option>
          <option value="date">Appointed date</option>
          <option value="title">Title</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">
          {rows.length === 0 ? "Nothing on the desk yet." : "Nothing matches that filter."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-surface p-4"
            >
              <div>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "openManuscript", docId: d.id, title: d.title })
                  }
                  title={`Open ${d.title || "Untitled"} for editing`}
                  className="font-editorial text-left text-lg font-bold text-ink hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {d.title}
                </button>
                <p className="small-caps text-xs text-muted">
                  {DOCUMENT_KINDS.find((k) => k.key === d.kind)?.label ?? d.kind} ·{" "}
                  {wordCount(d.body).toLocaleString()} words ·{" "}
                  {new Date(d.updatedAt).toLocaleDateString()}
                  {d.passage ? ` · ${d.passage}` : ""}
                  {d.series ? ` · ${d.series}` : ""}
                  {d.date ? ` · for ${d.date}` : ""}
                  {d.venue ? ` · ${d.venue}` : ""}
                </p>
              </div>
              <button
                onClick={() => documents.remove(d.id)}
                className="no-print rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
