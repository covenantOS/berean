"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MarginNote,
  deleteNote,
  isAnchored,
  listNotes,
  saveNote,
} from "@/lib/marginalia";
import { verseCardSvg } from "@/lib/verseCard";

type Mode = "paper" | "warm" | "evening";
type PanelTab = "margin" | "refs" | "shelf" | "word";
type Lang = "hebrew" | "greek";
const MODE_KEY = "berean.readerMode.v1";
const WORDS_KEY = "berean.originalWords.v1";
const ORIG_KEY = "berean.originalText.v1";
const IL_KEY = "berean.interlinear.v1";

interface Verse {
  verse: number;
  text: string;
  /** Source label when it is not the plain number, e.g. "1b" (LXX additions). */
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

/** One word of TAHOT/TAGNT original text, with morphology pre-decoded server-side. */
interface OriginalWord {
  t: string;
  s?: string[];
  m?: string;
  x?: string;
  g?: string;
  l?: string;
  r?: string;
  dg?: string;
  e?: string[];
  /** Human-readable morphology, decoded on the server. */
  md?: string;
}

interface OriginalVerse {
  verse: number;
  alt?: string;
  words: OriginalWord[];
}

/** The word currently pinned in the Word panel. */
interface ActiveWord {
  text: string;
  strongs: string[];
  lemma?: string;
  xlit?: string;
  morphCode?: string;
  morphText?: string;
  gloss?: string;
  dg?: string;
  /** TAGNT editions this word is absent from, e.g. ["TR", "Byz"]. */
  notInEditions?: string[];
}

interface CrossRef {
  ref: string;
  slug: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  votes: number;
}

interface CommentarySection {
  verses: string;
  text: string;
}

interface CommentaryWorkSections {
  work: { id: string; label: string };
  sections: CommentarySection[];
}

interface EntityMention {
  id: string;
  name: string;
  kind: "person" | "place" | "other";
  type: string;
  brief: string;
}

interface VerseTopicMention {
  work: "naves" | "torreys";
  id: string;
  title: string;
}

interface TranslationOption {
  id: string;
  abbrev: string;
  name: string;
}

interface LexiconEntry {
  id: string;
  lemma?: string;
  xlit?: string;
  pron?: string;
  derivation?: string;
  strongs_def?: string;
  kjv_def?: string;
}

export default function ChapterReader({
  bookSlug,
  bookName,
  chapter,
  verses,
  poetry,
  heading,
  translationId,
  translationAbbrev,
  translations,
  parallel,
  parallelRequested,
  parallelNote,
  tagged,
  original,
  lang,
  crossrefs,
  commentary,
  entities,
  verseTopics,
  audio,
}: {
  bookSlug: string;
  bookName: string;
  chapter: number;
  verses: Verse[];
  poetry: boolean;
  heading: string;
  translationId: string;
  translationAbbrev: string;
  translations: TranslationOption[];
  parallel: { id: string; abbrev: string; verses: Verse[] } | null;
  /** Set when a parallel was asked for but has no text for this chapter
   *  (e.g. the LXX has no Malachi 4); the notice says why. */
  parallelRequested: { id: string; abbrev: string } | null;
  /** Numbering-divergence notice for LXX columns, or null. */
  parallelNote: string | null;
  tagged: TaggedVerse[] | null;
  original: OriginalVerse[] | null;
  lang: Lang;
  crossrefs: Record<number, CrossRef[]> | null;
  commentary: CommentaryWorkSections[];
  entities: Record<number, EntityMention[]> | null;
  verseTopics: Record<number, VerseTopicMention[]> | null;
  /** This chapter's public-domain recording, or null when none is mapped. */
  audio: { url: string; reader: string | null; seconds: number | null; sourceUrl: string } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("paper");
  const [tab, setTab] = useState<PanelTab>("margin");
  const [notes, setNotes] = useState<MarginNote[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wordsOn, setWordsOn] = useState(false);
  const [origOn, setOrigOn] = useState(false);
  const [interlinear, setInterlinear] = useState({ gloss: true, xlit: false });
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null);
  const [wordEntries, setWordEntries] = useState<LexiconEntry[]>([]);
  const [wordLoading, setWordLoading] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(MODE_KEY) as Mode | null;
    if (stored === "warm" || stored === "evening") setMode(stored);
    setWordsOn(window.localStorage.getItem(WORDS_KEY) === "1");
    setOrigOn(window.localStorage.getItem(ORIG_KEY) === "1");
    const il = window.localStorage.getItem(IL_KEY);
    if (il !== null) setInterlinear({ gloss: il.includes("g"), xlit: il.includes("x") });
    setNotes(listNotes(bookSlug, chapter));
    setSelectedVerse(null);
    setActiveWord(null);
  }, [bookSlug, chapter]);

  // Escape closes a pinned word, the same way an outside tap returns to the margin.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && activeWord) {
        setActiveWord(null);
        setTab("margin");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeWord]);

  function changeMode(m: Mode) {
    setMode(m);
    window.localStorage.setItem(MODE_KEY, m);
  }

  function toggleWords() {
    const next = !wordsOn;
    setWordsOn(next);
    window.localStorage.setItem(WORDS_KEY, next ? "1" : "0");
  }

  function toggleOrig() {
    const next = !origOn;
    setOrigOn(next);
    window.localStorage.setItem(ORIG_KEY, next ? "1" : "0");
  }

  function toggleInterlinear(key: "gloss" | "xlit") {
    setInterlinear((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      window.localStorage.setItem(
        IL_KEY,
        `${next.gloss ? "g" : ""}${next.xlit ? "x" : ""}`
      );
      return next;
    });
  }

  const notedVerses = useMemo(
    () => new Set(notes.filter(isAnchored).map((n) => n.verse)),
    [notes]
  );
  const refVerses = useMemo(
    () =>
      crossrefs
        ? Object.keys(crossrefs)
            .map(Number)
            .sort((a, b) => a - b)
        : [],
    [crossrefs]
  );

  function navigate(t: string, p: string) {
    const q = new URLSearchParams();
    if (t !== "kjv") q.set("t", t);
    if (p) q.set("p", p);
    const qs = q.toString();
    router.push(`/read/${bookSlug}/${chapter}${qs ? `?${qs}` : ""}`);
  }

  function openVerse(v: number) {
    if (selectedVerse === v) {
      setSelectedVerse(null);
      return;
    }
    setSelectedVerse(v);
    const existing = notes.find((n) => n.verse === v);
    setDraft(existing?.text ?? "");
    setEditingId(existing?.id ?? null);
    if (tab === "word") setTab("margin");
  }

  /** Base Strong's id the lexicon knows, from an extended id like "H7225G". */
  function baseStrongs(id: string): string {
    const m = id.match(/^([GH]\d+?)[A-Z]?$/);
    return m ? m[1] : id;
  }

  async function openWord(word: ActiveWord) {
    setActiveWord(word);
    setTab("word");
    if (word.strongs.length === 0) {
      setWordEntries([]);
      return;
    }
    setWordLoading(true);
    try {
      const entries = await Promise.all(
        word.strongs.map(async (id) => {
          const res = await fetch(`/api/lexicon/${id}`);
          if (!res.ok) return null;
          return (await res.json()) as LexiconEntry;
        })
      );
      setWordEntries(entries.filter(Boolean) as LexiconEntry[]);
    } finally {
      setWordLoading(false);
    }
  }

  function tapWord(w: TaggedWord) {
    if (!w.s || w.s.length === 0) return;
    openWord({ text: w.t, strongs: w.s });
  }

  /** TAGNT edition witnesses; a word's absence is noted, never its presence. */
  const ALL_EDITIONS = ["NA28", "NA27", "Tyn", "SBL", "WH", "Treg", "TR", "Byz"];

  function tapOriginalWord(w: OriginalWord) {
    openWord({
      text: w.t,
      strongs: (w.s ?? []).map(baseStrongs),
      lemma: w.l,
      xlit: w.x,
      morphCode: w.m,
      morphText: w.md,
      gloss: w.g,
      dg: w.dg,
      notInEditions: w.e ? ALL_EDITIONS.filter((ed) => !w.e!.includes(ed)) : undefined,
    });
  }

  function submitNote() {
    if (!selectedVerse || !draft.trim()) return;
    saveNote({
      id: editingId ?? undefined,
      book: bookSlug,
      chapter,
      verse: selectedVerse,
      text: draft.trim(),
    });
    setNotes(listNotes(bookSlug, chapter));
    setSelectedVerse(null);
    setDraft("");
    setEditingId(null);
  }

  function removeNote(id: string) {
    deleteNote(id);
    setNotes(listNotes(bookSlug, chapter));
    setSelectedVerse(null);
    setEditingId(null);
  }

  /** Print/export aid: the selected verse as a letterpress card, downloaded
   *  as SVG. No engagement mechanics; the card carries only text, reference,
   *  and translation tag. */
  function exportCard() {
    if (selectedVerse === null) return;
    const entries = baseByVerse.get(selectedVerse) ?? [];
    if (entries.length === 0) return;
    const text = entries
      .map((v) => (v.label ? `${v.label} ${v.text}` : v.text))
      .join(" ");
    const reference = `${bookName} ${chapter}:${selectedVerse}`;
    const svg = verseCardSvg(text, reference, translationAbbrev);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bookSlug}-${chapter}-${selectedVerse}-${translationAbbrev.toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const showTagged = wordsOn && !parallel && translationId === "kjv" && tagged !== null;
  const showOriginal = origOn && !parallel && original !== null;
  const parallelId = parallel?.id ?? parallelRequested?.id ?? "";
  const parallelByVerse = useMemo(() => {
    const m = new Map<number, Verse[]>();
    parallel?.verses.forEach((v) => {
      const arr = m.get(v.verse) ?? [];
      arr.push(v);
      m.set(v.verse, arr);
    });
    return m;
  }, [parallel]);
  const baseByVerse = useMemo(() => {
    const m = new Map<number, Verse[]>();
    verses.forEach((v) => {
      const arr = m.get(v.verse) ?? [];
      arr.push(v);
      m.set(v.verse, arr);
    });
    return m;
  }, [verses]);
  /** Union of both columns' verse numbers, so LXX-only verses show in place
   *  and missing ones leave an honest gap. */
  const rowNumbers = useMemo(
    () =>
      parallel
        ? [...new Set([...baseByVerse.keys(), ...parallelByVerse.keys()])].sort((a, b) => a - b)
        : [],
    [parallel, baseByVerse, parallelByVerse]
  );

  const verseClass = (v: number) =>
    `verse-target ${notedVerses.has(v) ? "has-note" : ""} ${
      selectedVerse === v ? "verse-selected" : ""
    }`;

  /** One original word: the surface text over its configurable interlinear line. */
  function renderOrigWord(w: OriginalWord, i: number) {
    const sub = [
      interlinear.gloss && w.g ? w.g : null,
      interlinear.xlit && w.x ? w.x : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <span
        key={i}
        className={`orig-word tagged-word ${
          activeWord?.text === w.t && tab === "word" ? "word-active" : ""
        }`}
        onClick={() => tapOriginalWord(w)}
      >
        <span className={lang === "hebrew" ? "lang-hebrew" : "lang-greek"}>{w.t}</span>
        {sub && (
          <span className="orig-sub" dir="ltr">
            {sub}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <article
        className="reader-surface rounded-[4px] border border-rule px-5 py-8 sm:px-10 sm:py-10"
        data-mode={mode === "paper" ? undefined : mode}
      >
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-editorial text-2xl font-bold sm:text-3xl">{heading}</h1>
          <div className="flex flex-wrap items-center gap-2 font-[family-name:var(--font-interface)]">
            <select
              value={translationId}
              onChange={(e) => navigate(e.target.value, parallelId)}
              aria-label="Translation"
              className="rounded-[4px] border border-rule bg-transparent px-2 py-1 text-xs"
            >
              {translations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abbrev}
                </option>
              ))}
            </select>
            {translations.length > 1 && (
              <select
                value={parallelId}
                onChange={(e) => navigate(translationId, e.target.value)}
                aria-label="Parallel translation"
                className="rounded-[4px] border border-rule bg-transparent px-2 py-1 text-xs"
              >
                <option value="">— parallel —</option>
                {translations
                  .filter((t) => t.id !== translationId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      ∥ {t.abbrev}
                    </option>
                  ))}
              </select>
            )}
            {translationId === "kjv" && tagged !== null && !parallel && (
              <button
                onClick={toggleWords}
                aria-pressed={wordsOn}
                title="Rest on a word and the Greek or Hebrew beneath it surfaces"
                className={`rounded-[4px] border border-rule px-2 py-1 text-xs ${
                  wordsOn ? "bg-sapphire text-white" : "opacity-70 hover:opacity-100"
                }`}
              >
                Original words
              </button>
            )}
            {original !== null && !parallel && (
              <button
                onClick={toggleOrig}
                aria-pressed={origOn}
                title={lang === "hebrew" ? "Read the Hebrew text (TAHOT)" : "Read the Greek text (TAGNT)"}
                className={`rounded-[4px] border border-rule px-2 py-1 text-xs ${
                  origOn ? "bg-sapphire text-white" : "opacity-70 hover:opacity-100"
                }`}
              >
                {lang === "hebrew" ? "עברית" : "Ἑλληνικά"} text
              </button>
            )}
            {showOriginal && (
              <div
                className="flex gap-1 rounded-[4px] border border-rule p-0.5 text-xs"
                role="group"
                aria-label="Interlinear line"
              >
                {(
                  [
                    ["gloss", "Gloss"],
                    ["xlit", "Translit."],
                  ] as ["gloss" | "xlit", string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleInterlinear(key)}
                    aria-pressed={interlinear[key]}
                    className={`rounded-[3px] px-2 py-1 ${
                      interlinear[key] ? "bg-sapphire text-white" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div
              className="flex gap-1 rounded-[4px] border border-rule p-0.5 text-xs"
              role="group"
              aria-label="Reading mode"
            >
              {(
                [
                  ["paper", "Paper"],
                  ["warm", "Warm"],
                  ["evening", "Evening"],
                ] as [Mode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => changeMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-[3px] px-2 py-1 ${
                    mode === m ? "bg-sapphire text-white" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {audio && (
          <div className="no-print mb-6 rounded-[4px] border border-rule bg-surface px-3 py-2 font-[family-name:var(--font-interface)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="small-caps text-[0.68rem] text-muted">Listen</span>
              <audio
                key={audio.url}
                controls
                preload="none"
                src={audio.url}
                className="h-8 min-w-0 flex-1"
              >
                Your browser does not support audio playback.
              </audio>
            </div>
            <p className="mt-1 text-[0.68rem] text-muted">
              {audio.reader ? `Read by ${audio.reader}. ` : ""}
              LibriVox recording, public domain, streamed from{" "}
              <a
                href={audio.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sapphire no-underline hover:underline"
              >
                archive.org
              </a>
              .
            </p>
          </div>
        )}

        {parallelNote && (
          <p className="no-print mb-4 rounded-[4px] border border-rule bg-surface px-3 py-2 font-[family-name:var(--font-interface)] text-xs text-muted">
            {parallelNote}
          </p>
        )}

        {parallel ? (
          <div className="text-[1.02rem] leading-relaxed">
            <div className="mb-3 grid grid-cols-2 gap-6 border-b border-rule pb-2 font-[family-name:var(--font-interface)] text-xs font-semibold text-muted">
              <span>{translationAbbrev}</span>
              <span>{parallel.abbrev}</span>
            </div>
            {rowNumbers.map((n) => {
              const left = baseByVerse.get(n);
              const right = parallelByVerse.get(n);
              return (
                <div
                  key={n}
                  id={`v${n}`}
                  className={`grid grid-cols-2 gap-6 border-b border-rule/60 py-2 ${verseClass(n)}`}
                >
                  <p>
                    {left ? (
                      left.map((v, i) => (
                        <span key={i}>
                          {i === 0 && <VerseNum n={n} onClick={() => openVerse(n)} />}
                          {v.label && (
                            <span className="font-[family-name:var(--font-interface)] text-xs text-muted">
                              {v.label}{" "}
                            </span>
                          )}
                          {v.text}{" "}
                        </span>
                      ))
                    ) : (
                      <span className="opacity-50">—</span>
                    )}
                  </p>
                  <p className="opacity-90">
                    {right ? (
                      right.map((v, i) => (
                        <span key={i}>
                          {v.label && (
                            <span className="font-[family-name:var(--font-interface)] text-xs text-muted">
                              {v.label}{" "}
                            </span>
                          )}
                          {v.text}{" "}
                        </span>
                      ))
                    ) : (
                      <span className="opacity-50">—</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        ) : showOriginal ? (
          <div
            className="original-verses"
            dir={lang === "hebrew" ? "rtl" : "ltr"}
            lang={lang === "hebrew" ? "he" : "grc"}
          >
            {original!.map((v) =>
              v.verse === 0 ? (
                <p key={0} className="superscription">
                  {v.words.map((w, i) => renderOrigWord(w, i))}
                </p>
              ) : (
                <span key={v.verse} id={`v${v.verse}`} className={verseClass(v.verse)}>
                  <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
                  {v.alt && (
                    <span className="alt-note" dir="ltr">
                      {lang === "hebrew" ? `Heb. ${v.alt}` : `KJV ${v.alt}`}
                    </span>
                  )}
                  {v.words.map((w, i) => renderOrigWord(w, i))}
                </span>
              )
            )}
          </div>
        ) : showTagged ? (
          <p className="prose-verses drop-cap">
            {tagged!.map((v) => (
              <span key={v.verse} id={`v${v.verse}`} className={verseClass(v.verse)}>
                <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
                {v.words.map((w, i) => (
                  <span key={i}>
                    {w.s && w.s.length > 0 ? (
                      <span
                        className={`tagged-word ${
                          activeWord?.text === w.t && tab === "word" ? "word-active" : ""
                        }`}
                        onClick={() => tapWord(w)}
                      >
                        {w.t}
                      </span>
                    ) : (
                      w.t
                    )}{" "}
                  </span>
                ))}
              </span>
            ))}
          </p>
        ) : poetry ? (
          <div className="poetry-verses">
            {verses.map((v, i) => (
              <p key={`${v.verse}:${i}`} id={`v${v.verse}`} className={`verse-line ${verseClass(v.verse)}`}>
                <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
                {v.label && (
                  <span className="font-[family-name:var(--font-interface)] text-xs text-muted">
                    {v.label}{" "}
                  </span>
                )}
                {v.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="prose-verses drop-cap">
            {verses.map((v, i) => (
              <span key={`${v.verse}:${i}`} id={`v${v.verse}`} className={verseClass(v.verse)}>
                <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
                {v.label && (
                  <span className="font-[family-name:var(--font-interface)] text-xs text-muted">
                    {v.label}{" "}
                  </span>
                )}
                {v.text}{" "}
              </span>
            ))}
          </p>
        )}
      </article>

      <aside className="no-print">
        <div className="sticky top-6 rounded-[4px] border border-rule bg-surface">
          <div
            className="flex border-b border-rule text-xs font-medium"
            role="tablist"
            aria-label="Study apparatus"
          >
            {(
              [
                ["margin", "Margin"],
                ["refs", "Refs"],
                ["shelf", "Shelf"],
                ["word", "Word"],
              ] as [PanelTab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2 ${
                  tab === t
                    ? "border-b-2 border-sapphire text-sapphire"
                    : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4">
            {tab === "margin" && (
              <MarginPanel
                bookName={bookName}
                chapter={chapter}
                notes={notes}
                selectedVerse={selectedVerse}
                draft={draft}
                setDraft={setDraft}
                editingId={editingId}
                submitNote={submitNote}
                removeNote={removeNote}
                openVerse={openVerse}
                exportCard={exportCard}
                entities={entities}
                verseTopics={verseTopics}
                cancel={() => {
                  setSelectedVerse(null);
                  setEditingId(null);
                }}
              />
            )}

            {tab === "refs" && (
              <RefsPanel
                crossrefs={crossrefs}
                refVerses={refVerses}
                selectedVerse={selectedVerse}
                openVerse={openVerse}
              />
            )}

            {tab === "shelf" && (
              <ShelfPanel commentary={commentary} selectedVerse={selectedVerse} />
            )}

            {tab === "word" && (
              <WordPanel
                activeWord={activeWord}
                entries={wordEntries}
                loading={wordLoading}
                lang={lang}
                apparatusAvailable={tagged !== null || original !== null}
                wordsOn={wordsOn}
                origOn={showOriginal}
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function MarginPanel(props: {
  bookName: string;
  chapter: number;
  notes: MarginNote[];
  selectedVerse: number | null;
  draft: string;
  setDraft: (s: string) => void;
  editingId: string | null;
  submitNote: () => void;
  removeNote: (id: string) => void;
  openVerse: (v: number) => void;
  exportCard: () => void;
  entities: Record<number, EntityMention[]> | null;
  verseTopics: Record<number, VerseTopicMention[]> | null;
  cancel: () => void;
}) {
  const {
    bookName,
    chapter,
    notes,
    selectedVerse,
    draft,
    setDraft,
    editingId,
    submitNote,
    removeNote,
    openVerse,
    exportCard,
    entities,
    verseTopics,
    cancel,
  } = props;
  const mentions =
    selectedVerse !== null && entities ? (entities[selectedVerse] ?? []) : [];
  const topicMentions =
    selectedVerse !== null && verseTopics ? (verseTopics[selectedVerse] ?? []) : [];
  return (
    <>
      {selectedVerse !== null ? (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium">
            {bookName} {chapter}:{selectedVerse}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            autoFocus
            placeholder="A note in the margin…"
            className="w-full rounded-[4px] border border-rule bg-paper p-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={submitNote}
              disabled={!draft.trim()}
              className="rounded-[4px] bg-ink px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-40"
            >
              {editingId ? "Update note" : "Save note"}
            </button>
            {editingId && (
              <button
                onClick={() => removeNote(editingId)}
                className="rounded-[4px] border border-rule px-3 py-1.5 text-xs font-medium text-ruby"
              >
                Delete
              </button>
            )}
            <button
              onClick={exportCard}
              title="Download this verse as a printable card (SVG)"
              className="rounded-[4px] border border-rule px-3 py-1.5 text-xs font-medium"
            >
              Export card
            </button>
            <button
              onClick={cancel}
              className="rounded-[4px] border border-rule px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-xs text-muted">
          Tap a verse number to write a note. Notes are private and stored only
          on this device.
        </p>
      )}

      {mentions.length > 0 && (
        <div className="mb-4 border-t border-rule pt-3">
          <p className="small-caps mb-2 text-[0.68rem] text-muted">People and places</p>
          <ul className="flex flex-wrap gap-1.5">
            {mentions.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/library/entity/${m.id}`}
                  title={m.brief || (m.kind === "place" ? "Place" : m.type)}
                  className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire no-underline hover:border-sapphire"
                >
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topicMentions.length > 0 && (
        <div className="mb-4 border-t border-rule pt-3">
          <p className="small-caps mb-2 text-[0.68rem] text-muted">Topics</p>
          <ul className="flex flex-wrap gap-1.5">
            {topicMentions.map((m) => (
              <li key={`${m.work}:${m.id}`}>
                <Link
                  href={`/workspace?tab=topicguide:${m.work}:${m.id}`}
                  title={m.work === "naves" ? "Nave's Topical Bible" : "Torrey's New Topical Textbook"}
                  className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire no-underline hover:border-sapphire"
                >
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.length > 0 ? (
        <ul className="space-y-3 border-t border-rule pt-3">
          {notes
            .filter(isAnchored)
            .slice()
            .sort((a, b) => a.verse - b.verse)
            .map((n) => (
              <li key={n.id} className="text-sm">
                <button
                  onClick={() => openVerse(n.verse)}
                  className="font-medium text-sapphire hover:underline"
                >
                  v. {n.verse}
                </button>
                <p className="mt-0.5 whitespace-pre-wrap text-[0.83rem] leading-relaxed text-ink">
                  {n.text}
                </p>
              </li>
            ))}
        </ul>
      ) : (
        <p className="border-t border-rule pt-3 text-xs text-muted">
          No notes on this chapter yet.
        </p>
      )}
    </>
  );
}

function RefsPanel({
  crossrefs,
  refVerses,
  selectedVerse,
  openVerse,
}: {
  crossrefs: Record<number, CrossRef[]> | null;
  refVerses: number[];
  selectedVerse: number | null;
  openVerse: (v: number) => void;
}) {
  if (!crossrefs) {
    return (
      <p className="text-xs text-muted">
        The cross-reference engine is not yet furnished on this installation.
      </p>
    );
  }
  const shown = selectedVerse !== null && crossrefs[selectedVerse] ? [selectedVerse] : refVerses;
  if (shown.length === 0) {
    return <p className="text-xs text-muted">No cross-references recorded for this chapter.</p>;
  }
  return (
    <div className="space-y-4">
      {selectedVerse !== null && !crossrefs[selectedVerse] && (
        <p className="text-xs text-muted">No references on verse {selectedVerse}; showing the chapter.</p>
      )}
      {shown.map((v) => (
        <div key={v}>
          <button
            onClick={() => openVerse(v)}
            className="small-caps mb-1 text-xs font-semibold text-muted hover:text-ink"
          >
            Verse {v}
          </button>
          <ul className="flex flex-wrap gap-1.5">
            {crossrefs[v].map((r, i) => (
              <li key={i}>
                <Link
                  href={`/read/${r.slug}/${r.chapter}#v${r.verse}`}
                  className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire no-underline hover:border-sapphire"
                >
                  {r.ref}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Cross-references: Treasury of Scripture Knowledge (public domain).
      </p>
    </div>
  );
}

const SHELF_EXCERPT = 320;

function rangeCovers(verses: string, verse: number): boolean {
  const nums = verses.match(/\d+/g);
  if (!nums) return true; // intro section
  const start = Number(nums[0]);
  const end = Number(nums[nums.length - 1]);
  return start <= verse && verse <= end;
}

function ShelfSection({ section }: { section: CommentarySection }) {
  const [open, setOpen] = useState(false);
  const long = section.text.length > SHELF_EXCERPT;
  const shown = open || !long ? section.text : section.text.slice(0, SHELF_EXCERPT).replace(/\s+\S*$/, "") + " …";
  return (
    <div>
      {section.verses && (
        <p className="mb-1 text-xs font-semibold text-sapphire">Verses {section.verses}</p>
      )}
      {shown.split(/\n\n+/).map((para, j) => (
        <p key={j} className="mb-2 font-[family-name:var(--font-reader)] text-[0.86rem] leading-relaxed">
          {para}
        </p>
      ))}
      {long && (
        <button
          onClick={() => setOpen(!open)}
          className="text-xs font-medium text-sapphire hover:underline"
        >
          {open ? "Put back" : "Read on"}
        </button>
      )}
    </div>
  );
}

function ShelfPanel({
  commentary,
  selectedVerse,
}: {
  commentary: CommentaryWorkSections[];
  selectedVerse: number | null;
}) {
  const wall = commentary
    .map((w) => ({
      ...w,
      sections:
        selectedVerse === null
          ? w.sections
          : w.sections.filter((s) => rangeCovers(s.verses, selectedVerse)),
    }))
    .filter((w) => w.sections.length > 0);
  if (wall.length === 0) {
    return (
      <p className="text-xs text-muted">
        {selectedVerse === null
          ? "The commentary shelf holds no volume for this chapter yet."
          : "No volume on the shelf comments on this verse."}
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {selectedVerse !== null && (
        <p className="text-xs text-muted">Commentary touching verse {selectedVerse}.</p>
      )}
      {wall.map((w) => (
        <section key={w.work.id}>
          <p className="small-caps mb-2 text-xs font-semibold text-muted">{w.work.label}</p>
          <div className="space-y-4">
            {w.sections.map((s, i) => (
              <ShelfSection key={i} section={s} />
            ))}
          </div>
        </section>
      ))}
      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Public domain. The volumes are on the shelf; take any of them down
        yourself at any point of disagreement.
      </p>
    </div>
  );
}

function WordPanel({
  activeWord,
  entries,
  loading,
  lang,
  apparatusAvailable,
  wordsOn,
  origOn,
}: {
  activeWord: ActiveWord | null;
  entries: LexiconEntry[];
  loading: boolean;
  lang: Lang;
  apparatusAvailable: boolean;
  wordsOn: boolean;
  origOn: boolean;
}) {
  if (!apparatusAvailable) {
    return (
      <p className="text-xs text-muted">
        The original-language apparatus is not yet furnished on this
        installation.
      </p>
    );
  }
  if (!activeWord) {
    return (
      <p className="text-xs text-muted">
        {origOn
          ? "Tap any word in the text and its study opens here. Escape returns to the margin."
          : wordsOn
            ? "Rest on a word in the text and the Greek or Hebrew beneath it surfaces here."
            : "Switch on “Original words” above the text, then tap any word to see the Greek or Hebrew beneath it."}
      </p>
    );
  }
  const langClass = lang === "hebrew" ? "lang-hebrew" : "lang-greek";
  const isOriginal = activeWord.lemma !== undefined || activeWord.morphCode !== undefined;
  return (
    <div className="space-y-4">
      {isOriginal ? (
        <div className="rounded-[4px] border border-rule bg-paper p-3">
          <p className="flex items-baseline gap-2">
            <span className={`${langClass} text-xl`}>{activeWord.text}</span>
            {activeWord.xlit && <span className="text-xs italic text-muted">{activeWord.xlit}</span>}
            <span className="ml-auto flex gap-1.5">
              {activeWord.strongs.map((id) => (
                <Link
                  key={id}
                  href={`/workspace?tab=lexicon:${id}`}
                  className="text-xs font-semibold text-sapphire"
                >
                  {id}
                </Link>
              ))}
            </span>
          </p>
          {activeWord.lemma && activeWord.lemma !== activeWord.text && (
            <p className="mt-1 text-xs text-muted">
              Lemma <span className={langClass}>{activeWord.lemma}</span>
            </p>
          )}
          {activeWord.morphText && (
            <p className="mt-2 text-[0.84rem] leading-relaxed">{activeWord.morphText}</p>
          )}
          {activeWord.morphCode && (
            <p className="mt-0.5 text-[0.68rem] text-muted">{activeWord.morphCode}</p>
          )}
          {activeWord.gloss && (
            <p className="mt-2 text-[0.84rem]">
              <span className="font-semibold">In context:</span> {activeWord.gloss}
            </p>
          )}
          {activeWord.dg && (
            <p className="mt-1 text-xs text-muted">
              <span className="font-semibold">Lexicon:</span> {activeWord.dg}
            </p>
          )}
          {activeWord.notInEditions && activeWord.notInEditions.length > 0 && (
            <p className="mt-2 border-t border-rule pt-1.5 text-[0.68rem] text-muted">
              Not present in {activeWord.notInEditions.join(", ")}.
            </p>
          )}
        </div>
      ) : (
        <p className="font-[family-name:var(--font-reader)] text-sm">
          “<span className="font-semibold">{activeWord.text}</span>”
        </p>
      )}
      {loading && <p className="text-xs text-muted">Opening the lexicon…</p>}
      {!loading && entries.length === 0 && (
        <p className="text-xs text-muted">No lexicon entry found for this word.</p>
      )}
      {entries.map((e) => (
        <div key={e.id} className="rounded-[4px] border border-rule bg-paper p-3">
          <p className="flex items-baseline gap-2">
            <span
              className={e.id.startsWith("H") ? "lang-hebrew text-lg" : "lang-greek text-lg"}
            >
              {e.lemma}
            </span>
            <span className="text-xs text-muted">{e.xlit}</span>
            <span className="ml-auto text-xs font-semibold text-sapphire">{e.id}</span>
          </p>
          {e.pron && <p className="mt-0.5 text-xs italic text-muted">{e.pron}</p>}
          {e.strongs_def && <p className="mt-2 text-[0.84rem] leading-relaxed">{e.strongs_def}</p>}
          {e.kjv_def && (
            <p className="mt-1.5 text-xs text-muted">
              <span className="font-semibold">KJV renders:</span> {e.kjv_def}
            </p>
          )}
          <Link
            href={`/workspace?tab=lexicon:${e.id}`}
            className="mt-2 inline-block text-xs font-medium text-sapphire"
          >
            Every occurrence in the canon →
          </Link>
        </div>
      ))}
    </div>
  );
}

function VerseNum({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="verse-num"
      aria-label={`Verse ${n} — add or view note`}
      type="button"
    >
      {n}
    </button>
  );
}
