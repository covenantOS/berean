"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  speakSequence,
  useSpeechAvailable,
  useVoiceForLang,
  voiceForLang,
  type PronounceLang,
} from "@/lib/pronounce";
import { playSound } from "@/lib/sound";
import { useWorkspaceDispatch } from "./WorkspaceContext";
import GuideSection from "./GuideSection";
import { SpeakerIcon } from "./icons";
import PrintButton from "./PrintButton";

interface ExegeticalWord {
  t: string;
  x: string | null;
  l: string | null;
  strongs: string | null;
  morph: string;
  g: string | null;
}

interface ExegeticalVerse {
  verse: number;
  alt: string | null;
  words: ExegeticalWord[];
}

interface ImportantWord {
  strongs: string;
  count: number;
  lemma: string | null;
  xlit: string | null;
  gloss: string | null;
}

interface LemmaRow {
  lemma: string;
  strongs: string;
  count: number;
  verses: number[];
  xlit: string | null;
  gloss: string | null;
}

interface VariantRow {
  verse: number;
  words: { t: string; absent: string[] }[];
}

interface ConstructionPart {
  role: string;
  label: string;
  class: string;
  text: string;
}

interface ConstructionClause {
  rule: string;
  parts: ConstructionPart[];
}

interface FrameArg {
  role: string;
  text?: string;
  gloss?: string;
  strongs?: string;
  c?: number;
  v?: number;
  implied?: boolean;
}

interface VerbFrame {
  verb: string;
  gloss?: string;
  strongs?: string;
  args: FrameArg[];
}

interface ReferentRow {
  word: string;
  gloss?: string;
  strongs?: string;
  of: { text?: string; gloss?: string; strongs?: string; c?: number; v?: number }[];
}

interface VerseRoles {
  frames: VerbFrame[];
  referents: ReferentRow[];
}

interface ExegeticalPayload {
  book: string;
  bookName: string;
  chapter: number;
  lang: "hebrew" | "greek";
  verses: ExegeticalVerse[];
  importantWords: ImportantWord[];
  lemmas: LemmaRow[];
  variants: VariantRow[];
  constructions: Record<string, ConstructionClause[]> | null;
  frames: Record<string, VerseRoles> | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; report: ExegeticalPayload };

/** Consecutive arguments of one role group under one label, order kept. */
function groupArgs(args: FrameArg[]): [string, FrameArg[]][] {
  const out: [string, FrameArg[]][] = [];
  for (const a of args) {
    const last = out[out.length - 1];
    if (last && last[0] === a.role) last[1].push(a);
    else out.push([a.role, [a]]);
  }
  return out;
}

/**
 * The Exegetical Guide pane: one chapter's original-language report, pinned
 * at open time. Word by Word renders every tagged token with its parsing;
 * each word opens its word study, each Strong's id opens the lexicon, and
 * each verse chip opens the passage. Important Words, Lemma in Passage, the
 * MACULA syntax-tree Constructions, the Clear semantic frames and
 * participant referents (Who Does What), and the edition-flag Textual
 * Variants ride the same payload. Hovering a word
 * card or a lemma reports its base Strong's id on the lemma hover bus, so
 * every occurrence lights up in the open readers. Sections with
 * nothing to say stay out of the report.
 *
 * A verse's speaker glyph reads the verse's original tokens aloud in order
 * through the platform voice matching the text's language (speakSequence,
 * src/lib/pronounce.ts), the word being spoken marked in the read-aloud
 * channel. One voice at a time: starting a verse takes the speech channel,
 * and the run stands down the moment anything else takes it. Where the
 * platform furnishes no matching voice the glyph hides, the pronounce
 * module's standing rule; reading Greek letters through an English voice
 * would answer nothing.
 */
