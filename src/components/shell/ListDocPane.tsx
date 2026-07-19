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
import { copyReferences } from "@/lib/powerLookup";
import { buildWordFind, puzzleWords, type WordFind } from "@/lib/puzzle";
import PrintButton from "./PrintButton";
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
  /** Quiet confirmation for the copy action; clears itself. */
  const [copied, setCopied] = useState(false);
  /** The generated puzzle, when the word list stands as a Word Find. */
  const [puzzle, setPuzzle] = useState<WordFind | null>(null);
  /** True when a puzzle build found too few qualifying words. */
  const [puzzleFailed, setPuzzleFailed] = useState(false);

  if (!doc) {
    return <p className="text-xs text-muted">This list is no longer on this device.</p>;
  }

  const save = (items: ListItem[]) => listDocuments.update(docId, { items });

  /* Power Lookup copy: every passage in the list, expanded to its KJV text
   * in one clipboard write, ready to paste into a manuscript. */
  const copyAllTexts = () => {
    const refs = doc.items
      .filter((it): it is PassageItem => "book" in it)
      .map((it) => ({ book: it.book, chapter: it.chapter, from: it.verse }));
    void copyReferences(refs).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  /* The Word Find: glosses and transliterations become grid words; a list
   * with too few qualifying words says so instead of printing a stub. */
  const makePuzzle = () => {
    const entries = doc.items
      .filter((it): it is WordItem => !("book" in it))
      .map((it) => it.gloss ?? it.xlit ?? "")
      .filter(Boolean);
    const next = buildWordFind(puzzleWords(entries));
    setPuzzle(next);
    setPuzzleFailed(next === null);
  };

  if (puzzle) {
    return (
      <PuzzleView
        title={doc.title}
        puzzle={puzzle}
        onRegenerate={makePuzzle}
        onClose={() => setPuzzle(null)}
      />
    );
  }

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
          {doc.kind === "passage-list" && doc.items.length > 0 && (
            <button
              type="button"
              title="Copy the KJV text of every passage in this list"
              onClick={copyAllTexts}
              className="no-print ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {copied ? "Copied" : "Copy all texts"}
            </button>
          )}
          {doc.kind === "word-list" && doc.items.length > 0 && (
            <button
              type="button"
              title="Build a printable Word Find from this list"
              onClick={makePuzzle}
              className="no-print ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Puzzle
            </button>
          )}
          {puzzleFailed && (
            <span className="ml-3 text-xs text-muted">
              The list needs at least two glosses or transliterations of three letters or more.
            </span>
          )}
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


/**
 * A word list rendered as a printable Word Find: the letter grid, the
 * words to seek beneath it, and the print action the report panes share.
 * Regenerating re-seats the words; nothing about the puzzle is stored.
 */
function PuzzleView({
  title,
  puzzle,
  onRegenerate,
  onClose,
}: {
  title: string;
  puzzle: WordFind;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const sought = puzzle.placed.map((p) => p.word).sort();
  return (
    <div className="mx-auto max-w-prose" data-print-root>
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Word Find</p>
        <h2 className="mt-0.5 font-editorial text-xl font-semibold">{title}</h2>
        <p className="no-print mt-0.5 text-[0.68rem] text-muted">
          {sought.length} words hidden in the grid
          <PrintButton className="ml-3" />
          <button
            type="button"
            onClick={onRegenerate}
            className="ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            New puzzle
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Back to the list
          </button>
        </p>
      </header>
      <table
        aria-label="Word Find grid"
        className="mt-4 border-collapse font-mono text-[0.72rem] leading-none"
      >
        <tbody>
          {puzzle.grid.map((row, r) => (
            <tr key={r}>
              {row.split("").map((letter, c) => (
                <td
                  key={c}
                  className="h-5 w-5 border border-rule/60 text-center align-middle"
                >
                  {letter}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small-caps mt-4 mb-1 text-[0.62rem] font-semibold text-muted">
        Words to find
      </p>
      <p className="text-[0.8rem] leading-relaxed">{sought.join(" · ")}</p>
      {puzzle.omitted.length > 0 && (
        <p className="no-print mt-2 text-[0.68rem] text-muted">
          Left off this grid: {puzzle.omitted.join(", ")}. A new puzzle may seat them.
        </p>
      )}
    </div>
  );
}
