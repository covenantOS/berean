"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from "react";
import { adjacentChapter } from "@/lib/canon";
import {
  deleteNote,
  listNotes,
  notes as marginCollection,
  saveNote,
  type MarginNote,
} from "@/lib/marginalia";
import {
  clearHighlight,
  HIGHLIGHT_COLORS,
  highlights as highlightCollection,
  listHighlights,
  setHighlight,
  type HighlightColor,
  type VerseHighlight,
} from "@/lib/highlights";
import { verseCardSvg } from "@/lib/verseCard";
import { useWorkspace } from "./WorkspaceContext";
import { findLeaf } from "./workspace-state";

interface Verse {
  verse: number;
  text: string;
  label?: string;
}

interface TaggedWord {
  t: string;
  s?: string[];
}

interface TaggedVerse {
  verse: number;
  words: TaggedWord[];
}

/** One original-language word; md is the morphology decoded server-side. */
interface OriginalWord {
  t: string;
  s?: string[];
  m?: string;
  x?: string;
  g?: string;
  l?: string;
  dg?: string;
  md?: string;
}

interface OriginalVerse {
  verse: number;
  alt?: string;
  words: OriginalWord[];
}

interface ChapterPayload {
  book: string;
  bookName: string;
  chapter: number;
  chapters: number;
  poetry: boolean;
  translation: string;
  translationId: string;
  lang: "hebrew" | "greek";
  hasTagged: boolean;
  hasOriginal: boolean;
  verses: Verse[];
  tagged?: TaggedVerse[] | null;
  original?: OriginalVerse[] | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ChapterPayload };

/** The word apparatus, fetched lazily the first time a word toggle opens. */
type Apparatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; tagged: TaggedVerse[] | null; original: OriginalVerse[] | null };

/** Base Strong's id the lexicon knows, from an extended id like "H7225G". */
function baseStrongs(id: string): string {
  const m = id.match(/^([GH]\d+?)[A-Z]?$/);
  return m ? m[1] : id;
}

/**
 * The reader panel. Fetches the chapter from /api/pane/chapter so the
 * workspace never reloads the page. Tapping a verse selects it (the dock
 * answers) and opens the context strip under the verse; the Words and
 * Original toggles arm word-level taps that broadcast to the lexicon.
 */
