"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from "react";
import { adjacentChapter, getBook } from "@/lib/canon";
import { formatCitation } from "@/lib/citation";
import {
  deleteNote,
  listNotes,
  notes as marginCollection,
  saveNote,
  type MarginNote,
} from "@/lib/marginalia";
import {
  clearHighlight,
  highlights as highlightCollection,
  highlightStyles as highlightStyleCollection,
  listHighlights,
  listStyles,
  resolveStyle,
  setHighlight,
  styleClass,
  styleColorVar,
  type ResolvedStyle,
  type VerseHighlight,
} from "@/lib/highlights";
import { useCollection } from "@/lib/hooks";
import { verseCardSvg } from "@/lib/verseCard";
import { visualFilters, type VisualFilterSet } from "@/lib/visualfilters";
import InsightsRail from "./InsightsRail";
import NotebookPicker from "./NotebookPicker";
import { SelectionMenu, StylePalette, VerseContextMenu, WordContextMenu } from "./ReaderMenus";
import { useWorkspace } from "./WorkspaceContext";
import { findLeaf, READER_FONT_SCALE_DEFAULT, type WordSelection } from "./workspace-state";

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

/** One pericope: the heading naming the passage that starts at its verse. */
interface Pericope {
  verse: number;
  heading: string;
  parallels?: string;
}

/** The chapter's LibriVox recording, as /api/pane/chapter reports it. */
interface ChapterAudioInfo {
  url: string;
  reader: string | null;
  seconds: number | null;
  sourceUrl: string;
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
  pericopes: Pericope[];
  audio: ChapterAudioInfo | null;
  tagged?: TaggedVerse[] | null;
  original?: OriginalVerse[] | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ChapterPayload };

/** One inline-find hit: a character span of a verse's text. */
interface FindMatch {
  verse: number;
  start: number;
  end: number;
}

/* One system-speech pass over the chapter: the verses read in order, one
 * utterance at a time. cancelled retires the run so a stale chain never
 * speaks after a stop; utterance pins the live utterance against the
 * collector, which some browsers run mid-speech. */
interface SpeechRun {
  cancelled: boolean;
  verses: Verse[];
  idx: number;
  utterance: SpeechSynthesisUtterance | null;
}

/** The word apparatus, fetched lazily the first time a word toggle opens. */
type Apparatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; tagged: TaggedVerse[] | null; original: OriginalVerse[] | null };

/* Text size: five steps of a multiplier over the reader's base size, applied
 * as --reader-scale on the pane's surface (globals.css reads it in the verse
 * blocks). The step lives on the tab and persists with the session. */
const FONT_SCALES = [0.85, 1, 1.15, 1.35, 1.6];

/** Base Strong's id the lexicon knows, from an extended id like "H7225G". */
function baseStrongs(id: string): string {
  const m = id.match(/^([GH]\d+?)[A-Z]?$/);
  return m ? m[1] : id;
}

/** The floating menu currently open in this reader, if one is. */
type ReaderMenu =
  | { kind: "verse"; x: number; y: number; verse: number }
  | { kind: "word"; x: number; y: number; word: WordSelection }
  | { kind: "selection"; x: number; y: number; verse: number; text: string };

/** One translation on the shelf, as /api/translations reports it. */
export interface ShelfTranslation {
  id: string;
  abbrev: string;
  name: string;
  otOnly: boolean;
}

let shelfPromise: Promise<ShelfTranslation[]> | null = null;

/** The furnished translations, fetched once and shared by every reader pane. */
export function translationShelf(): Promise<ShelfTranslation[]> {
  shelfPromise ??= fetch("/api/translations")
    .then((res) => (res.ok ? res.json() : { translations: [] }))
    .then((data: { translations: ShelfTranslation[] }) => data.translations)
    .catch(() => {
      shelfPromise = null;
      return [];
    });
  return shelfPromise;
}

/**
 * The reader panel. Fetches the chapter from /api/pane/chapter so the
 * workspace never reloads the page. Tapping a verse selects it (the dock
 * answers) and opens the context strip under the verse; the Words and
 * Original toggles arm word-level taps that broadcast to the lexicon.
 * Right-click raises the context menus, a drag selection raises the hover
 * toolbar, and a double-click on a tagged word keylinks into the lexicon;
 * all three live in ReaderMenus.tsx. The header's A steppers scale the text
 * (the tab keeps the step), and Reading raises the text over the whole
 * window as a component-level overlay. Pericope headings (BSB paratext)
 * mark the text's passages, quiet small-caps the Headings toggle and Text
 * only both drop; the locator rail under the header tracks the reading
 * position with pericope ticks and prev/next stepping; and a reference chip
 * hovered anywhere in the workspace outlines its verses here (ref-hover).
 * The header's Listen reads the chapter aloud: the LibriVox recording
 * where the KJV has one, the system voice elsewhere, the spoken verse
 * marked in a read-aloud channel and followed gently down the pane.
 */