export default function ExegeticalGuide({ book, chapter }: { book: string; chapter: number }) {
  const { dispatch, reportHoverWord } = useWorkspaceDispatch();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  /** Quiet confirmation for the copy link action; clears itself. */
  const [linkCopied, setLinkCopied] = useState(false);

  /* The guide only reports on the lemma hover bus, never listens.
   * reportedWord remembers that the guide holds the bus so the pane closing
   * mid-hover clears it instead of leaving the readers lit. The payload's
   * ids arrive normalized server-side, so they report as they are. */
  const reportedWord = useRef(false);
  const hoverWord = (strongs: string | null) => () => {
    if (!strongs) return;
    reportedWord.current = true;
    reportHoverWord({ strongs: [strongs] });
  };
  const unhoverWord = () => {
    if (!reportedWord.current) return;
    reportedWord.current = false;
    reportHoverWord(null);
  };
  useEffect(() => {
    return () => {
      if (reportedWord.current) reportHoverWord(null);
    };
  }, [reportHoverWord]);

  /* Verse read-aloud. The verse's original tokens spoken in order through
   * the matching platform voice, the spoken word marked in the read-aloud
   * channel. spokenWord names the verse and the token index being spoken;
   * the run itself lives in a ref, and its own SPEECH_TAKEN_EVENT
   * subscription retires it when anything else takes the channel. The voice
   * is queried at render for the affordance and again at speak time, where
   * Chrome's late voice list has settled. */
  const [spokenWord, setSpokenWord] = useState<{ verse: number; index: number } | null>(null);
  const verseSpeech = useRef<{ stop: () => void } | null>(null);
  const speechOk = useSpeechAvailable();
  const verseLang: PronounceLang | null =
    load.status === "ready" ? (load.report.lang === "hebrew" ? "he" : "el") : null;
  const verseVoice = useVoiceForLang(verseLang);

  const stopVerseSpeech = useCallback(() => {
    const run = verseSpeech.current;
    if (run) {
      verseSpeech.current = null;
      run.stop();
    }
    setSpokenWord(null);
  }, []);

  /* A retarget or the pane's close silences the run. */
  useEffect(() => stopVerseSpeech, [book, chapter, stopVerseSpeech]);

  const toggleVerseSpeech = (v: ExegeticalVerse) => {
    if (spokenWord?.verse === v.verse) {
      stopVerseSpeech();
      return;
    }
    stopVerseSpeech();
    if (!verseLang) return;
    const voice = voiceForLang(verseLang);
    if (!voice) return;
    verseSpeech.current = speakSequence({
      tokens: v.words.map((w) => w.t),
      voice,
      onWord: (index) => setSpokenWord({ verse: v.verse, index }),
      onDone: () => {
        verseSpeech.current = null;
        setSpokenWord(null);
      },
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/exegetical?book=${encodeURIComponent(book)}&chapter=${chapter}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) {
          setLoad({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", report: (await res.json()) as ExegeticalPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [book, chapter]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Composing the exegetical report…</p>;
  }
  if (load.status === "missing") {
    return (
      <p className="text-xs text-muted">
        No tagged original text is furnished for this passage.
      </p>
    );
  }
  const r = load.report;
  const reference = `${r.bookName} ${r.chapter}`;
  const langClass = r.lang === "hebrew" ? "lang-hebrew" : "lang-greek";
  const source = r.lang === "hebrew" ? "TAHOT" : "TAGNT";

  /* The chapter's stable reader URL, for citing the report's subject. */
  const copyLink = () => {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/read/${book}/${chapter}`)
      .then(() => {
        setLinkCopied(true);
        playSound("complete");
        window.setTimeout(() => setLinkCopied(false), 1500);
      })
      .catch(() => {});
  };

  const wordCell = (w: ExegeticalWord, i: number, verse: number) => (
    <div
      key={i}
      dir="ltr"
      onMouseEnter={hoverWord(w.strongs)}
      onMouseLeave={unhoverWord}
      className={`glass-hover flex w-[7.5rem] shrink-0 flex-col gap-0.5 rounded-[3px] border border-rule bg-paper p-1.5${
        spokenWord?.verse === verse && spokenWord.index === i ? " read-aloud" : ""
      }`}
    >
      {w.strongs ? (
        <button
          type="button"
          title={`Open the word study for ${w.strongs}`}
          onClick={() => dispatch({ type: "openWordStudy", strongsId: w.strongs! })}
          className={`${langClass} text-left text-sm leading-tight hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire`}
        >
          {w.t}
        </button>
      ) : (
        <span className={`${langClass} text-sm leading-tight`}>{w.t}</span>
      )}
      {w.x && <span className="text-[0.66rem] italic text-muted">{w.x}</span>}
      {w.g && <span className="text-[0.66rem]">{w.g}</span>}
      {w.morph && <span className="text-[0.62rem] leading-snug text-muted">{w.morph}</span>}
      {w.strongs && (
        <button
          type="button"
          title={`Open ${w.strongs} in the lexicon`}
          onClick={() => dispatch({ type: "openLexicon", id: w.strongs! })}
          className="text-left text-[0.62rem] font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {w.strongs}
        </button>
      )}
    </div>
  );

  return (
    <div className="fx-stagger space-y-6" data-print-root>
      <header className="glass rounded-[4px] px-3 py-2 print:rounded-none print:border-x-0 print:border-t-0 print:bg-none print:bg-transparent print:shadow-none print:px-0 print:pb-2 print:pt-0">
        <p className="small-caps text-xs font-semibold text-amber">Exegetical Guide</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">{reference}</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {r.lang === "hebrew" ? "Hebrew" : "Greek"} text: {source}
        </p>
        <p className="no-print mt-1 flex items-center gap-3">
          <button
            type="button"
            title={`Copy a link that reopens ${reference} in the reader`}
            onClick={copyLink}
            className="text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            {linkCopied ? "Copied" : "Copy link"}
          </button>
          <PrintButton />
        </p>
      </header>

      <GuideSection stagger={1} title="Word by Word" hint={`${source}, every tagged token`}>
        <div className="space-y-4">
          {r.verses.map((v) => (
            <div key={v.verse} className="flex items-start gap-2">
              <div className="mt-1 flex w-8 shrink-0 flex-col items-start gap-1.5">
                <button
                  type="button"
                  title={`Open ${reference}:${v.verse} in the reader`}
                  onClick={() => dispatch({ type: "openRef", book: r.book, chapter: r.chapter })}
                  className="text-left text-[0.68rem] font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  v{v.verse}
                </button>
                {speechOk && verseVoice && (
                  <button
                    type="button"
                    title={
                      spokenWord?.verse === v.verse
                        ? `Stop hearing ${reference}:${v.verse} in ${r.lang === "hebrew" ? "Hebrew" : "Greek"}`
                        : `Hear ${reference}:${v.verse} in ${r.lang === "hebrew" ? "Hebrew" : "Greek"}`
                    }
                    aria-label={
                      spokenWord?.verse === v.verse
                        ? `Stop hearing ${reference}:${v.verse} in ${r.lang === "hebrew" ? "Hebrew" : "Greek"}`
                        : `Hear ${reference}:${v.verse} in ${r.lang === "hebrew" ? "Hebrew" : "Greek"}`
                    }
                    aria-pressed={spokenWord?.verse === v.verse}
                    onClick={() => toggleVerseSpeech(v)}
                    className={`fx-press inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                      spokenWord?.verse === v.verse
                        ? "text-sapphire"
                        : "text-muted hover:text-sapphire"
                    }`}
                  >
                    <SpeakerIcon />
                  </button>
                )}
              </div>
              <div
                dir={r.lang === "hebrew" ? "rtl" : "ltr"}
                className="flex min-w-0 flex-1 flex-wrap gap-1.5"
              >
                {v.words.map((w, i) => wordCell(w, i, v.verse))}
              </div>
            </div>
          ))}
        </div>
      </GuideSection>

      {r.importantWords.length > 0 && (
        <GuideSection stagger={2} title="Important Words" hint="most frequent in the chapter, function words skipped">
          <ul className="space-y-1.5">
            {r.importantWords.map((w) => (
              <li key={w.strongs} className="flex items-baseline gap-2">
                <button
                  type="button"
                  title={`Open ${w.strongs} in the lexicon`}
                  onClick={() => dispatch({ type: "openLexicon", id: w.strongs })}
                  className="shrink-0 text-xs font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {w.strongs}
                </button>
                {w.lemma && (
                  <button
                    type="button"
                    title={`Open the word study for ${w.strongs}`}
                    onClick={() => dispatch({ type: "openWordStudy", strongsId: w.strongs })}
                    className={`${langClass} hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire`}
                  >
                    {w.lemma}
                  </button>
                )}
                {w.xlit && <span className="text-xs italic text-muted">{w.xlit}</span>}
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{w.gloss}</span>
                <span className="shrink-0 text-[0.68rem] text-muted">×{w.count}</span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {r.lemmas.length > 0 && (
        <GuideSection stagger={3} title="Lemma in Passage" hint="lemmas this chapter repeats">
          <ul className="space-y-2">
            {r.lemmas.map((l) => (
              <li key={l.lemma}>
                <p className="flex items-baseline gap-2">
                  <button
                    type="button"
                    title={`Open the word study for ${l.strongs}`}
                    onClick={() => dispatch({ type: "openWordStudy", strongsId: l.strongs })}
                    onMouseEnter={hoverWord(l.strongs)}
                    onMouseLeave={unhoverWord}
                    className={`${langClass} text-sm hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire`}
                  >
                    {l.lemma}
                  </button>
                  {l.xlit && <span className="text-xs italic text-muted">{l.xlit}</span>}
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{l.gloss}</span>
                  <span className="shrink-0 text-[0.68rem] text-muted">
                    {l.count} {l.count === 1 ? "verse" : "verses"}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap gap-1">
                  {l.verses.map((v) => (
                    <button
                      key={v}
                      type="button"
                      title={`Open ${reference}:${v} in the reader`}
                      onClick={() => dispatch({ type: "openRef", book: r.book, chapter: r.chapter })}
                      className="inline-block rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-xs text-sapphire hover:border-sapphire glass-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      v{v}
                    </button>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {r.constructions && Object.keys(r.constructions).length > 0 && (
        <GuideSection
          stagger={4}
          title="Constructions"
          hint="clause functions from the MACULA syntax trees (CC BY 4.0)"
          defaultOpen={false}
        >
          <ul className="space-y-3">
            {Object.entries(r.constructions)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([verse, clauses]) => (
                <li key={verse} className="flex items-start gap-2">
                  <button
                    type="button"
                    title={`Open ${reference}:${verse} in the reader`}
                    onClick={() => dispatch({ type: "openRef", book: r.book, chapter: r.chapter })}
                    className="mt-0.5 w-8 shrink-0 text-left text-[0.68rem] font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    v{verse}
                  </button>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {clauses.map((c, i) => (
                      <p key={i} className="text-xs leading-relaxed">
                        <span className="small-caps mr-1.5 font-medium text-amber">{c.rule}</span>
                        {c.parts.map((p, j) => (
                          <span key={j}>
                            {j > 0 && <span className="text-muted"> · </span>}
                            <span className="font-semibold">{p.label}</span>{" "}
                            <span className={langClass}>{p.text}</span>
                          </span>
                        ))}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
        </GuideSection>
      )}

      {r.frames && Object.keys(r.frames).length > 0 && (
        <GuideSection
          stagger={5}
          title="Who Does What"
          hint="semantic roles and participant referents from the MACULA annotations (CC BY 4.0)"
          defaultOpen={false}
        >
          <ul className="space-y-3">
            {Object.entries(r.frames)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([verse, row]) => (
                <li key={verse} className="flex items-start gap-2">
                  <button
                    type="button"
                    title={`Open ${reference}:${verse} in the reader`}
                    onClick={() => dispatch({ type: "openRef", book: r.book, chapter: r.chapter })}
                    className="mt-0.5 w-8 shrink-0 text-left text-[0.68rem] font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    v{verse}
                  </button>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {row.frames.map((f, i) => (
                      <p key={`f${i}`} className="text-xs leading-relaxed">
                        {f.strongs ? (
                          <button
                            type="button"
                            title={`Open the word study for ${f.strongs}`}
                            onClick={() => dispatch({ type: "openWordStudy", strongsId: f.strongs! })}
                            className={`${langClass} font-semibold hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire`}
                          >
                            {f.verb}
                          </button>
                        ) : (
                          <span className={`${langClass} font-semibold`}>{f.verb}</span>
                        )}
                        {f.gloss && <span className="text-muted"> “{f.gloss}”</span>}
                        {groupArgs(f.args).map(([role, args]) => (
                          <span key={role}>
                            <span className="text-muted"> · </span>
                            <span className="font-semibold capitalize">{role}</span>{" "}
                            {args.map((a, j) => (
                              <span key={j}>
                                {j > 0 && ", "}
                                {a.implied ? (
                                  <span className="text-muted">(implied)</span>
                                ) : (
                                  <>
                                    {a.strongs ? (
                                      <button
                                        type="button"
                                        title={`Open the word study for ${a.strongs}`}
                                        onClick={() =>
                                          dispatch({ type: "openWordStudy", strongsId: a.strongs! })
                                        }
                                        className={`${langClass} hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire`}
                                      >
                                        {a.text}
                                      </button>
                                    ) : (
                                      <span className={langClass}>{a.text}</span>
                                    )}
                                    {a.gloss && <span className="text-muted"> “{a.gloss}”</span>}
                                    {a.v !== undefined && (
                                      <span className="text-muted">
                                        {" "}({a.c !== undefined ? `${a.c}:${a.v}` : `v${a.v}`})
                                      </span>
                                    )}
                                  </>
                                )}
                              </span>
                            ))}
                          </span>
                        ))}
                      </p>
                    ))}
                    {row.referents.map((ref, i) => (
                      <p key={`r${i}`} className="text-xs leading-relaxed">
                        {ref.strongs ? (
                          <button
                            type="button"
                            title={`Open the word study for ${ref.strongs}`}
                            onClick={() => dispatch({ type: "openWordStudy", strongsId: ref.strongs! })}
                            className={`${langClass} hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire`}
                          >
                            {ref.word}
                          </button>
                        ) : (
                          <span className={langClass}>{ref.word}</span>
                        )}
                        {ref.gloss && <span className="text-muted"> “{ref.gloss}”</span>}
                        <span className="text-muted"> refers to </span>
                        {ref.of.map((t, j) => (
                          <span key={j}>
                            {j > 0 && ", "}
                            {t.strongs ? (
                              <button
                                type="button"
                                title={`Open the word study for ${t.strongs}`}
                                onClick={() =>
                                  dispatch({ type: "openWordStudy", strongsId: t.strongs! })
                                }
                                className={`${langClass} hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire`}
                              >
                                {t.text}
                              </button>
                            ) : (
                              <span className={langClass}>{t.text}</span>
                            )}
                            {t.gloss && <span className="text-muted"> “{t.gloss}”</span>}
                            {t.v !== undefined && (
                              <span className="text-muted">
                                {" "}({t.c !== undefined ? `${t.c}:${t.v}` : `v${t.v}`})
                              </span>
                            )}
                          </span>
                        ))}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
        </GuideSection>
      )}

      {r.variants.length > 0 && (
        <GuideSection stagger={6} title="Textual Variants" hint="TAGNT edition flags" defaultOpen={false}>
          <ul className="space-y-1.5">
            {r.variants.map((v) => (
              <li key={v.verse} className="flex items-baseline gap-2">
                <button
                  type="button"
                  title={`Open ${reference}:${v.verse} in the reader`}
                  onClick={() => dispatch({ type: "openRef", book: r.book, chapter: r.chapter })}
                  className="w-8 shrink-0 text-left text-[0.68rem] font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  v{v.verse}
                </button>
                <span className="min-w-0 flex-1 text-xs">
                  {v.words.map((w, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-muted"> · </span>}
                      <span className={langClass}>{w.t}</span>{" "}
                      <span className="text-muted">not in {w.absent.join(", ")}</span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      <p
        style={{ "--i": 7 } as CSSProperties}
        className="border-t border-rule pt-2 text-[0.68rem] text-muted"
      >
        {source}: data created by www.STEPBible.org based on work at Tyndale
        House Cambridge (CC BY 4.0). Parsings decoded from the shipped
        morphology codes. Constructions, semantic roles, and participant
        referents from the MACULA datasets, Clear Bible / Biblica
        (CC BY 4.0).
      </p>
    </div>
  );
}
