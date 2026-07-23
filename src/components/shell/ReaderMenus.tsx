"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { copyPassage } from "@/lib/copystyles";
import { listDocuments } from "@/lib/documents";
import { addFavorite, listFolders } from "@/lib/favorites";
import { guides } from "@/lib/guides";
import {
  highlightStyles,
  listStyles,
  setHighlight,
  styleSwatch,
} from "@/lib/highlights";
import { takeUp } from "@/lib/memory";
import { notes as marginNotes, saveNote, type MarginNote } from "@/lib/marginalia";
import { pronounceLemma, useSpeechAvailable } from "@/lib/pronounce";
import { playSound } from "@/lib/sound";
import { useCollection } from "@/lib/hooks";
import { verseCardSvg } from "@/lib/verseCard";
import { removeVerseFromSet, visualFilters } from "@/lib/visualfilters";
import ClippingsPicker from "./ClippingsPicker";
import NotebookPicker from "./NotebookPicker";
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
 * hover toolbar a drag selection raises: copy, search, note, highlight, the
 * export card, and print of the selection alone. Every row is backed by a
 * shipped feature; nothing here is a placeholder.
 *
 * All three are fixed-position overlays sharing one discipline: dismiss on
 * outside pointerdown, Escape, scroll, or resize, and never leave the
 * viewport.
 */

const FRAME =
  "fixed z-50 glass fx-scale shadow-lg font-[family-name:var(--font-interface)]";
const ROW =
  "fx-press flex w-full items-center gap-2 px-3 py-1 text-left text-[0.72rem] text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";
const HEAD = "small-caps px-3 pb-1 text-[0.62rem] text-muted";

/** A row names its entrance order in the menu's cascade (globals .fx-stagger). */
const rowI = (i: number) => ({ "--i": i }) as CSSProperties;

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

  /* Arrival chimes once per mounting; dismissal chimes ride the gestures. */
  useEffect(() => {
    playSound("open");
  }, []);

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
    const dismiss = () => {
      playSound("close");
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) dismiss();
    };
    const onScroll = () => dismiss();
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

  /* The menu grows from the corner it answers: the click point, or the
   * selection beneath the toolbar. */
  return {
    ref,
    style: {
      left: pos.left,
      top: pos.top,
      "--fx-origin": above ? "50% 100%" : "0 0",
    } as CSSProperties,
  };
}

/**
 * The style palette: the built-in tints plus the user's custom styles, the
 * same swatches the context strip carries. A swatch previews its style's
 * effect; a bold style shows its color as a bold letter.
 */
export function StylePalette({
  activeId,
  onPick,
}: {
  activeId?: string;
  onPick: (styleId: string) => void;
}) {
  const customs = useCollection(highlightStyles);
  return (
    <span className="flex items-center gap-1.5">
      {listStyles(customs).map((s) => (
        <button
          key={s.id}
          type="button"
          title={`Highlight ${s.name}`}
          aria-pressed={activeId === s.id}
          onClick={() => onPick(s.id)}
          className={`fx-press flex h-3.5 w-3.5 items-center justify-center border text-[0.62rem] font-bold leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
            activeId === s.id ? "border-ink" : "border-rule"
          }`}
          style={styleSwatch(s) as CSSProperties}
        >
          {s.effect === "bold" ? "A" : ""}
        </button>
      ))}
    </span>
  );
}