export default function ReaderPane({
  paneId,
  book,
  chapter,
  translation,
}: {
  paneId: string;
  book: string;
  chapter: number;
  translation?: string;
}) {
  const { state, dispatch, reportLinkedVerse, subscribeLinkedVerse } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [apparatus, setApparatus] = useState<Apparatus>({ status: "idle" });
  const [wordsOn, setWordsOn] = useState(false);
  const [view, setView] = useState<"text" | "original">("text");
  const [glossOn, setGlossOn] = useState(true);
  const [notes, setNotes] = useState<MarginNote[]>([]);
  const [marks, setMarks] = useState<VerseHighlight[]>([]);

  /*
   * Link-set scroll sync. This pane reports its topmost visible verse,
   * throttled, and follows reports from panes wearing the same letter. The
   * echo guard: after applying a programmatic scroll, this pane stays quiet
   * for 300ms so the set does not chase its own tail.
   */
  const linkSet = findLeaf(state.root, paneId)?.linkSet ?? null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const ignoreUntil = useRef(0);
  const scrollTimer = useRef<number | null>(null);

  // The chapter text, lean; the word apparatus stays behind its flags.
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    setApparatus({ status: "idle" });
    const q = new URLSearchParams({ book, chapter: String(chapter) });
    if (translation) q.set("translation", translation);
    fetch(`/api/pane/chapter?${q}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", data: (await res.json()) as ChapterPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter, translation]);

  // Marginalia and highlights for this chapter, live over the stores.
  useEffect(() => {
    const refresh = () => {
      setNotes(listNotes(book, chapter));
      setMarks(listHighlights(book, chapter));
    };
    refresh();
    const unNotes = marginCollection.subscribe(refresh);
    const unMarks = highlightCollection.subscribe(refresh);
    return () => {
      unNotes();
      unMarks();
    };
  }, [book, chapter]);

  // A retargeted chapter opens at its head; the set finds out the same way
  // (its own navigation), so the reset does not broadcast.
  useEffect(() => {
    ignoreUntil.current = Date.now() + 300;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [book, chapter]);

  // A navigation or unlink drops any throttled report still waiting to fire.
  useEffect(() => {
    return () => {
      if (scrollTimer.current !== null) {
        window.clearTimeout(scrollTimer.current);
        scrollTimer.current = null;
      }
    };
  }, [book, chapter, linkSet]);

  // Follow the set: a linked pane's report scrolls the same verse into view.
  // Reports for another chapter are left to chapter-level sync.
  useEffect(() => {
    if (!linkSet) return;
    return subscribeLinkedVerse((notice) => {
      if (notice.paneId === paneId || notice.linkSet !== linkSet) return;
      if (notice.book !== book || notice.chapter !== chapter) return;
      const container = scrollRef.current;
      if (!container) return;
      const el = container.querySelector(`[data-verse="${notice.verse}"]`);
      if (!(el instanceof HTMLElement)) return;
      ignoreUntil.current = Date.now() + 300;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      container.scrollTop += eRect.top - cRect.top;
    });
  }, [linkSet, book, chapter, paneId, subscribeLinkedVerse]);

  /** The topmost verse in view; the scroll handler reports it to the set. */
  const reportTopVerse = () => {
    const container = scrollRef.current;
    if (!container || !linkSet) return;
    const cTop = container.getBoundingClientRect().top;
    for (const el of container.querySelectorAll<HTMLElement>("[data-verse]")) {
      if (el.getBoundingClientRect().bottom > cTop + 1) {
        const verse = Number(el.dataset.verse);
        if (Number.isInteger(verse)) {
          reportLinkedVerse({ paneId, linkSet, book, chapter, verse });
        }
        return;
      }
    }
  };

  const onScroll = (_e: ReactUIEvent<HTMLDivElement>) => {
    if (!linkSet || Date.now() < ignoreUntil.current) return;
    if (scrollTimer.current !== null) return;
    scrollTimer.current = window.setTimeout(() => {
      scrollTimer.current = null;
      if (Date.now() < ignoreUntil.current) return;
      reportTopVerse();
    }, 200);
  };

  const ready = load.status === "ready" ? load.data : null;
  const wantApparatus = wordsOn || view === "original";

  // Lazy apparatus: tagged KJV words and the original text arrive together.
  useEffect(() => {
    if (!ready || !wantApparatus || apparatus.status !== "idle") return;
    if (!ready.hasTagged && !ready.hasOriginal) return;
    const controller = new AbortController();
    setApparatus({ status: "loading" });
    const q = new URLSearchParams({ book, chapter: String(chapter), tagged: "1", original: "1" });
    if (translation) q.set("translation", translation);
    fetch(`/api/pane/chapter?${q}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ChapterPayload;
        setApparatus({ status: "ready", tagged: data.tagged ?? null, original: data.original ?? null });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setApparatus({ status: "ready", tagged: null, original: null });
      });
    return () => controller.abort();
  }, [ready, wantApparatus, apparatus.status, book, chapter, translation]);

  const go = (dir: -1 | 1) => {
    const next = adjacentChapter(book, chapter, dir);
    if (next) dispatch({ type: "openRef", book: next.book.slug, chapter: next.chapter, paneId });
  };

  const sel = state.selection;
  const selHere = sel && sel.book === book && sel.chapter === chapter ? sel : null;
  const selVerse = selHere?.kind === "verse" ? selHere.verse : null;

  const notesByVerse = useMemo(() => {
    const m = new Map<number, MarginNote[]>();
    for (const n of notes) {
      const arr = m.get(n.verse) ?? [];
      arr.push(n);
      m.set(n.verse, arr);
    }
    return m;
  }, [notes]);

  const markByVerse = useMemo(() => new Map(marks.map((m) => [m.verse, m])), [marks]);

  /** A tap selects; a drag selection of text is left alone. */
  const tapVerse = (verse: number) => {
    const s = window.getSelection();
    if (s && !s.isCollapsed) return;
    dispatch({ type: "selectVerse", book, chapter, verse });
  };

  const tapTaggedWord = (verse: number, w: TaggedWord) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!w.s || w.s.length === 0) return;
    dispatch({
      type: "selectWord",
      word: { book, chapter, verse, text: w.t, strongs: w.s },
    });
  };

  const tapOriginalWord = (verse: number, w: OriginalWord) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    dispatch({
      type: "selectWord",
      word: {
        book,
        chapter,
        verse,
        text: w.t,
        strongs: (w.s ?? []).map(baseStrongs),
        lemma: w.l,
        xlit: w.x,
        morph: w.md,
        gloss: w.g ?? w.dg,
      },
    });
  };

  const isActiveWord = (verse: number, text: string) =>
    selHere?.kind === "word" && selHere.verse === verse && selHere.text === text;

  const verseClass = (v: number) => {
    const mark = markByVerse.get(v);
    return [
      "verse-target",
      mark ? `hl-${mark.color}` : "",
      notesByVerse.has(v) ? "has-note" : "",
      selVerse === v ? "verse-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const verseText = (v: number) =>
    (ready?.verses ?? [])
      .filter((x) => x.verse === v)
      .map((x) => (x.label ? `${x.label} ${x.text}` : x.text))
      .join(" ");

  const stripNode =
    selVerse !== null && ready ? (
      <ContextStrip
        paneId={paneId}
        book={book}
        chapter={chapter}
        verse={selVerse}
        bookName={ready.bookName}
        abbrev={ready.translation}
        text={verseText(selVerse)}
        mark={markByVerse.get(selVerse)}
        verseNotes={notesByVerse.get(selVerse) ?? []}
        onMark={(c) => setHighlight(book, chapter, selVerse, c)}
        onClearMark={() => clearHighlight(book, chapter, selVerse)}
      />
    ) : null;

  const renderPlainVerse = (v: Verse) => (
    <span
      key={v.verse}
      data-verse={v.verse}
      className={verseClass(v.verse)}
      onClick={() => tapVerse(v.verse)}
    >
      <VerseNum label={v.label ?? v.verse} verse={v.verse} onTap={tapVerse} />
      {v.text}{" "}
    </span>
  );

  const renderTaggedVerse = (v: TaggedVerse) => (
    <span
      key={v.verse}
      data-verse={v.verse}
      className={verseClass(v.verse)}
      onClick={() => tapVerse(v.verse)}
    >
      <VerseNum label={v.verse} verse={v.verse} onTap={tapVerse} />
      {v.words.map((w, i) => (
        <span key={i}>
          {w.s && w.s.length > 0 ? (
            <span
              className={`tagged-word armed ${isActiveWord(v.verse, w.t) ? "word-active" : ""}`}
              onClick={tapTaggedWord(v.verse, w)}
            >
              {w.t}
            </span>
          ) : (
            w.t
          )}{" "}
        </span>
      ))}
    </span>
  );

  const renderOrigWord = (lang: "hebrew" | "greek", verse: number, w: OriginalWord, i: number) => (
    <span key={i} className="orig-word">
      <span
        className={`${lang === "hebrew" ? "lang-hebrew" : "lang-greek"}${wordsOn ? " tagged-word armed" : ""}${isActiveWord(verse, w.t) ? " word-active" : ""}`}
        onClick={wordsOn ? tapOriginalWord(verse, w) : undefined}
      >
        {w.t}
      </span>
      {glossOn && w.g ? (
        <span className="orig-sub" dir="ltr">
          {w.g}
        </span>
      ) : null}
    </span>
  );

  /* Prose modes split at the selected verse so the strip sits directly
   * beneath it without nesting a block inside the paragraph. */
  const renderFlow = (verses: Verse[] | TaggedVerse[], tagged: boolean) => {
    const render = tagged
      ? (v: Verse | TaggedVerse) => renderTaggedVerse(v as TaggedVerse)
      : (v: Verse | TaggedVerse) => renderPlainVerse(v as Verse);
    const idx = selVerse === null ? -1 : verses.findIndex((v) => v.verse === selVerse);
    if (idx < 0) {
      return <p className="prose-verses mx-auto max-w-prose px-6 py-6">{verses.map(render)}</p>;
    }
    return (
      <>
        <p className="prose-verses mx-auto max-w-prose px-6 pt-6 pb-4">
          {verses.slice(0, idx + 1).map(render)}
        </p>
        {stripNode}
        {idx + 1 < verses.length && (
          <p className="prose-verses mx-auto max-w-prose px-6 pt-4 pb-6">
            {verses.slice(idx + 1).map(render)}
          </p>
        )}
      </>
    );
  };

  const renderPoetry = (verses: Verse[]) => (
    <div className="poetry-verses mx-auto max-w-prose px-6 py-6">
      {verses.map((v) => (
        <Fragment key={v.verse}>
          <div
            className={`verse-line ${verseClass(v.verse)}`}
            data-verse={v.verse}
            onClick={() => tapVerse(v.verse)}
          >
            <VerseNum label={v.label ?? v.verse} verse={v.verse} onTap={tapVerse} />
            {v.label && (
              <span className="font-[family-name:var(--font-interface)] text-xs text-muted">
                {v.label}{" "}
              </span>
            )}
            {v.text}
          </div>
          {selVerse === v.verse ? stripNode : null}
        </Fragment>
      ))}
    </div>
  );

  const renderOriginal = (lang: "hebrew" | "greek", original: OriginalVerse[]) => (
    <div
      className="original-verses mx-auto max-w-prose px-6 py-6"
      dir={lang === "hebrew" ? "rtl" : "ltr"}
      lang={lang === "hebrew" ? "he" : "grc"}
    >
      {original.map((v) =>
        v.verse === 0 ? (
          <p key={0} className="superscription">
            {v.words.map((w, i) => renderOrigWord(lang, 0, w, i))}
          </p>
        ) : (
          <Fragment key={v.verse}>
            <span
              className={verseClass(v.verse)}
              data-verse={v.verse}
              onClick={() => tapVerse(v.verse)}
            >
              <VerseNum label={v.verse} verse={v.verse} onTap={tapVerse} />
              {v.alt && (
                <span className="alt-note" dir="ltr">
                  {lang === "hebrew" ? `Heb. ${v.alt}` : `KJV ${v.alt}`}
                </span>
              )}
              {v.words.map((w, i) => renderOrigWord(lang, v.verse, w, i))}
            </span>
            {selVerse === v.verse ? stripNode : null}
          </Fragment>
        )
      )}
    </div>
  );

  let body: ReactNode = null;
  if (load.status === "loading") {
    body = <p className="px-6 py-8 text-center text-xs text-muted">Opening the chapter…</p>;
  } else if (load.status === "error") {
    body = (
      <p className="px-6 py-8 text-center text-xs text-muted">This chapter could not be loaded.</p>
    );
  } else {
    const data = load.data;
    if (view === "original" && data.hasOriginal) {
      if (apparatus.status !== "ready") {
        body = (
          <p className="px-6 py-8 text-center text-xs text-muted">Opening the original text…</p>
        );
      } else if (!apparatus.original) {
        body = (
          <p className="px-6 py-8 text-center text-xs text-muted">
            The original text is not furnished for this chapter.
          </p>
        );
      } else {
        body = renderOriginal(data.lang, apparatus.original);
      }
    } else if (
      wordsOn &&
      data.translationId === "kjv" &&
      data.hasTagged &&
      apparatus.status === "ready" &&
      apparatus.tagged
    ) {
      body = renderFlow(apparatus.tagged, true);
    } else {
      body = data.poetry ? renderPoetry(data.verses) : renderFlow(data.verses, false);
    }
  }

  const toggleBtn = (on: boolean) =>
    `border px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
      on ? "border-sapphire text-sapphire" : "border-rule text-muted hover:text-ink"
    }`;

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col">
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <div className="flex flex-1 items-center gap-0.5">
          <button
            type="button"
            title="Previous chapter"
            aria-label="Previous chapter"
            disabled={!adjacentChapter(book, chapter, -1)}
            onClick={() => go(-1)}
            className="px-1.5 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ‹
          </button>
          <button
            type="button"
            title="Next chapter"
            aria-label="Next chapter"
            disabled={!adjacentChapter(book, chapter, 1)}
            onClick={() => go(1)}
            className="px-1.5 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ›
          </button>
        </div>
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          {ready ? `${ready.bookName} ${ready.chapter}` : "\u00A0"}
          {ready && (
            <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">
              {ready.translation}
            </span>
          )}
        </h2>
        <div className="flex flex-1 items-center justify-end gap-1">
          {ready && ready.translationId === "kjv" && ready.hasTagged && (
            <button
              type="button"
              aria-pressed={wordsOn}
              title="Words carrying Strong's numbers become tappable"
              onClick={() => setWordsOn(!wordsOn)}
              className={toggleBtn(wordsOn)}
            >
              Words
            </button>
          )}
          {ready && ready.hasOriginal && (
            <div className="flex border border-rule" role="group" aria-label="Text or original">
              <button
                type="button"
                aria-pressed={view === "text"}
                onClick={() => setView("text")}
                className={toggleBtn(view === "text") + " border-0"}
              >
                {ready.translation}
              </button>
              <button
                type="button"
                aria-pressed={view === "original"}
                title={ready.lang === "hebrew" ? "The Hebrew text (TAHOT)" : "The Greek text (TAGNT)"}
                onClick={() => setView("original")}
                className={toggleBtn(view === "original") + " border-0"}
              >
                Original
              </button>
            </div>
          )}
          {ready && ready.hasOriginal && view === "original" && (
            <button
              type="button"
              aria-pressed={glossOn}
              title="The English gloss under each word"
              onClick={() => setGlossOn(!glossOn)}
              className={toggleBtn(glossOn)}
            >
              Gloss
            </button>
          )}
        </div>
      </header>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {body}
      </div>
    </div>
  );
}

