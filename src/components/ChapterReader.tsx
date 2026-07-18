"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MarginNote,
  deleteNote,
  listNotes,
  saveNote,
} from "@/lib/marginalia";

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
  tagged,
  original,
  lang,
  crossrefs,
  commentary,
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
  tagged: TaggedVerse[] | null;
  original: OriginalVerse[] | null;
  lang: Lang;
  crossrefs: Record<number, CrossRef[]> | null;
  commentary: CommentarySection[] | null;
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

  const notedVerses = useMemo(() => new Set(notes.map((n) => n.verse)), [notes]);
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

  const showTagged = wordsOn && !parallel && translationId === "kjv" && tagged !== null;
  const showOriginal = origOn && !parallel && original !== null;
  const parallelByVerse = useMemo(() => {
    const m = new Map<number, string>();
    parallel?.verses.forEach((v) => m.set(v.verse, v.text));
    return m;
  }, [parallel]);

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
              onChange={(e) => navigate(e.target.value, parallel?.id ?? "")}
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
                value={parallel?.id ?? ""}
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

        {parallel ? (
          <div className="text-[1.02rem] leading-relaxed">
            <div className="mb-3 grid grid-cols-2 gap-6 border-b border-rule pb-2 font-[family-name:var(--font-interface)] text-xs font-semibold text-muted">
              <span>{translationAbbrev}</span>
              <span>{parallel.abbrev}</span>
            </div>
            {verses.map((v) => (
              <div
                key={v.verse}
                id={`v${v.verse}`}
                className={`grid grid-cols-2 gap-6 border-b border-rule/60 py-2 ${verseClass(v.verse)}`}
              >
                <p>
                  <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
                  {v.text}
                </p>
                <p className="opacity-90">{parallelByVerse.get(v.verse) ?? "—"}</p>
              </div>
            ))}
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
            {verses.map((v) => (
              <p key={v.verse} id={`v${v.verse}`} className={`verse-line ${verseClass(v.verse)}`}>
                <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
                {v.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="prose-verses drop-cap">
            {verses.map((v) => (
              <span key={v.verse} id={`v${v.verse}`} className={verseClass(v.verse)}>
                <VerseNum n={v.verse} onClick={() => openVerse(v.verse)} />
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

            {tab === "shelf" && <ShelfPanel commentary={commentary} />}

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
    cancel,
  } = props;
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

      {notes.length > 0 ? (
        <ul className="space-y-3 border-t border-rule pt-3">
          {notes
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

function ShelfPanel({ commentary }: { commentary: CommentarySection[] | null }) {
  if (!commentary) {
    return (
      <p className="text-xs text-muted">
        The commentary shelf holds no volume for this chapter yet. Matthew
        Henry arrives with the furnished Library.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <p className="small-caps text-xs font-semibold text-muted">
        Matthew Henry — Concise Commentary
      </p>
      {commentary.map((s, i) => (
        <div key={i}>
          {s.verses && (
            <p className="mb-1 text-xs font-semibold text-sapphire">Verses {s.verses}</p>
          )}
          {s.text.split(/\n\n+/).map((para, j) => (
            <p key={j} className="mb-2 font-[family-name:var(--font-reader)] text-[0.86rem] leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      ))}
      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Public domain. The volume is on the shelf; take it down yourself at any
        point of disagreement.
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
                  href={`/lexicon/${id}`}
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
            href={`/lexicon/${e.id}`}
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