/**
 * Inline note capture, the menus' answer to the context strip's editor: a
 * small textarea that writes a marginalia record anchored to the verse. An
 * existing note loads for editing, notebook and all; saving updates it in
 * place.
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
  const [notebook, setNotebook] = useState(existing?.notebook ?? "");

  const save = () => {
    if (!draft.trim()) return;
    saveNote({ id: existing?.id, book, chapter, verse, text: draft.trim(), notebook });
    playSound("complete");
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
          className="fx-press border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Save note
        </button>
        <NotebookPicker value={notebook} onChange={setNotebook} />
        <button
          type="button"
          onClick={() => {
            playSound("close");
            onDone();
          }}
          className="fx-press px-2 py-1 text-[0.72rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
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
  /** True once "Clip verse" opens its clippings chooser inside the menu. */
  const [pickingClips, setPickingClips] = useState(false);
  /** True once "Custom guide" opens its chooser inside the menu. */
  const [pickingGuide, setPickingGuide] = useState(false);
  /** True once "Bookmark" opens its folder chooser inside the menu. */
  const [pickingFolder, setPickingFolder] = useState(false);
  /** True once the chooser's "New folder" row swaps for its name input. */
  const [namingFolder, setNamingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  /** True once "Note" swaps the menu for inline capture. */
  const [writingNote, setWritingNote] = useState(false);
  const passageLists = useCollection(listDocuments, (d) => d.kind === "passage-list");
  /** The reader's custom guides; each runs on this chapter from the chooser. */
  const customGuides = useCollection(guides);
  const verseNotes = useCollection(
    marginNotes,
    (n) => n.book === book && n.chapter === chapter && n.verse === verse
  );
  /** The visual filter sets marking this verse; each offers a removal row. */
  const verseSets = useCollection(visualFilters, (s) =>
    s.items.some((it) => it.book === book && it.chapter === chapter && it.verse === verse)
  );
  const { ref, style } = useFloatingMenu(x, y, onClose, {
    deps: [mentions, pickingList, pickingClips, pickingFolder, pickingGuide, namingFolder, writingNote, verseSets],
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
    void copyPassage([{ number: verse, text }], reference);
    playSound("complete");
    onClose();
  };

  /* The verse's stable reader URL, the app's analog of citing an exact spot. */
  const copyLink = () => {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/read/${book}/${chapter}#v${verse}`)
      .catch(() => {});
    playSound("complete");
    onClose();
  };

  /** Files the verse under a folder; "" leaves it unfiled at the top. */
  const bookmark = (folder: string) => {
    addFavorite(book, chapter, verse, folder);
    playSound("complete");
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
    playSound("complete");
    onClose();
  };

  if (writingNote) {
    return (
      <div
        key="note"
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
      key="menu"
      ref={ref}
      role="menu"
      aria-label={`${reference} actions`}
      style={style}
      className={`${FRAME} flex min-w-72`}
    >
      <div className="fx-stagger min-w-0 flex-1 border-r border-rule py-1">
        <p className={HEAD} style={rowI(0)}>{reference}</p>
        {mentions === null ? (
          <p className="px-3 py-1 text-[0.72rem] text-muted" style={rowI(1)}>
            Reading the verse…
          </p>
        ) : mentions.length === 0 ? (
          <p className="px-3 py-1 text-[0.72rem] text-muted" style={rowI(1)}>
            No people or places tagged in this verse.
          </p>
        ) : (
          mentions.map((m, i) => (
            <button
              key={m.id}
              type="button"
              title={m.brief || m.type}
              style={rowI(Math.min(i + 1, 6))}
              onClick={() => {
                dispatch({ type: "openFactbook", entityId: m.id, title: m.name, paneId });
                onClose();
              }}
              className="fx-press flex w-full items-baseline gap-2 px-3 py-1 text-left text-[0.72rem] text-sapphire hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              <span className="truncate">{m.name}</span>
              <span className="ml-auto pl-3 text-[0.62rem] text-muted">
                {m.kind === "other" ? m.type : m.kind}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="fx-stagger w-36 shrink-0 py-1">
        <p className={HEAD} style={rowI(0)}>Actions</p>
        <button
          type="button"
          className={ROW}
          style={rowI(1)}
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
            style={rowI(2)}
            onClick={() => {
              dispatch({ type: "openExegetical", book, chapter, paneId });
              onClose();
            }}
          >
            Exegetical guide
          </button>
        )}
        <div style={rowI(3)}>
          {pickingGuide ? (
            <div className="fx-stagger mt-1 border-t border-rule pt-1">
              <p className={HEAD} style={rowI(0)}>Custom guide</p>
              {customGuides.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  title={`Run ${g.name} on this chapter`}
                  className={ROW}
                  style={rowI(i + 1)}
                  onClick={() => {
                    dispatch({
                      type: "openCustomGuide",
                      guideId: g.id,
                      name: g.name,
                      book,
                      chapter,
                      paneId,
                    });
                    onClose();
                  }}
                >
                  {g.name}
                  <span className="ml-auto pl-3 text-[0.62rem] text-muted">{g.sections.length}</span>
                </button>
              ))}
              <button
                type="button"
                title="Compose, rename, and reorder custom guides"
                className={ROW}
                style={rowI(customGuides.length + 1)}
                onClick={() => {
                  dispatch({ type: "openGuideEditor", guideId: null, paneId });
                  onClose();
                }}
              >
                Guide editor
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="Run one of your custom guides on this chapter"
              className={ROW}
              onClick={() => {
                playSound("open");
                setPickingGuide(true);
              }}
            >
              Custom guide
            </button>
          )}
        </div>
        <button type="button" className={ROW} style={rowI(4)} onClick={copy}>
          Copy verse
        </button>
        <button type="button" className={ROW} style={rowI(5)} onClick={copyLink}>
          Copy link
        </button>
        <button
          type="button"
          title="Open this verse in the Media studio as a verse card"
          className={ROW}
          style={rowI(6)}
          onClick={() => {
            dispatch({ type: "openMedia", book, chapter, verse, paneId });
            onClose();
          }}
        >
          Verse card
        </button>
        <button
          type="button"
          className={ROW}
          style={rowI(7)}
          onClick={() => {
            playSound("open");
            setWritingNote(true);
          }}
        >
          Note{verseNotes.length > 0 ? ` (${verseNotes.length})` : ""}
        </button>
        <button
          type="button"
          title="Take this verse up into memory work"
          className={ROW}
          style={rowI(8)}
          onClick={() => {
            takeUp(book, chapter, verse, verse);
            playSound("complete");
            onClose();
          }}
        >
          Memorize
        </button>
        <div style={rowI(9)}>
          {pickingFolder ? (
            <div className="fx-stagger mt-1 border-t border-rule pt-1">
              <p className={HEAD} style={rowI(0)}>Bookmark in folder</p>
              {listFolders().map((f, i) => (
                <button
                  key={f}
                  type="button"
                  className={ROW}
                  style={rowI(i + 1)}
                  onClick={() => bookmark(f)}
                >
                  {f}
                </button>
              ))}
              {namingFolder ? (
                <div className="px-3 py-1" style={rowI(listFolders().length + 1)}>
                  <input
                    autoFocus
                    value={folderDraft}
                    aria-label="New folder name"
                    placeholder="Folder name"
                    onChange={(e) => setFolderDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && folderDraft.trim()) bookmark(folderDraft);
                    }}
                    className="w-full border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink placeholder:text-muted focus:outline focus:outline-2 focus:outline-sapphire"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className={ROW}
                  style={rowI(listFolders().length + 1)}
                  onClick={() => setNamingFolder(true)}
                >
                  New folder
                </button>
              )}
              <button
                type="button"
                className={ROW}
                style={rowI(listFolders().length + 2)}
                onClick={() => bookmark("")}
              >
                No folder
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="File this verse under a folder in the Read rail"
              className={ROW}
              onClick={() => {
                playSound("open");
                setPickingFolder(true);
              }}
            >
              Bookmark
            </button>
          )}
        </div>
        <div style={rowI(10)}>
          {pickingList ? (
            <div className="fx-stagger mt-1 border-t border-rule pt-1">
              <p className={HEAD} style={rowI(0)}>Add to passage list</p>
              {passageLists.map((doc, i) => (
                <button
                  key={doc.id}
                  type="button"
                  className={ROW}
                  style={rowI(i + 1)}
                  onClick={() => addToPassageList(doc.id)}
                >
                  {doc.title || "Untitled list"}
                  <span className="ml-auto pl-3 text-[0.62rem] text-muted">{doc.items.length}</span>
                </button>
              ))}
              <button
                type="button"
                className={ROW}
                style={rowI(passageLists.length + 1)}
                onClick={() => addToPassageList(null)}
              >
                New passage list
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={ROW}
              onClick={() => {
                playSound("open");
                setPickingList(true);
              }}
            >
              Add to passage list
            </button>
          )}
        </div>
        <div style={rowI(11)}>
          {pickingClips ? (
            <div className="fx-rise">
              <ClippingsPicker
                item={{ text, citation: reference, sourceRef: { book, chapter, verse } }}
                newTitle={`Clippings from ${bookName}`}
                heading="Clip verse into"
                onDone={() => {
                  playSound("complete");
                  onClose();
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              title="Keep this verse's text and citation in a clippings document"
              className={ROW}
              onClick={() => {
                playSound("open");
                setPickingClips(true);
              }}
            >
              Clip verse
            </button>
          )}
        </div>
        <div
          className="mt-1 flex items-center gap-1.5 border-t border-rule px-3 pt-1.5"
          style={rowI(12)}
        >
          <StylePalette
            onPick={(styleId) => {
              playSound("complete");
              setHighlight(book, chapter, verse, styleId);
              onClose();
            }}
          />
        </div>
        {verseSets.length > 0 && (
          <div className="fx-stagger mt-1 border-t border-rule pt-1" style={rowI(13)}>
            {verseSets.map((s, i) => (
              <button
                key={s.id}
                type="button"
                title={`Remove this verse's mark from ${s.name}; the set stays`}
                className={ROW}
                style={rowI(i)}
                onClick={() => {
                  removeVerseFromSet(s.id, book, chapter, verse);
                  playSound("complete");
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
  const speechOk = useSpeechAvailable();
  /* The Pronounce row arms after mount; re-measure when it lands. */
  const { ref, style } = useFloatingMenu(x, y, onClose, { deps: [speechOk] });
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
      <div className="fx-stagger min-w-0 flex-1 border-r border-rule py-1">
        <p className={HEAD} style={rowI(0)}>
          <span className={word.lemma ? (first?.startsWith("H") ? "lang-hebrew" : "lang-greek") : ""}>
            {word.text}
          </span>
          <span className="ml-2 normal-case">{reference}</span>
        </p>
        {info.map(([label, value], i) => (
          <p key={label} className="px-3 py-0.5 text-[0.72rem] text-muted" style={rowI(i + 1)}>
            <span className="font-semibold text-ink">{label}:</span> {value}
          </p>
        ))}
        {word.strongs.map((id, i) => (
          <button
            key={id}
            type="button"
            title={`Open the lexicon at ${id}`}
            className={`${ROW} text-sapphire`}
            style={rowI(info.length + i + 1)}
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
      <div className="fx-stagger w-40 shrink-0 py-1">
        <p className={HEAD} style={rowI(0)}>Actions</p>
        {first && (
          <button
            type="button"
            className={ROW}
            style={rowI(1)}
            onClick={() => {
              dispatch({ type: "openWordStudy", strongsId: first, paneId });
              onClose();
            }}
          >
            Word study {first}
          </button>
        )}
        {speechOk && (word.lemma || word.xlit) && (
          <button
            type="button"
            title="Hear the lemma spoken aloud"
            className={ROW}
            style={rowI(2)}
            onClick={() => {
              pronounceLemma({
                lemma: word.lemma,
                xlit: word.xlit,
                lang: first?.startsWith("H") ? "he" : first ? "el" : null,
              });
              onClose();
            }}
          >
            Pronounce
          </button>
        )}
        {!word.lemma && (
          <button
            type="button"
            className={ROW}
            style={rowI(3)}
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
 * Copy, concordance search, note, clip, the style palette, the verse card,
 * and print of the selection alone; the anchor verse supplies the
 * reference, and the note and the clip
 * anchor there too: marginalia keys on the verse, not the character range.
 * Translate stays out: nothing backs it yet.
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
  /** True once "Clip" swaps the toolbar for the clippings chooser. */
  const [pickingClips, setPickingClips] = useState(false);
  const { ref, style } = useFloatingMenu(x, y, onClose, {
    above: true,
    deps: [writingNote, pickingClips],
  });
  const reference = `${bookName} ${chapter}:${verse}`;

  const copy = () => {
    void copyPassage([{ number: verse, text }], reference);
    playSound("complete");
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
    playSound("complete");
    onClose();
  };

  /* Prints the selection alone: the words rise into a print-only sheet that
   * takes the print root for the one job (the same data-print-active idiom
   * the report panes use), then leave the document. */
  const printSelection = () => {
    const sheet = document.createElement("div");
    sheet.className = "print-only font-reader";
    sheet.setAttribute("data-print-active", "");
    const heading = document.createElement("p");
    heading.className = "small-caps";
    heading.textContent = reference;
    const words = document.createElement("p");
    words.textContent = text;
    sheet.append(heading, words);
    document.body.appendChild(sheet);
    const done = () => sheet.remove();
    window.addEventListener("afterprint", done, { once: true });
    window.setTimeout(done, 60_000);
    window.print();
    playSound("complete");
    onClose();
  };

  const TOOL =
    "fx-press px-1.5 py-0.5 text-[0.72rem] text-ink hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

  /* The editor drops the toolbar's mousedown guard: the textarea takes
   * focus, and the native selection may collapse; the anchor verse was
   * captured when the toolbar rose. */
  if (writingNote) {
    return (
      <div
        key="note"
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

  /* The chooser keeps the toolbar's mousedown guard off: picking a target
   * ends the capture, and the selection has already been read into text. */
  if (pickingClips) {
    return (
      <div
        key="clips"
        ref={ref}
        role="menu"
        aria-label="Clip the selection"
        style={style}
        className={`${FRAME} w-64 py-1`}
      >
        <p className={HEAD}>{reference}</p>
        <ClippingsPicker
          item={{ text, citation: reference, sourceRef: { book, chapter, verse } }}
          newTitle={`Clippings from ${bookName}`}
          heading="Clip the selection into"
          onDone={() => {
            playSound("complete");
            onClose();
          }}
        />
      </div>
    );
  }

  return (
    <div
      key="tools"
      ref={ref}
      role="menu"
      aria-label="Selection actions"
      style={style}
      // A press on the toolbar keeps the text selection it answers.
      onMouseDown={(e) => e.preventDefault()}
      className={`${FRAME} fx-stagger flex items-center gap-1 px-2 py-1`}
    >
      <button type="button" className={TOOL} style={rowI(0)} onClick={copy}>
        Copy
      </button>
      <button
        type="button"
        className={TOOL}
        style={rowI(1)}
        onClick={() => {
          playSound("open");
          setWritingNote(true);
        }}
      >
        Note
      </button>
      <button
        type="button"
        className={TOOL}
        style={rowI(2)}
        onClick={() => {
          playSound("open");
          setPickingClips(true);
        }}
      >
        Clip
      </button>
      <button
        type="button"
        className={TOOL}
        style={rowI(3)}
        onClick={() => {
          dispatch({ type: "openSearch", q: text, paneId });
          onClose();
        }}
      >
        Search
      </button>
      <button type="button" className={TOOL} style={rowI(4)} onClick={exportCard}>
        Export card
      </button>
      <button type="button" className={TOOL} style={rowI(5)} onClick={printSelection}>
        Print
      </button>
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-rule" style={rowI(6)} />
      <span className="flex items-center" style={rowI(7)}>
        <StylePalette
          onPick={(styleId) => {
            playSound("complete");
            setHighlight(book, chapter, verse, styleId);
            onClose();
          }}
        />
      </span>
    </div>
  );
}
