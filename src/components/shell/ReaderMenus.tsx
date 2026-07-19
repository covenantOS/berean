"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { listDocuments } from "@/lib/documents";
import { HIGHLIGHT_COLORS, setHighlight, type HighlightColor } from "@/lib/highlights";
import { takeUp } from "@/lib/memory";
import { notes as marginNotes, saveNote, type MarginNote } from "@/lib/marginalia";
import { useCollection } from "@/lib/hooks";
import { verseCardSvg } from "@/lib/verseCard";
import { removeVerseFromSet, visualFilters } from "@/lib/visualfilters";
import { useWorkspace } from "./WorkspaceContext";
import type { WordSelection } from "./workspace-state";

/**
 * The selection-first menus, the Logos mechanics rebuilt over what the
 * workspace already furnishes.
 *
 * VerseContextMenu and WordContextMenu answer a right-click in the reader:
 * dataset entities on the left (the verse's TIPNR people and places, or the
 * word's lemma, parsing, and Strong's ids), live actions on the right
 * (guides, word study, search, copy, note, highlight). SelectionMenu is the
 * hover toolbar a drag selection raises: copy, search, note, highlight, and
 * export card. Every row is backed by a shipped feature; nothing here is a
 * placeholder.
 *
 * All three are fixed-position overlays sharing one discipline: dismiss on
 * outside pointerdown, Escape, scroll, or resize, and never leave the
 * viewport.
 */

const FRAME =
  "fixed z-50 border border-rule bg-surface shadow-lg font-[family-name:var(--font-interface)]";
const ROW =
  "flex w-full items-center gap-2 px-3 py-1 text-left text-[0.72rem] text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";
const HEAD = "small-caps px-3 pb-1 text-[0.62rem] text-muted";

interface FloatingOptions {
  /** Place the menu above the anchor (the selection toolbar) instead of below. */
  above?: boolean;
  /** Re-measure when this content changes (a lazy fetch filling in). */
  deps?: unknown[];
}

/** Viewport clamping plus the shared dismiss discipline. */
function useFloatingMenu(x: number, y: number, onClose: () => void, opts: FloatingOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const { above = false, deps = [] } = opts;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = above ? y - r.height - 6 : y;
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(top, window.innerHeight - r.height - 8)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, above, ...deps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    };
    const onScroll = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [onClose]);

  return { ref, style: { left: pos.left, top: pos.top } };
}

/** The stained-glass tint row, the same swatches the context strip carries. */
function Swatches({ onPick }: { onPick: (color: HighlightColor) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      {HIGHLIGHT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={`Highlight ${c}`}
          onClick={() => onPick(c)}
          className="h-3.5 w-3.5 border border-rule focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          style={{ background: `var(--stained-${c})` }}
        />
      ))}
    </span>
  );
}

/**
 * Inline note capture, the menus' answer to the context strip's editor: a
 * small textarea that writes a marginalia record anchored to the verse. An
 * existing note loads for editing; saving updates it in place.
 */
