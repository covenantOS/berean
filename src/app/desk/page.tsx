"use client";

import Link from "next/link";
import { useState } from "react";
import { useCollection } from "@/lib/hooks";
import { DOCUMENT_KINDS, DocumentKind, documents, wordCount } from "@/lib/documents";

type SortKey = "updated" | "date" | "title";

export default function DeskPage() {
  const rows = useCollection(documents);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKind>("article");
  const [kindFilter, setKindFilter] = useState<"all" | DocumentKind>("all");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");

  function add(e: React.FormEvent) {
    e.preventDefault();
    documents.create({ title: title.trim() || "Untitled manuscript", kind, body: "" });
    setTitle("");
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
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">The Writing Desk</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        A manuscript room for theological work. Scripture inserts as verified quotation, never from
        memory; footnotes behave like footnotes; finished work exports cleanly. The Scribe reads
        drafts as an honest critic — the words on the page remain yours.
      </p>

      <form
        onSubmit={add}
        className="mb-10 grid gap-3 rounded-[4px] border border-rule bg-surface p-5 sm:grid-cols-[1fr_auto_auto]"
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

      <div className="mb-6 flex flex-wrap gap-2">
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
                <Link
                  href={`/desk/${d.id}`}
                  className="font-editorial text-lg font-bold text-ink no-underline hover:text-sapphire"
                >
                  {d.title}
                </Link>
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
                className="rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
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
