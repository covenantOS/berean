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
const MODE_KEY = "berean.readerMode.v1";
const WORDS_KEY = "berean.originalWords.v1";

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
  const [activeWord, setActiveWord] = useState<{ text: string; strongs: string[] } | null>(null);
  const [wordEntries, setWordEntries] = useState<LexiconEntry[]>([]);
  const [wordLoading, setWordLoading] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(MODE_KEY) as Mode | null;
    if (stored === "warm" || stored === "evening") setMode(stored);
    setWordsOn(window.localStorage.getItem(WORDS_KEY) === "1");
    setNotes(listNotes(bookSlug, chapter));
    setSelectedVerse(null);
    setActiveWord(null);
  }, [bookSlug, chapter]);

  function changeMode(m: Mode) {
    setMode(m);
    window.localStorage.setItem(MODE_KEY, m);
  }

  function toggleWords() {
    const next = !wordsOn;
    setWordsOn(next);
    window.localStorage.setItem(WORDS_KEY, next ? "1" : "0");
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

  async function tapWord(w: TaggedWord) {
    if (!w.s || w.s.length === 0) return;
    setActiveWord({ text: w.t, strongs: w.s });
    setTab("word");
    setWordLoading(true);
    try {
      const entries = await Promise.all(
        w.s.map(async (id) => {
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
  const parallelByVerse = useMemo(() => {
    const m = new Map<number, string>();
    parallel?.verses.forEach((v) => m.set(v.verse, v.text));
    return m;
  }, [parallel]);

  const verseClass = (v: number) =>
    `verse-target ${notedVerses.has(v) ? "has-note" : ""} ${
      selectedVerse === v ? "verse-selected" : ""
    }`;

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
                taggedAvailable={tagged !== null}
                wordsOn={wordsOn}
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
        Cross-references: OpenBible.info (CC-BY).
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
  taggedAvailable,
  wordsOn,
}: {
  activeWord: { text: string; strongs: string[] } | null;
  entries: LexiconEntry[];
  loading: boolean;
  taggedAvailable: boolean;
  wordsOn: boolean;
}) {
  if (!taggedAvailable) {
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
        {wordsOn
          ? "Rest on a word in the text and the Greek or Hebrew beneath it surfaces here."
          : "Switch on “Original words” above the text, then tap any word to see the Greek or Hebrew beneath it."}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <p className="font-[family-name:var(--font-reader)] text-sm">
        “<span className="font-semibold">{activeWord.text}</span>”
      </p>
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
