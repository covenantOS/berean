"use client";

import Link from "next/link";
import { useState } from "react";
import { useCollection } from "@/lib/hooks";
import { DOCUMENT_KINDS, DocumentKind, documents, wordCount } from "@/lib/documents";

export default function DeskPage() {
  const rows = useCollection(documents).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKind>("article");

  function add(e: React.FormEvent) {
    e.preventDefault();
    documents.create({ title: title.trim() || "Untitled manuscript", kind, body: "" });
    setTitle("");
  }

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

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing on the desk yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
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