function NoteEditor({
  book,
  chapter,
  verse,
  existing,
  onDone,
}: {
  book: string;
  chapter: number;
  verse: number;
  existing?: MarginNote;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(existing?.text ?? "");

  const save = () => {
    if (!draft.trim()) return;
    saveNote({ id: existing?.id, book, chapter, verse, text: draft.trim() });
    onDone();
  };

  return (
    <div className="px-3 pt-1 pb-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        autoFocus
        placeholder="A note in the margin…"
        className="w-full border border-rule bg-paper p-2 text-xs leading-relaxed text-ink focus:outline focus:outline-2 focus:outline-sapphire"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!draft.trim()}
          className="border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Save note
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-2 py-1 text-[0.72rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface Mention {
  id: string;
  name: string;
  kind: "person" | "place" | "other";
  type: string;
  brief: string;
}

/**
 * Right-click on a verse: the verse's tagged people and places on the left,
 * the chapter's guides plus copy, note, and highlight on the right.
 */
export function VerseContextMenu({
  x,
  y,
  paneId,
  book,
  chapter,
  verse,
  bookName,
  text,
  hasOriginal,
  onClose,
}: {
  x: number;
  y: number;
  paneId: string;
  book: string;
  chapter: number;
  verse: number;
  bookName: string;
  text: string;
  hasOriginal: boolean;
  onClose: () => void;
}) {
  const { dispatch } = useWorkspace();
  const [mentions, setMentions] = useState<Mention[] | null>(null);
  /** True once "Add to passage list" opens its chooser inside the menu. */
  const [pickingList, setPickingList] = useState(false);
  /** True once "Note" swaps the menu for inline capture. */
  const [writingNote, setWritingNote] = useState(false);
  const passageLists = useCollection(listDocuments, (d) => d.kind === "passage-list");
  const verseNotes = useCollection(
    marginNotes,
    (n) => n.book === book && n.chapter === chapter && n.verse === verse
  );
  /** The visual filter sets marking this verse; each offers a removal row. */
  const verseSets = useCollection(visualFilters, (s) =>
    s.items.some((it) => it.book === book && it.chapter === chapter && it.verse === verse)
  );
  const { ref, style } = useFloatingMenu(x, y, onClose, {
    deps: [mentions, pickingList, writingNote, verseSets],
  });
  const reference = `${bookName} ${chapter}:${verse}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/pane/entities?book=${book}&chapter=${chapter}&verse=${verse}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { mentions: Mention[] };
        setMentions(data.mentions);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setMentions([]);
      });
    return () => controller.abort();
  }, [book, chapter, verse]);

  const copy = () => {
    navigator.clipboard
      ?.writeText(`${text} (${reference})`)
      .catch(() => {});
    onClose();
  };

  /* The verse's stable reader URL, the app's analog of citing an exact spot. */
  const copyLink = () => {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/read/${book}/${chapter}#v${verse}`)
      .catch(() => {});
    onClose();
  };

  /** Appends the verse to an existing list, or starts a new one around it. */
  const addToPassageList = (docId: string | null) => {
    if (docId) {
      const doc = listDocuments.get(docId);
      const dupe = doc?.items.some(
        (it) => "book" in it && it.book === book && it.chapter === chapter && it.verse === verse
      );
      if (doc && !dupe) {
        listDocuments.update(docId, { items: [...doc.items, { book, chapter, verse }] });
      }
    } else {
      listDocuments.create({
        title: `Passages from ${bookName}`,
        kind: "passage-list",
        items: [{ book, chapter, verse }],
      });
    }
    onClose();
  };

  if (writingNote) {
    return (
      <div
        ref={ref}
        role="menu"
        aria-label={`${reference} note`}
        style={style}
        className={`${FRAME} w-72 py-1`}
      >
        <p className={HEAD}>{reference}</p>
        <NoteEditor
          book={book}
          chapter={chapter}
          verse={verse}
          existing={verseNotes[0]}
          onDone={onClose}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`${reference} actions`}
      style={style}
      className={`${FRAME} flex min-w-72`}
    >
      <div className="min-w-0 flex-1 border-r border-rule py-1">
        <p className={HEAD}>{reference}</p>
        {mentions === null ? (
          <p className="px-3 py-1 text-[0.72rem] text-muted">Reading the verse…</p>
        ) : mentions.length === 0 ? (
          <p className="px-3 py-1 text-[0.72rem] text-muted">
            No people or places tagged in this verse.
          </p>
        ) : (
          mentions.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.brief || m.type}
              onClick={() => {
                dispatch({ type: "openFactbook", entityId: m.id, title: m.name, paneId });
                onClose();
              }}
              className="flex w-full items-baseline gap-2 px-3 py-1 text-left text-[0.72rem] text-sapphire hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              <span className="truncate">{m.name}</span>
              <span className="ml-auto pl-3 text-[0.62rem] text-muted">
                {m.kind === "other" ? m.type : m.kind}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="w-36 shrink-0 py-1">
        <p className={HEAD}>Actions</p>
        <button
          type="button"
          className={ROW}
          onClick={() => {
            dispatch({ type: "openGuide", book, chapter, paneId });
            onClose();
          }}
        >
          Passage guide
        </button>
        {hasOriginal && (
          <button
            type="button"
            className={ROW}
            onClick={() => {
              dispatch({ type: "openExegetical", book, chapter, paneId });
              onClose();
            }}
          >
            Exegetical guide
          </button>
        )}
        <button type="button" className={ROW} onClick={copy}>
          Copy verse
        </button>
        <button type="button" className={ROW} onClick={copyLink}>
          Copy link
        </button>
        <button type="button" className={ROW} onClick={() => setWritingNote(true)}>
          Note{verseNotes.length > 0 ? ` (${verseNotes.length})` : ""}
        </button>
        <button
          type="button"
          title="Take this verse up into memory work"
          className={ROW}
          onClick={() => {
            takeUp(book, chapter, verse, verse);
            onClose();
          }}
        >
          Memorize
        </button>
        {pickingList ? (
          <div className="mt-1 border-t border-rule pt-1">
            <p className={HEAD}>Add to passage list</p>
            {passageLists.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={ROW}
                onClick={() => addToPassageList(doc.id)}
              >
                {doc.title || "Untitled list"}
                <span className="ml-auto pl-3 text-[0.62rem] text-muted">{doc.items.length}</span>
              </button>
            ))}
            <button type="button" className={ROW} onClick={() => addToPassageList(null)}>
              New passage list
            </button>
          </div>
        ) : (
          <button type="button" className={ROW} onClick={() => setPickingList(true)}>
            Add to passage list
          </button>
        )}
        <div className="mt-1 flex items-center gap-1.5 border-t border-rule px-3 pt-1.5">
          <Swatches
            onPick={(color) => {
              setHighlight(book, chapter, verse, color);
              onClose();
            }}
          />
        </div>
        {verseSets.length > 0 && (
          <div className="mt-1 border-t border-rule pt-1">
            {verseSets.map((s) => (
              <button
                key={s.id}
                type="button"
                title={`Remove this verse's mark from ${s.name}; the set stays`}
                className={ROW}
                onClick={() => {
                  removeVerseFromSet(s.id, book, chapter, verse);
                  onClose();
                }}
              >
                Remove from {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Right-click on a tagged word: the word's lexical card on the left (lemma,
 * parsing, gloss, and its Strong's ids, each opening the lexicon), word
 * study and concordance search on the right. The search row appears only
 * for English surface text; the concordance answers English queries.
 */
export function WordContextMenu({
  x,
  y,
  paneId,
  bookName,
  word,
  onClose,
}: {
  x: number;
  y: number;
  paneId: string;
  bookName: string;
  word: WordSelection;
  onClose: () => void;
}) {
  const { dispatch } = useWorkspace();
  const { ref, style } = useFloatingMenu(x, y, onClose);
  const first = word.strongs[0];
  const reference = `${bookName} ${word.chapter}:${word.verse}`;

  const info = (
    [
      ["Lemma", word.lemma],
      ["Parsing", word.morph],
      ["Gloss", word.gloss],
    ] as [string, string | undefined][]
  ).filter((row): row is [string, string] => !!row[1]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`${word.text} actions`}
      style={style}
      className={`${FRAME} flex min-w-64`}
    >
      <div className="min-w-0 flex-1 border-r border-rule py-1">
        <p className={HEAD}>
          <span className={word.lemma ? (first?.startsWith("H") ? "lang-hebrew" : "lang-greek") : ""}>
            {word.text}
          </span>
          <span className="ml-2 normal-case">{reference}</span>
        </p>
        {info.map(([label, value]) => (
          <p key={label} className="px-3 py-0.5 text-[0.72rem] text-muted">
            <span className="font-semibold text-ink">{label}:</span> {value}
          </p>
        ))}
        {word.strongs.map((id) => (
          <button
            key={id}
            type="button"
            title={`Open the lexicon at ${id}`}
            className={`${ROW} text-sapphire`}
            onClick={() => {
              dispatch({ type: "openLexicon", id: id.toUpperCase() });
              onClose();
            }}
          >
            {id}
            {word.xlit && <span className="text-muted">{word.xlit}</span>}
          </button>
        ))}
      </div>
      <div className="w-40 shrink-0 py-1">
        <p className={HEAD}>Actions</p>
        {first && (
          <button
            type="button"
            className={ROW}
            onClick={() => {
              dispatch({ type: "openWordStudy", strongsId: first, paneId });
              onClose();
            }}
          >
            Word study {first}
          </button>
        )}
        {!word.lemma && (
          <button
            type="button"
            className={ROW}
            onClick={() => {
              dispatch({ type: "openSearch", q: word.text, paneId });
              onClose();
            }}
          >
            Search “{word.text}”
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The hover toolbar a drag selection raises, placed above the selection.
 * Copy, concordance search, note, the four tints, and the verse card; the
 * anchor verse supplies the reference, and the note anchors there too:
 * marginalia keys on the verse, not the character range. Translate stays
 * out: nothing backs it yet.
 */
export function SelectionMenu({
  x,
  y,
  paneId,
  book,
  chapter,
  verse,
  bookName,
  abbrev,
  text,
  onClose,
}: {
  x: number;
  y: number;
  paneId: string;
  book: string;
  chapter: number;
  verse: number;
  bookName: string;
  abbrev: string;
  text: string;
  onClose: () => void;
}) {
  const { dispatch } = useWorkspace();
  /** True once "Note" swaps the toolbar for inline capture. */
  const [writingNote, setWritingNote] = useState(false);
  const { ref, style } = useFloatingMenu(x, y, onClose, { above: true, deps: [writingNote] });
  const reference = `${bookName} ${chapter}:${verse}`;

  const copy = () => {
    navigator.clipboard
      ?.writeText(`${text} (${reference})`)
      .catch(() => {});
    onClose();
  };

  /** Print/export aid: the selection as a letterpress card, downloaded as SVG. */
  const exportCard = () => {
    const svg = verseCardSvg(text, reference, abbrev);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book}-${chapter}-${verse}-card.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onClose();
  };

  const TOOL =
    "px-1.5 py-0.5 text-[0.72rem] text-ink hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

  /* The editor drops the toolbar's mousedown guard: the textarea takes
   * focus, and the native selection may collapse; the anchor verse was
   * captured when the toolbar rose. */
  if (writingNote) {
    return (
      <div
        ref={ref}
        role="menu"
        aria-label="Selection note"
        style={style}
        className={`${FRAME} w-72 py-1`}
      >
        <p className={HEAD}>{reference}</p>
        <NoteEditor book={book} chapter={chapter} verse={verse} onDone={onClose} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Selection actions"
      style={style}
      // A press on the toolbar keeps the text selection it answers.
      onMouseDown={(e) => e.preventDefault()}
      className={`${FRAME} flex items-center gap-1 px-2 py-1`}
    >
      <button type="button" className={TOOL} onClick={copy}>
        Copy
      </button>
      <button type="button" className={TOOL} onClick={() => setWritingNote(true)}>
        Note
      </button>
      <button
        type="button"
        className={TOOL}
        onClick={() => {
          dispatch({ type: "openSearch", q: text, paneId });
          onClose();
        }}
      >
        Search
      </button>
      <button type="button" className={TOOL} onClick={exportCard}>
        Export card
      </button>
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-rule" />
      <Swatches
        onPick={(color) => {
          setHighlight(book, chapter, verse, color);
          onClose();
        }}
      />
    </div>
  );
}
