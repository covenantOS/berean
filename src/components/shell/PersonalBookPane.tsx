"use client";

import { useMemo, useState } from "react";
import { useRecord } from "@/lib/hooks";
import { personalbooks } from "@/lib/personalbooks";
import { scanRefs } from "@/lib/refscan";
import { renderMarkdown } from "./markdown";

/**
 * A personal book open for reading: the imported text in the reading idiom,
 * quiet chrome and a prose measure, with the references the scanner finds
 * (src/lib/refscan.ts) rendered as working links that carry the pane in
 * focus to the passage. The body stores verbatim and links at render time,
 * so a replacement or a fix to the scanner changes the links and never the
 * words. Edit replaces the title, author, or body; delete removes the book
 * and the open tab degrades the way a deleted manuscript does.
 */
export default function PersonalBookPane({ bookId }: { bookId: string }) {
  const book = useRecord(personalbooks, bookId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");

  /* The linked-reference count in the chrome answers the honest question:
   * how much of this book the reader can travel from. */
  const refCount = useMemo(() => (book ? scanRefs(book.body).length : 0), [book]);

  if (!book) {
    return <p className="text-xs text-muted">This book is no longer on this device.</p>;
  }

  const startEdit = () => {
    setTitle(book.title);
    setAuthor(book.author ?? "");
    setBody(book.body);
    setEditing(true);
  };

  const save = () => {
    personalbooks.update(book.id, {
      title: title.trim() || "Untitled book",
      author: author.trim() || undefined,
      body,
      importedAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Book title"
            spellCheck={false}
            className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author"
            aria-label="Book author"
            spellCheck={false}
            className="w-48 border border-rule bg-paper px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Book text"
          spellCheck={false}
          className="h-[60vh] w-full resize-none border border-rule bg-paper px-3 py-2 font-mono text-xs leading-relaxed text-ink focus:border-sapphire focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            className="border border-rule bg-paper px-3 py-1.5 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Cancel
          </button>
          <p className="text-[0.68rem] text-muted">
            References link again over the new text the moment you save.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose py-4">
      <header className="mb-8 border-b border-rule pb-4">
        <p className="small-caps text-xs font-semibold text-amber">Personal book</p>
        <h2 className="font-editorial mt-0.5 text-xl font-semibold">{book.title}</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {book.author ? `${book.author} · ` : ""}imported{" "}
          {new Date(book.importedAt).toLocaleDateString()} ·{" "}
          {refCount.toLocaleString()} linked {refCount === 1 ? "reference" : "references"}
        </p>
        <div className="no-print mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={startEdit}
            className="border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => personalbooks.remove(book.id)}
            title="Delete this book from the device"
            className="border border-rule bg-paper px-2 py-1 text-xs text-ruby hover:border-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Delete
          </button>
        </div>
      </header>
      <div className="font-reader leading-relaxed">{renderMarkdown(book.body, { linkRefs: true })}</div>
    </div>
  );
}