export default function ReaderPane({
  paneId,
  book,
  chapter,
  translation,
  fontScale,
}: {
  paneId: string;
  book: string;
  chapter: number;
  translation?: string;
  fontScale?: number;
}) {
  const { state, dispatch, reportLinkedVerse, subscribeLinkedVerse, subscribeHoverRef } =
    useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [apparatus, setApparatus] = useState<Apparatus>({ status: "idle" });
  const [wordsOn, setWordsOn] = useState(false);
  const [insightsOn, setInsightsOn] = useState(false);
  const [view, setView] = useState<"text" | "original">("text");
  const [glossOn, setGlossOn] = useState(true);
  /* Reading view: text-only hides the verse numbers, verseLines sets prose
   * one verse per line. Per pane while the tab lives, like the toggles above. */
  const [textOnly, setTextOnly] = useState(false);
  const [verseLines, setVerseLines] = useState(false);
  /* Pericope headings: small-caps markers over the passages they name, from
   * the BSB paratext the chapter payload carries. On while the tab lives,
   * like the other view toggles; Text only hides them too. */
  const [headingsOn, setHeadingsOn] = useState(true);
  /* Hover emphasis: the reference chip under the pointer anywhere in the
   * workspace; verses it covers wear the ref-hover channel until it clears. */
  const [hoverVerses, setHoverVerses] = useState<{ from: number; to: number } | null>(null);
  /* Reading view: a component-level overlay of this pane's text over the
   * whole window. The workspace state never moves for it; Escape exits. */
  const [reading, setReading] = useState(false);
  /* Inline find: the open chapter's text searched client-side, the matches
   * marked in place and walked with prev/next. The box closes on a retarget. */
  const [find, setFind] = useState<{ open: boolean; q: string; index: number }>({
    open: false,
    q: "",
    index: 0,
  });
  /* Read aloud. A KJV chapter carrying a LibriVox recording streams the
   * narrator (a real reader beats synthesis); anything else falls to the
   * system voice, which reads the pane's verses one by one and marks the
   * verse being spoken in a read-aloud channel. One source per pane:
   * starting either stops the other, and a retarget, a translation swap,
   * or the pane's close silences everything. */
  const [listen, setListen] = useState<"idle" | "record" | "speech">("idle");
  const [listenPaused, setListenPaused] = useState(false);
  const [listenRate, setListenRate] = useState(1);
  const [spokenVerse, setSpokenVerse] = useState<number | null>(null);
  /* System speech exists only in the browser; the flag arms after mount so
   * the server render and the first client pass agree. */
  const [speechOk, setSpeechOk] = useState(false);
  const recordRef = useRef<HTMLAudioElement | null>(null);
  const speechRun = useRef<SpeechRun | null>(null);
  const listenRateRef = useRef(1);
  const [shelf, setShelf] = useState<ShelfTranslation[]>([]);
  const [notes, setNotes] = useState<MarginNote[]>([]);
  const [marks, setMarks] = useState<VerseHighlight[]>([]);
  const customStyles = useCollection(highlightStyleCollection);
  const filterSets = useCollection(visualFilters);
  const [menu, setMenu] = useState<ReaderMenu | null>(null);
  /** Set by keylinking: the native double-click selection raises no toolbar. */
  const suppressSelUntil = useRef(0);
  const closeMenu = useCallback(() => setMenu(null), []);

  /*
   * Link-set scroll sync. This pane reports its topmost visible verse,
   * throttled, and follows reports from panes wearing the same letter. The
   * echo guard: after applying a programmatic scroll, this pane stays quiet
   * for 300ms so the set does not chase its own tail.
   */
  const paneLeaf = findLeaf(state.root, paneId);
  const linkSet = paneLeaf?.linkSet ?? null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const ignoreUntil = useRef(0);
  const scrollTimer = useRef<number | null>(null);
  /* The locator: the chapter's scroll progress and the index of the pericope
   * at the reading position. The pericope starts' scroll offsets are measured
   * from the rendered text (null where a start verse is absent from it). */
  const [locator, setLocator] = useState({ progress: 0, current: 0, top: 0 });
  const pericopeOffsets = useRef<(number | null)[]>([]);

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

  // The translation shelf for the swap control, once for the workspace.
  useEffect(() => {
    let live = true;
    translationShelf().then((t) => {
      if (live) setShelf(t);
    });
    return () => {
      live = false;
    };
  }, []);

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
    setMenu(null);
    setFind({ open: false, q: "", index: 0 });
    setHoverVerses(null);
    setLocator({ progress: 0, current: 0, top: 0 });
  }, [book, chapter]);

  /* Stop silences both sources: the speech run is cancelled before the
   * queue drains so nothing orphaned speaks, and the recording element is
   * paused and dropped so a fresh Listen starts the chapter over. */
  const stopAudio = useCallback(() => {
    const run = speechRun.current;
    if (run) {
      run.cancelled = true;
      speechRun.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const el = recordRef.current;
    if (el) {
      el.pause();
      recordRef.current = null;
    }
    setListen("idle");
    setListenPaused(false);
    setSpokenVerse(null);
  }, []);

  /* System speech: one utterance at a time, chained on end, so a rate
   * change lands on the next verse and a stop never leaves a queue behind.
   * Each utterance marks its verse as it starts. */
  const speakVerse = useCallback(
    (run: SpeechRun) => {
      if (run.cancelled) return;
      const v = run.verses[run.idx];
      if (!v) {
        stopAudio();
        return;
      }
      const u = new SpeechSynthesisUtterance(v.text);
      u.rate = listenRateRef.current;
      u.onstart = () => {
        if (!run.cancelled) setSpokenVerse(v.verse);
      };
      u.onend = () => {
        if (run.cancelled) return;
        run.idx += 1;
        run.utterance = null;
        speakVerse(run);
      };
      run.utterance = u;
      window.speechSynthesis.speak(u);
    },
    [stopAudio]
  );

  // System speech is client-only; the speech fallback arms after mount.
  useEffect(() => {
    setSpeechOk("speechSynthesis" in window);
  }, []);

  // A retarget, a translation swap, or the pane's close stops the audio.
  useEffect(() => stopAudio, [book, chapter, translation, stopAudio]);

  /*
   * Hover emphasis (Emphasize Active References). A reference chip anywhere
   * in the workspace reports the passage under the pointer; when it names
   * this chapter, the covered verses wear ref-hover until the report clears.
   * Reports for other chapters only make sure nothing here stays lit.
   */
  useEffect(() => {
    return subscribeHoverRef((notice) => {
      if (notice && notice.book === book && notice.chapter === chapter) {
        setHoverVerses({ from: notice.fromVerse, to: notice.toVerse });
      } else {
        setHoverVerses((cur) => (cur === null ? cur : null));
      }
    });
  }, [subscribeHoverRef, book, chapter]);

  // Reading view leaves on Escape, unless a floating menu owns the key.
  useEffect(() => {
    if (!reading || menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReading(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reading, menu]);

  // Words and the original text render their own words; find keeps to the
  // plain chapter text, so it closes when those views take over.
  useEffect(() => {
    if (find.open && (wordsOn || view !== "text")) setFind({ open: false, q: "", index: 0 });
  }, [find.open, wordsOn, view]);

  /*
   * The selection toolbar. A non-collapsed text selection anchored inside a
   * verse raises it above the selection; the anchor verse supplies the
   * reference. Dismissal lives with the menu itself (outside press, Escape,
   * scroll), never here: a press on the toolbar may collapse the native
   * selection on some touch browsers, and the menu must survive its own
   * click. Selections outside the text (the strip, the header) never raise it.
   */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onChange = () => {
      if (Date.now() < suppressSelUntil.current) return;
      const s = window.getSelection();
      if (!s || s.isCollapsed || s.rangeCount === 0) return;
      const range = s.getRangeAt(0);
      const node = range.startContainer;
      const el = node instanceof Element ? node : node.parentElement;
      const verseEl = el?.closest("[data-verse]");
      if (!(verseEl instanceof HTMLElement) || !container.contains(verseEl)) return;
      const text = s.toString().replace(/\s+/g, " ").trim();
      if (!text) return;
      const rect = range.getBoundingClientRect();
      setMenu({
        kind: "selection",
        x: rect.left + rect.width / 2,
        y: rect.top,
        verse: Number(verseEl.dataset.verse),
        text: text.slice(0, 280),
      });
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

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

  /** The locator reads the scroll position directly; the link-set report in
   *  the scroll handler stays throttled and gated. */
  const updateLocator = () => {
    const container = scrollRef.current;
    if (!container) return;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const top = Math.round(container.scrollTop);
    const progress =
      maxScroll > 0 ? Math.min(1, Math.max(0, container.scrollTop / maxScroll)) : 1;
    let current = 0;
    pericopeOffsets.current.forEach((offset, i) => {
      if (offset !== null && offset <= container.scrollTop + 8) current = i;
    });
    setLocator((prev) =>
      prev.top === top && prev.current === current ? prev : { progress, current, top }
    );
  };

  const onScroll = (_e: ReactUIEvent<HTMLDivElement>) => {
    updateLocator();
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

  /* The swap control's options: the shelf for this book's testament, with
   * the pane's current text always present even when an older session left
   * an OT-only text open on a NT book. */
  const shelfOptions = useMemo(() => {
    const testament = getBook(book)?.testament ?? "OT";
    const forBook = shelf.filter((t) => testament === "OT" || !t.otOnly);
    if (ready && !forBook.some((t) => t.id === ready.translationId)) {
      return [
        { id: ready.translationId, abbrev: ready.translation, name: "", otOnly: false },
        ...forBook,
      ];
    }
    return forBook;
  }, [shelf, ready, book]);

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

  /* The recording wins where both exist: a narrator beats synthesis. The
   * element lives in a ref, never in the tree, so the reading overlay's
   * separate branch cannot unmount it mid-play. */
  const startRecording = () => {
    const info = ready?.audio;
    if (!info) return;
    const run = speechRun.current;
    if (run) {
      run.cancelled = true;
      speechRun.current = null;
      window.speechSynthesis.cancel();
      setSpokenVerse(null);
    }
    const el = new Audio(info.url);
    el.preload = "none";
    el.playbackRate = listenRateRef.current;
    el.onended = () => stopAudio();
    recordRef.current = el;
    setListen("record");
    setListenPaused(false);
    el.play().catch(() => stopAudio());
  };

  /* The fallback: the system voice over the pane's own verses, recording
   * or not. Starting it silences the recorder. */
  const startSpeech = () => {
    if (!ready || !("speechSynthesis" in window)) return;
    const el = recordRef.current;
    if (el) {
      el.pause();
      recordRef.current = null;
    }
    window.speechSynthesis.cancel();
    const run: SpeechRun = { cancelled: false, verses: ready.verses, idx: 0, utterance: null };
    speechRun.current = run;
    setListen("speech");
    setListenPaused(false);
    speakVerse(run);
  };

  const toggleListen = () => {
    if (listen !== "idle") {
      stopAudio();
    } else if (ready?.audio) {
      startRecording();
    } else {
      startSpeech();
    }
  };

  const toggleListenPause = () => {
    if (listen === "record") {
      const el = recordRef.current;
      if (!el) return;
      if (listenPaused) {
        el.play().catch(() => stopAudio());
      } else {
        el.pause();
      }
    } else if (listen === "speech" && "speechSynthesis" in window) {
      if (listenPaused) {
        window.speechSynthesis.resume();
      } else {
        window.speechSynthesis.pause();
      }
    } else {
      return;
    }
    setListenPaused(!listenPaused);
  };

  /* The recording takes a new rate at once; speech reads it as each
   * verse's utterance is made. */
  const changeListenRate = (r: number) => {
    setListenRate(r);
    listenRateRef.current = r;
    const el = recordRef.current;
    if (el) el.playbackRate = r;
  };

  /* Left and right arrows page the chapter when this pane is the one in
   * focus and nothing is being typed or selected: fields, the find box,
   * and the translation menu keep their own arrow keys, a text selection
   * keeps its caret, and modifier chords belong to the browser. */
  useEffect(() => {
    if (state.activePaneId !== paneId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const next = adjacentChapter(book, chapter, e.key === "ArrowLeft" ? -1 : 1);
      if (!next) return;
      e.preventDefault();
      dispatch({ type: "openRef", book: next.book.slug, chapter: next.chapter, paneId });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.activePaneId, paneId, book, chapter, dispatch]);

  /* The heading over a pericope's first verse: quiet small-caps, with the
   * source's parallel passages beneath in a smaller line. Text only reads
   * without them, the way it hides the verse numbers. */
  const pericopeHeading = (verse: number) => {
    if (!headingsOn || textOnly) return null;
    const p = pericopeByVerse.get(verse);
    if (!p) return null;
    return (
      <span className="pericope-heading">
        {p.heading}
        {p.parallels && <span className="pericope-parallels">({p.parallels})</span>}
      </span>
    );
  };

  /** Scroll the chapter so a verse sits at the top of the pane. */
  const scrollToVerse = (verse: number) => {
    const container = scrollRef.current;
    const el = container?.querySelector(`[data-verse="${verse}"]`);
    if (!(container && el instanceof HTMLElement)) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    container.scrollTop += eRect.top - cRect.top - 8;
    updateLocator();
  };

  /* Pericope stepping: back lands on the current passage's start when the
   * reading position has drifted past it, then on the passage before. */
  const stepPericope = (dir: -1 | 1) => {
    if (!ready || ready.pericopes.length === 0) return;
    const container = scrollRef.current;
    if (!container) return;
    let target: number;
    if (dir === 1) {
      target = locator.current + 1;
    } else {
      const start = pericopeOffsets.current[locator.current];
      target =
        start != null && container.scrollTop > start + 24
          ? locator.current
          : locator.current - 1;
    }
    if (target < 0 || target >= ready.pericopes.length) return;
    scrollToVerse(ready.pericopes[target].verse);
  };

  /* The parallel swap: retarget this pane's reader tab to the same passage
   * in another translation. It never dispatches navigation, so link-set
   * partners keep their passage and their own text. */
  const swapTranslation = (id: string) => {
    const tabId = paneLeaf?.activeTabId;
    if (!tabId) return;
    dispatch({
      type: "setReaderTranslation",
      paneId,
      tabId,
      translation: id === "kjv" ? undefined : id,
    });
  };

  /* Text size: the tab's step (1–5, default 2) drives --reader-scale; the
   * header's steppers walk it and the session keeps it. */
  const scaleStep = Math.min(Math.max(1, fontScale ?? READER_FONT_SCALE_DEFAULT), 5);
  const scaleStyle = {
    "--reader-scale": String(FONT_SCALES[scaleStep - 1]),
  } as CSSProperties;

  const stepScale = (dir: -1 | 1) => {
    const tabId = paneLeaf?.activeTabId;
    if (!tabId) return;
    dispatch({ type: "setReaderFontScale", paneId, tabId, fontScale: scaleStep + dir });
  };

  /*
   * Pericope offsets and locator ticks, measured from the rendered verses.
   * Re-measured on anything that can move the text: the view toggles, the
   * scale step, the insights rail, the word apparatus, and window resizes.
   */
  const [pericopeTicks, setPericopeTicks] = useState<(number | null)[]>([]);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !ready) return;
    const measure = () => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      const cRect = container.getBoundingClientRect();
      const offsets = ready.pericopes.map((p) => {
        const el = container.querySelector(`[data-verse="${p.verse}"]`);
        if (!(el instanceof HTMLElement)) return null;
        return el.getBoundingClientRect().top - cRect.top + container.scrollTop;
      });
      pericopeOffsets.current = offsets;
      setPericopeTicks(
        offsets.map((o) => (o !== null && maxScroll > 0 ? Math.min(1, o / maxScroll) : null))
      );
      updateLocator();
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [
    ready,
    headingsOn,
    textOnly,
    verseLines,
    view,
    wordsOn,
    apparatus.status,
    scaleStep,
    insightsOn,
    glossOn,
    find.open,
  ]);

  const sel = state.selection;
  const selHere = sel && sel.book === book && sel.chapter === chapter ? sel : null;
  const selVerse = selHere?.kind === "verse" ? selHere.verse : null;

  const notesByVerse = useMemo(() => {
    const m = new Map<number, MarginNote[]>();
    for (const n of notes) {
      if (n.verse === undefined) continue;
      const arr = m.get(n.verse) ?? [];
      arr.push(n);
      m.set(n.verse, arr);
    }
    return m;
  }, [notes]);

  const markByVerse = useMemo(() => {
    /* Each mark resolves to the style it wears; old records map their stored
     * tint onto the built-in styles and render identically. */
    const styles = listStyles(customStyles);
    const m = new Map<number, ResolvedStyle>();
    for (const h of marks) {
      const def = resolveStyle(h, styles);
      if (def) m.set(h.verse, def);
    }
    return m;
  }, [marks, customStyles]);

  /* Pericope by start verse; the heading renderer and the locator read it. */
  const pericopeByVerse = useMemo(() => {
    const m = new Map<number, Pericope>();
    for (const p of ready?.pericopes ?? []) m.set(p.verse, p);
    return m;
  }, [ready]);

  /* Visible visual filter sets over this chapter: verse to the first set
   * claiming it (a verse in several sets wears one underline). Hidden sets
   * render nothing. */
  const filterByVerse = useMemo(() => {
    const m = new Map<number, VisualFilterSet>();
    for (const s of filterSets) {
      if (!s.visible) continue;
      for (const it of s.items) {
        if (it.book === book && it.chapter === chapter && !m.has(it.verse)) {
          m.set(it.verse, s);
        }
      }
    }
    return m;
  }, [filterSets, book, chapter]);

  /* Inline find. Every case-insensitive hit of the query in the chapter's
   * text, in document order; the count and the prev/next walk read this. */
  const findMatches = useMemo<FindMatch[]>(() => {
    const needle = find.q.trim().toLowerCase();
    if (!find.open || !needle || !ready) return [];
    const out: FindMatch[] = [];
    for (const v of ready.verses) {
      const hay = v.text.toLowerCase();
      let at = hay.indexOf(needle);
      while (at !== -1) {
        out.push({ verse: v.verse, start: at, end: at + needle.length });
        at = hay.indexOf(needle, at + needle.length);
      }
    }
    return out;
  }, [find.open, find.q, ready]);

  /* Match spans per verse, each carrying its number in document order so
   * the current match can wear its own class and be scrolled to. */
  const findByVerse = useMemo(() => {
    const m = new Map<number, { start: number; end: number; gi: number }[]>();
    findMatches.forEach((match, gi) => {
      const arr = m.get(match.verse) ?? [];
      arr.push({ start: match.start, end: match.end, gi });
      m.set(match.verse, arr);
    });
    return m;
  }, [findMatches]);

  const findIndex = findMatches.length > 0 ? Math.min(find.index, findMatches.length - 1) : 0;

  // The current match scrolls into view inside the pane, never the page.
  useEffect(() => {
    if (!find.open || findMatches.length === 0) return;
    const container = scrollRef.current;
    const el = container?.querySelector(`[data-find="${findIndex}"]`);
    if (!(container && el instanceof HTMLElement)) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    container.scrollTop += eRect.top - cRect.top - cRect.height / 2;
  }, [find.open, findIndex, findMatches]);

  const stepFind = (dir: -1 | 1) => {
    if (findMatches.length === 0) return;
    setFind((f) => ({ ...f, index: (findIndex + dir + findMatches.length) % findMatches.length }));
  };

  /* Follow-along: the spoken verse scrolls into view when it drifts out
   * of frame, gently; a verse already visible stays where the reader put
   * it. */
  useEffect(() => {
    if (spokenVerse === null) return;
    const container = scrollRef.current;
    const el = container?.querySelector(`[data-verse="${spokenVerse}"]`);
    if (!(container && el instanceof HTMLElement)) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    if (eRect.top >= cRect.top + 32 && eRect.bottom <= cRect.bottom - 8) return;
    container.scrollTo({
      top: container.scrollTop + eRect.top - cRect.top - cRect.height / 3,
      behavior: "smooth",
    });
  }, [spokenVerse]);

  const closeFind = () => setFind({ open: false, q: "", index: 0 });

  /** The verse text with its find matches marked; untouched when find is off. */
  const markFind = (verse: number, text: string): ReactNode => {
    const spans = findByVerse.get(verse);
    if (!spans || spans.length === 0) return text;
    const out: ReactNode[] = [];
    let pos = 0;
    for (const s of spans) {
      if (s.start > pos) out.push(text.slice(pos, s.start));
      out.push(
        <mark
          key={s.gi}
          data-find={s.gi}
          className={s.gi === findIndex ? "find-match find-current" : "find-match"}
        >
          {text.slice(s.start, s.end)}
        </mark>
      );
      pos = s.end;
    }
    if (pos < text.length) out.push(text.slice(pos));
    return out;
  };

  // The pane's trail: back and forward in the header walk it.
  const trail = paneLeaf?.history;
  const canBack = (trail?.index ?? -1) > 0;
  const canForward = trail !== undefined && trail.index < trail.entries.length - 1;

  /** A tap selects; a drag selection of text is left alone. */
  const tapVerse = (verse: number) => {
    const s = window.getSelection();
    if (s && !s.isCollapsed) return;
    dispatch({ type: "selectVerse", book, chapter, verse });
  };

  const wordFromTagged = (verse: number, w: TaggedWord): Omit<WordSelection, "kind"> => ({
    book,
    chapter,
    verse,
    text: w.t,
    strongs: (w.s ?? []).map(baseStrongs),
  });

  const wordFromOriginal = (verse: number, w: OriginalWord): Omit<WordSelection, "kind"> => ({
    book,
    chapter,
    verse,
    text: w.t,
    strongs: (w.s ?? []).map(baseStrongs),
    lemma: w.l,
    xlit: w.x,
    morph: w.md,
    gloss: w.g ?? w.dg,
  });

  const tapTaggedWord = (verse: number, w: TaggedWord) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!w.s || w.s.length === 0) return;
    dispatch({ type: "selectWord", word: wordFromTagged(verse, w) });
  };

  const tapOriginalWord = (verse: number, w: OriginalWord) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    dispatch({ type: "selectWord", word: wordFromOriginal(verse, w) });
  };

  /* Right-click: the custom menu, unless a live text selection owns the
   * gesture (then the native menu and the selection toolbar keep it). */
  const openVerseMenu = (verse: number) => (e: ReactMouseEvent) => {
    const s = window.getSelection();
    if (s && !s.isCollapsed) return;
    e.preventDefault();
    setMenu({ kind: "verse", x: e.clientX, y: e.clientY, verse });
  };

  const openWordMenu = (word: Omit<WordSelection, "kind">) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (word.strongs.length === 0) return;
    const s = window.getSelection();
    if (s && !s.isCollapsed) return;
    e.preventDefault();
    setMenu({ kind: "word", x: e.clientX, y: e.clientY, word: { kind: "word", ...word } });
  };

  /* Keylinking: a double-click opens the lexicon dock at the word's base
   * Strong's entry. Single-tap behavior is untouched; the native selection
   * the gesture makes is dropped and hushed so it raises no toolbar. */
  const keylink = (strongs: string[]) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    const first = strongs.map(baseStrongs)[0];
    if (!first) return;
    suppressSelUntil.current = Date.now() + 500;
    window.getSelection()?.removeAllRanges();
    setMenu((m) => (m?.kind === "selection" ? null : m));
    dispatch({ type: "openLexicon", id: first.toUpperCase() });
  };

  const isActiveWord = (verse: number, text: string) =>
    selHere?.kind === "word" && selHere.verse === verse && selHere.text === text;

  const verseClass = (v: number) => {
    const mark = markByVerse.get(v);
    const filter = filterByVerse.get(v);
    return [
      "verse-target",
      mark ? styleClass(mark) : "",
      filter ? `vf-${filter.color}` : "",
      notesByVerse.has(v) ? "has-note" : "",
      selVerse === v ? "verse-selected" : "",
      hoverVerses && v >= hoverVerses.from && v <= hoverVerses.to ? "ref-hover" : "",
      spokenVerse === v ? "read-aloud" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  /* A custom style names its color inline; built-ins carry theirs in the
   * legacy class, so old marks render identically. */
  const verseMarkVar = (v: number) => {
    const mark = markByVerse.get(v);
    return mark ? (styleColorVar(mark) as CSSProperties | undefined) : undefined;
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
        onMark={(id) => setHighlight(book, chapter, selVerse, id)}
        onClearMark={() => clearHighlight(book, chapter, selVerse)}
      />
    ) : null;

  const renderPlainVerse = (v: Verse) => (
    <span
      key={v.verse}
      data-verse={v.verse}
      className={verseClass(v.verse)}
      style={verseMarkVar(v.verse)}
      onClick={() => tapVerse(v.verse)}
      onContextMenu={openVerseMenu(v.verse)}
    >
      {!textOnly && <VerseNum label={v.label ?? v.verse} verse={v.verse} onTap={tapVerse} />}
      {markFind(v.verse, v.text)}{" "}
    </span>
  );

  const renderTaggedVerse = (v: TaggedVerse) => (
    <span
      key={v.verse}
      data-verse={v.verse}
      className={verseClass(v.verse)}
      style={verseMarkVar(v.verse)}
      onClick={() => tapVerse(v.verse)}
      onContextMenu={openVerseMenu(v.verse)}
    >
      {!textOnly && <VerseNum label={v.verse} verse={v.verse} onTap={tapVerse} />}
      {v.words.map((w, i) => (
        <span key={i}>
          {w.s && w.s.length > 0 ? (
            <span
              className={`tagged-word armed ${isActiveWord(v.verse, w.t) ? "word-active" : ""}`}
              onClick={tapTaggedWord(v.verse, w)}
              onDoubleClick={keylink(w.s)}
              onContextMenu={openWordMenu(wordFromTagged(v.verse, w))}
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
        onDoubleClick={w.s && w.s.length > 0 ? keylink(w.s) : undefined}
        onContextMenu={
          w.s && w.s.length > 0 ? openWordMenu(wordFromOriginal(verse, w)) : undefined
        }
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
   * beneath it without nesting a block inside the paragraph. Pericope
   * headings ride in front of their first verse. */
  const renderFlow = (verses: Verse[] | TaggedVerse[], tagged: boolean) => {
    const render = tagged
      ? (v: Verse | TaggedVerse) => renderTaggedVerse(v as TaggedVerse)
      : (v: Verse | TaggedVerse) => renderPlainVerse(v as Verse);
    const withHeading = (v: Verse | TaggedVerse) => (
      <Fragment key={v.verse}>
        {pericopeHeading(v.verse)}
        {render(v)}
      </Fragment>
    );
    const idx = selVerse === null ? -1 : verses.findIndex((v) => v.verse === selVerse);
    if (idx < 0) {
      return (
        <p className="prose-verses mx-auto max-w-prose px-6 py-6">{verses.map(withHeading)}</p>
      );
    }
    return (
      <>
        <p className="prose-verses mx-auto max-w-prose px-6 pt-6 pb-4">
          {verses.slice(0, idx + 1).map(withHeading)}
        </p>
        {stripNode}
        {idx + 1 < verses.length && (
          <p className="prose-verses mx-auto max-w-prose px-6 pt-4 pb-6">
            {verses.slice(idx + 1).map(withHeading)}
          </p>
        )}
      </>
    );
  };

  const renderPoetry = (verses: Verse[]) => (
    <div className="poetry-verses mx-auto max-w-prose px-6 py-6">
      {verses.map((v) => (
        <Fragment key={v.verse}>
          {pericopeHeading(v.verse)}
          <div
            className={`verse-line ${verseClass(v.verse)}`}
            style={verseMarkVar(v.verse)}
            data-verse={v.verse}
            onClick={() => tapVerse(v.verse)}
            onContextMenu={openVerseMenu(v.verse)}
          >
            {!textOnly && <VerseNum label={v.label ?? v.verse} verse={v.verse} onTap={tapVerse} />}
            {v.label && (
              <span className="font-[family-name:var(--font-interface)] text-xs text-muted">
                {v.label}{" "}
              </span>
            )}
            {markFind(v.verse, v.text)}
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
              style={verseMarkVar(v.verse)}
              data-verse={v.verse}
              onClick={() => tapVerse(v.verse)}
              onContextMenu={openVerseMenu(v.verse)}
            >
              {!textOnly && <VerseNum label={v.verse} verse={v.verse} onTap={tapVerse} />}
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
      body =
        data.poetry || verseLines ? renderPoetry(data.verses) : renderFlow(data.verses, false);
    }
  }

  const toggleBtn = (on: boolean) =>
    `border px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
      on ? "border-sapphire text-sapphire" : "border-rule text-muted hover:text-ink"
    }`;

  /* The locator's pericope controls: back answers while a passage start sits
   * above the reading position, forward while one sits below. */
  const pericopeStart = pericopeOffsets.current[locator.current];
  const canPrevPericope =
    ready !== null &&
    ready.pericopes.length > 0 &&
    (locator.current > 0 || (pericopeStart != null && locator.top > pericopeStart + 24));
  const canNextPericope = ready !== null && locator.current < ready.pericopes.length - 1;
  const currentPericope = ready ? (ready.pericopes[locator.current] ?? null) : null;

  /* The floating menus, shared by the workspace frame and the reading
   * overlay so a right-click answers the same way in both. */
  const menus = (
    <>
      {menu && ready && menu.kind === "verse" && (
        <VerseContextMenu
          x={menu.x}
          y={menu.y}
          paneId={paneId}
          book={book}
          chapter={chapter}
          verse={menu.verse}
          bookName={ready.bookName}
          text={verseText(menu.verse)}
          hasOriginal={ready.hasOriginal}
          onClose={closeMenu}
        />
      )}
      {menu && ready && menu.kind === "word" && (
        <WordContextMenu
          x={menu.x}
          y={menu.y}
          paneId={paneId}
          bookName={ready.bookName}
          word={menu.word}
          onClose={closeMenu}
        />
      )}
      {menu && ready && menu.kind === "selection" && (
        <SelectionMenu
          x={menu.x}
          y={menu.y}
          paneId={paneId}
          book={book}
          chapter={chapter}
          verse={menu.verse}
          bookName={ready.bookName}
          abbrev={ready.translation}
          text={menu.text}
          onClose={closeMenu}
        />
      )}
    </>
  );

  /* Reading view: this pane's text over the whole window. Rail, sidebar,
   * dock, and pane chrome stay mounted beneath the overlay, so nothing in
   * the workspace state moves. Escape or the exit control returns; the
   * chapter arrows keep paging without leaving. */
  if (reading) {
    return (
      <div className="reader-surface fixed inset-0 z-40 flex flex-col" style={scaleStyle}>
        <header className="flex h-9 shrink-0 items-center border-b border-rule px-6 font-[family-name:var(--font-interface)]">
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
          </h2>
          <div className="flex flex-1 items-center justify-end">
            <button
              type="button"
              title="Return to the workspace"
              onClick={() => setReading(false)}
              className={toggleBtn(false)}
            >
              Exit
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        {menus}
      </div>
    );
  }

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col" style={scaleStyle}>
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <div className="flex flex-1 items-center gap-0.5">
          <button
            type="button"
            title="Back to the passage this pane showed"
            aria-label="Back"
            disabled={!canBack}
            onClick={() => dispatch({ type: "navigateBack", paneId })}
            className="px-1.5 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ←
          </button>
          <button
            type="button"
            title="Forward to the passage this pane came back from"
            aria-label="Forward"
            disabled={!canForward}
            onClick={() => dispatch({ type: "navigateForward", paneId })}
            className="px-1.5 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            →
          </button>
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
          {ready && shelfOptions.length > 1 ? (
            <select
              aria-label="Translation"
              title="Read this chapter in another translation"
              value={ready.translationId}
              onChange={(e) => swapTranslation(e.target.value)}
              className="small-caps ml-2 cursor-pointer border border-transparent bg-transparent text-[0.6rem] font-normal text-muted hover:border-rule focus:border-sapphire focus:outline-none"
            >
              {shelfOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abbrev}
                </option>
              ))}
            </select>
          ) : (
            ready && (
              <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">
                {ready.translation}
              </span>
            )
          )}
        </h2>
        <div className="flex flex-1 items-center justify-end gap-1">
          <span className="flex items-center" role="group" aria-label="Text size">
            <button
              type="button"
              title="Smaller text"
              aria-label="Smaller text"
              disabled={scaleStep <= 1}
              onClick={() => stepScale(-1)}
              className="border border-rule px-1.5 py-0.5 text-[0.6rem] font-medium text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              A−
            </button>
            <button
              type="button"
              title="Larger text"
              aria-label="Larger text"
              disabled={scaleStep >= 5}
              onClick={() => stepScale(1)}
              className="border-y border-r border-rule px-1.5 py-0.5 text-[0.75rem] font-medium text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              A+
            </button>
          </span>
          {ready && view === "text" && !wordsOn && (
            <button
              type="button"
              aria-pressed={find.open}
              title="Find in this chapter"
              onClick={() => setFind((f) => ({ open: !f.open, q: "", index: 0 }))}
              className={toggleBtn(find.open)}
            >
              Find
            </button>
          )}
          {ready && (ready.audio !== null || speechOk) && (
            <button
              type="button"
              aria-pressed={listen !== "idle"}
              title={
                ready.audio
                  ? "Listen to this chapter read from the LibriVox recording"
                  : "Read this chapter aloud with the system voice"
              }
              onClick={toggleListen}
              className={toggleBtn(listen !== "idle")}
            >
              Listen
            </button>
          )}
          <button
            type="button"
            aria-pressed={insightsOn}
            title="Resource cards for this chapter, gathered beside the text"
            onClick={() => setInsightsOn(!insightsOn)}
            className={toggleBtn(insightsOn)}
          >
            Insights
          </button>
          <button
            type="button"
            title="Compare every translation of this chapter, word by word"
            onClick={() => dispatch({ type: "openTextCompare", book, chapter, paneId })}
            className={toggleBtn(false)}
          >
            Compare
          </button>
          <button
            type="button"
            title="Open the Passage Guide for this chapter"
            onClick={() => dispatch({ type: "openGuide", book, chapter, paneId })}
            className={toggleBtn(false)}
          >
            Guide
          </button>
          {ready && ready.hasOriginal && (
            <button
              type="button"
              title="Open the Exegetical Guide for this chapter"
              onClick={() => dispatch({ type: "openExegetical", book, chapter, paneId })}
              className={toggleBtn(false)}
            >
              Exegetical
            </button>
          )}
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
          {ready && view === "text" && (
            <button
              type="button"
              aria-pressed={textOnly}
              title="Hide the verse numbers for reading"
              onClick={() => setTextOnly(!textOnly)}
              className={toggleBtn(textOnly)}
            >
              Text only
            </button>
          )}
          {ready && view === "text" && ready.pericopes.length > 0 && (
            <button
              type="button"
              aria-pressed={headingsOn}
              title="Pericope headings over the passages they name"
              onClick={() => setHeadingsOn(!headingsOn)}
              className={toggleBtn(headingsOn)}
            >
              Headings
            </button>
          )}
          {ready && view === "text" && !ready.poetry && (
            <button
              type="button"
              aria-pressed={verseLines}
              title="One verse per line"
              onClick={() => setVerseLines(!verseLines)}
              className={toggleBtn(verseLines)}
            >
              Lines
            </button>
          )}
          {ready && (
            <button
              type="button"
              title="Distraction-free reading over the whole window; Escape exits"
              onClick={() => setReading(true)}
              className={toggleBtn(false)}
            >
              Reading
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
      {ready && (
        /* The locator: the chapter's scroll progress as a rail, pericope
         * starts as ticks that jump to their passage, and the pericope at the
         * reading position named at the right edge. */
        <div className="flex h-6 shrink-0 items-center gap-2 border-b border-rule px-4 font-[family-name:var(--font-interface)]">
          {ready.pericopes.length > 0 && (
            <span className="flex items-center" role="group" aria-label="Pericope navigation">
              <button
                type="button"
                title="Previous pericope"
                aria-label="Previous pericope"
                disabled={!canPrevPericope}
                onClick={() => stepPericope(-1)}
                className="px-1 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                ‹
              </button>
              <button
                type="button"
                title="Next pericope"
                aria-label="Next pericope"
                disabled={!canNextPericope}
                onClick={() => stepPericope(1)}
                className="px-1 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                ›
              </button>
            </span>
          )}
          <div className="relative h-1 flex-1 rounded-full bg-rule">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-sapphire/50"
              style={{ width: `${locator.progress * 100}%` }}
            />
            {ready.pericopes.map((p, i) => {
              const f = pericopeTicks[i];
              if (f === null || f === undefined) return null;
              return (
                <button
                  key={p.verse}
                  type="button"
                  title={`${p.heading} (verse ${p.verse})`}
                  aria-label={`Go to ${p.heading}`}
                  onClick={() => scrollToVerse(p.verse)}
                  className="absolute top-1/2 h-2.5 w-1 -translate-x-1/2 -translate-y-1/2 bg-muted hover:bg-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  style={{ left: `${f * 100}%` }}
                />
              );
            })}
          </div>
          <span
            className="small-caps max-w-44 truncate text-[0.6rem] text-muted"
            title={
              currentPericope
                ? `${currentPericope.heading}${currentPericope.parallels ? ` (${currentPericope.parallels})` : ""}`
                : undefined
            }
          >
            {currentPericope ? currentPericope.heading : "\u00A0"}
          </span>
        </div>
      )}
      {find.open && (
        <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-rule px-4">
          <input
            autoFocus
            type="text"
            value={find.q}
            onChange={(e) => setFind({ open: true, q: e.target.value, index: 0 })}
            onKeyDown={(e) => {
              if (e.key === "Enter") stepFind(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") closeFind();
            }}
            placeholder="Find in this chapter"
            aria-label="Find in this chapter"
            className="w-44 border border-rule bg-transparent px-1.5 py-0.5 text-[0.72rem] text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
          />
          <span className="min-w-14 text-[0.65rem] text-muted">
            {find.q.trim()
              ? findMatches.length > 0
                ? `${findIndex + 1} of ${findMatches.length}`
                : "No matches"
              : ""}
          </span>
          <button
            type="button"
            title="Previous match"
            aria-label="Previous match"
            disabled={findMatches.length === 0}
            onClick={() => stepFind(-1)}
            className="px-1 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ‹
          </button>
          <button
            type="button"
            title="Next match"
            aria-label="Next match"
            disabled={findMatches.length === 0}
            onClick={() => stepFind(1)}
            className="px-1 text-muted hover:text-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ›
          </button>
          <button
            type="button"
            title="Close find"
            aria-label="Close find"
            onClick={closeFind}
            className="px-1 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ×
          </button>
        </div>
      )}
      {listen !== "idle" && ready && (
        /* The listen bar: pause, speed, and stop for whichever source is
         * playing, with the recording's provenance or the fallback named. */
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-rule px-4 font-[family-name:var(--font-interface)]">
          <span className="small-caps text-[0.68rem] text-muted">Listen</span>
          <button
            type="button"
            title={listenPaused ? "Resume" : "Pause"}
            aria-label={listenPaused ? "Resume" : "Pause"}
            onClick={toggleListenPause}
            className="px-1 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            {listenPaused ? "▶" : "❚❚"}
          </button>
          <select
            aria-label="Reading speed"
            title="Reading speed"
            value={listenRate}
            onChange={(e) => changeListenRate(Number(e.target.value))}
            className="cursor-pointer border border-transparent bg-transparent text-[0.65rem] text-muted hover:border-rule focus:border-sapphire focus:outline-none"
          >
            {[0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
          <span className="min-w-0 flex-1 truncate text-[0.65rem] text-muted">
            {listen === "record" && ready.audio ? (
              <>
                {ready.audio.reader ? `Read by ${ready.audio.reader}. ` : ""}
                LibriVox recording, public domain, streamed from{" "}
                <a
                  href={ready.audio.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sapphire no-underline hover:underline"
                >
                  archive.org
                </a>
                .
              </>
            ) : (
              "System voice, verse by verse."
            )}
          </span>
          <button
            type="button"
            title="Stop"
            aria-label="Stop"
            onClick={stopAudio}
            className="px-1 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ×
          </button>
        </div>
      )}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {insightsOn && <InsightsRail paneId={paneId} book={book} chapter={chapter} />}
        {body}
      </div>
      {menus}
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
  mark: ResolvedStyle | undefined;
  verseNotes: MarginNote[];
  onMark: (styleId: string) => void;
  onClearMark: () => void;
}) {
  const { dispatch } = useWorkspace();
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [notebook, setNotebook] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reference = `${bookName} ${chapter}:${verse}`;

  // A retargeted strip starts closed.
  const target = `${book}:${chapter}:${verse}`;
  useEffect(() => {
    setNoteOpen(false);
    setDraft("");
    setNotebook("");
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
    setNotebook(existing?.notebook ?? "");
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
      notebook,
    });
    setNoteOpen(false);
    setDraft("");
    setNotebook("");
    setEditingId(null);
  };

  const copy = () => {
    navigator.clipboard
      ?.writeText(formatCitation(text, reference))
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
            <StylePalette activeId={mark?.id} onPick={onMark} />
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
                className="border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus:outline-sapphire"
              >
                Save note
              </button>
              <NotebookPicker value={notebook} onChange={setNotebook} />
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
