"use client";

import { useState } from "react";
import { getBook } from "@/lib/canon";
import {
  listDocuments,
  listKindLabel,
  type ListItem,
  type PassageItem,
  type WordItem,
} from "@/lib/documents";
import { useRecord } from "@/lib/hooks";
import { useWorkspace } from "./WorkspaceContext";

/**
 * A list document in a pane: the saved set a search or guide handed off.
 * Passage rows open their reference in the reader; word rows open the word
 * study for their Strong's id. Items reorder by one step, carry an optional
 * note, and remove individually; every edit writes straight to the
 * collection, so the rail and any other open tab of the same list follow.
 */
export default function ListDocPane({ docId }: { docId: string }) {
  const doc = useRecord(listDocuments, docId);

  if (!doc) {
    return <p className="text-xs text-muted">This list is no longer on this device.</p>;
  }

  const save = (items: ListItem[]) => listDocuments.update(docId, { items });

  /** Moves the item at index one step; out-of-range targets change nothing. */
  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= doc.items.length) return;
    const items = [...doc.items];
    [items[index], items[next]] = [items[next], items[index]];
    save(items);
  };

  const remove = (index: number) => save(doc.items.filter((_, i) => i !== index));

  const setNote = (index: number, note: string) => {
    const trimmed = note.trim();
    save(
      doc.items.map((item, i) =>
        i === index ? { ...item, ...(trimmed ? { note: trimmed } : { note: undefined }) } : item
      )
    );
  };

  return (
    <div className="mx-auto max-w-prose">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">{listKindLabel(doc.kind)}</p>
        <h2 className="mt-0.5 font-editorial text-xl font-semibold">{doc.title}</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {doc.items.length} {doc.items.length === 1 ? "item" : "items"}
        </p>
      </header>
      {doc.items.length === 0 ? (
        <p className="py-6 text-xs text-muted">
          The list is empty. A search pane or a verse's context menu adds to it.
        </p>
      ) : (
        <ul className="divide-y divide-rule/60">
          {doc.items.map((item, i) => (
            <li key={i} className="flex items-start gap-1 py-1.5">
              <span className="min-w-0 flex-1">
                {doc.kind === "passage-list" ? (
                  <PassageRow item={item as PassageItem} />
                ) : (
                  <WordRow item={item as WordItem} />
                )}
                <NoteLine note={item.note} onSave={(note) => setNote(i, note)} />
              </span>
              <span className="flex shrink-0 items-center text-[0.7rem] text-muted">
                <RowButton
                  label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  glyph="↑"
                />
                <RowButton
                  label="Move down"
                  disabled={i === doc.items.length - 1}
                  onClick={() => move(i, 1)}
                  glyph="↓"
                />
                <RowButton label="Remove from the list" onClick={() => remove(i)} glyph="×" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RowButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="px-1 leading-none hover:text-ink disabled:opacity-30 disabled:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
    >
      {glyph}
    </button>
  );
}

function PassageRow({ item }: { item: PassageItem }) {
  const { dispatch } = useWorkspace();
  const name = getBook(item.book)?.name ?? item.book;
  return (
    <button
      type="button"
      title={`Open ${name} ${item.chapter}:${item.verse}`}
      onClick={() => dispatch({ type: "openRef", book: item.book, chapter: item.chapter })}
      className="small-caps text-[0.8rem] font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
    >
      {name} {item.chapter}:{item.verse}
    </button>
  );
}

function WordRow({ item }: { item: WordItem }) {
  const { dispatch } = useWorkspace();
  const langClass = item.strongs.startsWith("H") ? "lang-hebrew" : "lang-greek";
  return (
    <button
      type="button"
      title={`Open the word study for ${item.strongs}`}
      onClick={() => dispatch({ type: "openWordStudy", strongsId: item.strongs })}
      className="flex w-full items-baseline gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
    >
      <span className={`${langClass} text-[0.9rem]`}>{item.lemma ?? item.strongs}</span>
      {item.xlit && <span className="text-[0.72rem] italic text-muted">{item.xlit}</span>}
      {item.gloss && (
        <span className="min-w-0 flex-1 truncate text-[0.72rem] text-muted">{item.gloss}</span>
      )}
      <span className="shrink-0 text-[0.68rem] font-semibold text-sapphire">{item.strongs}</span>
    </button>
  );
}

/** The item's note: quiet when present, an input when asked for. */
function NoteLine({ note, onSave }: { note?: string; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");

  if (!editing) {
    return (
      <span className="block">
        {note && <span className="block text-[0.72rem] text-muted">{note}</span>}
        <button
          type="button"
          onClick={() => {
            setDraft(note ?? "");
            setEditing(true);
          }}
          className="text-[0.62rem] text-muted hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {note ? "Edit note" : "Add note"}
        </button>
      </span>
    );
  }

  const commit = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <input
      autoFocus
      value={draft}
      aria-label="Item note"
      placeholder="A note on this item"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="mt-0.5 block w-full border border-rule bg-paper px-2 py-1 text-[0.72rem] focus:outline focus:outline-2 focus:outline-sapphire"
    />
  );
}