function VerseNum({
  label,
  verse,
  onTap,
}: {
  label: string | number;
  verse: number;
  onTap: (verse: number) => void;
}) {
  return (
    <button
      type="button"
      className="verse-num"
      aria-label={`Select verse ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onTap(verse);
      }}
    >
      {label}
    </button>
  );
}

const STRIP_BTN =
  "text-[0.72rem] text-ink hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

/**
 * The context strip: inline beneath the selected verse, never modal. Note,
 * Highlight, Copy, Compare, and Export card; the verse's existing notes
 * list below with delete. Everything here is quiet chrome over the stores.
 */
function ContextStrip({
  paneId,
  book,
  chapter,
  verse,
  bookName,
  abbrev,
  text,
  mark,
  verseNotes,
  onMark,
  onClearMark,
}: {
  paneId: string;
  book: string;
  chapter: number;
  verse: number;
  bookName: string;
  abbrev: string;
  text: string;
  mark: VerseHighlight | undefined;
  verseNotes: MarginNote[];
  onMark: (color: HighlightColor) => void;
  onClearMark: () => void;
}) {
  const { dispatch } = useWorkspace();
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reference = `${bookName} ${chapter}:${verse}`;

  // A retargeted strip starts closed.
  const target = `${book}:${chapter}:${verse}`;
  useEffect(() => {
    setNoteOpen(false);
    setDraft("");
    setEditingId(null);
    setCopied(false);
  }, [target]);

  const toggleNote = () => {
    if (noteOpen) {
      setNoteOpen(false);
      return;
    }
    const existing = verseNotes[0];
    setDraft(existing?.text ?? "");
    setEditingId(existing?.id ?? null);
    setNoteOpen(true);
  };

  const submitNote = () => {
    if (!draft.trim()) return;
    saveNote({
      id: editingId ?? undefined,
      book,
      chapter,
      verse,
      text: draft.trim(),
    });
    setNoteOpen(false);
    setDraft("");
    setEditingId(null);
  };

  const copy = () => {
    navigator.clipboard
      ?.writeText(`${text} (${reference})`)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  /** Print/export aid: the verse as a letterpress card, downloaded as SVG. */
  const exportCard = () => {
    const svg = verseCardSvg(text, reference, abbrev);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book}-${chapter}-${verse}-${abbrev.toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir="ltr" className="mx-auto max-w-prose px-6">
      <div className="my-1 border border-rule bg-surface px-3 py-2 font-[family-name:var(--font-interface)]">
        <div className="flex items-center justify-between">
          <p className="small-caps text-xs font-semibold text-amber">{reference}</p>
          <button
            type="button"
            aria-label="Clear selection"
            title="Clear selection"
            onClick={() => dispatch({ type: "clearSelection" })}
            className="px-1 leading-none text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ×
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            aria-pressed={noteOpen}
            onClick={toggleNote}
            className={`${STRIP_BTN} ${noteOpen ? "text-sapphire" : ""}`}
          >
            Note
          </button>
          <button type="button" onClick={copy} className={STRIP_BTN}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            title="Open this chapter in WEB beside"
            onClick={() => dispatch({ type: "compareRef", book, chapter, translation: "web", paneId })}
            className={STRIP_BTN}
          >
            Compare
          </button>
          <button type="button" onClick={exportCard} className={STRIP_BTN}>
            Export card
          </button>
          <span className="flex items-center gap-1.5">
            <span className="text-[0.72rem] text-muted">Highlight</span>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={`Highlight ${c}`}
                aria-pressed={mark?.color === c}
                onClick={() => onMark(c)}
                className={`h-3.5 w-3.5 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                  mark?.color === c ? "border-ink" : "border-rule"
                }`}
                style={{ background: `var(--stained-${c})` }}
              />
            ))}
            {mark && (
              <button type="button" onClick={onClearMark} className={`${STRIP_BTN} text-muted`}>
                Clear
              </button>
            )}
          </span>
        </div>
        {noteOpen && (
          <div className="mt-2 border-t border-rule pt-2">
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
                onClick={submitNote}
                disabled={!draft.trim()}
                className="border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Save note
              </button>
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                className="px-2 py-1 text-[0.72rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {verseNotes.length > 0 && (
          <ul className="mt-2 space-y-1.5 border-t border-rule pt-2">
            {verseNotes.map((n) => (
              <li key={n.id} className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-xs leading-relaxed whitespace-pre-wrap">
                  {n.text}
                </p>
                <button
                  type="button"
                  aria-label="Delete note"
                  title="Delete note"
                  onClick={() => deleteNote(n.id)}
                  className="shrink-0 px-1 leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
