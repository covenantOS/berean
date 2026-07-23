"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { listDocuments, type WordItem } from "@/lib/documents";
import PronounceButton from "./PronounceButton";
import { useWorkspaceDispatch } from "./WorkspaceContext";
import GuideSection from "./GuideSection";
import PrintButton from "./PrintButton";
import SearchChart, { type ChartKind } from "./SearchChart";

interface TyndaleVariant {
  id: string;
  lemma: string;
  xlit: string;
  pos: string;
  gloss: string;
}

interface WordStudyEntry {
  lemma?: string;
  xlit?: string;
  pron?: string;
  derivation?: string;
  strongs_def?: string;
  kjv_def?: string;
  tyndale?: TyndaleVariant[];
}

interface WordStudyPayload {
  id: string;
  entry: WordStudyEntry;
  occurrences: {
    total: number;
    books: number;
    byBook: { slug: string; name: string; count: number }[];
    list: { slug: string; name: string; chapter: number; verse: number; text: string }[];
    listed: number;
  };
  forms: { parsing: string; count: number }[];
  topics: { work: string; id: string; title: string; verses: number }[];
  translation: {
    total: number;
    distinct: number;
    renderings: { word: string; count: number }[];
  };
  septuagint: {
    total: number;
    distinct: number;
    renderings: { id: string; lemma?: string; xlit?: string; gloss?: string; count: number }[];
  } | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; study: WordStudyPayload };

/** The occurrence list shows this many verses; the counts stay complete. */
const LIST_SHOWN = 24;

/**
 * The Bible Word Study pane: one Strong's number's lexical report, pinned
 * at open time. The lexicon entry heads it; the translation breakdown and
 * the occurrence counts and book distribution come from the tagged KJV,
 * the form breakdown from the morphologically tagged originals, and the
 * topics from the verse-to-topic index. Every occurrence opens its passage
 * in the reader; every rendering opens a search for that English word.
 */
export default function WordStudyGuide({ strongsId }: { strongsId: string }) {
  const { dispatch } = useWorkspaceDispatch();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [translationKind, setTranslationKind] = useState<ChartKind>("donut");

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/wordstudy?id=${encodeURIComponent(strongsId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) {
          setLoad({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", study: (await res.json()) as WordStudyPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [strongsId]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Composing the word study…</p>;
  }
  if (load.status === "missing") {
    return <p className="text-xs text-muted">No lexicon entry found for {strongsId}.</p>;
  }
  const s = load.study;
  const e = s.entry;
  const langClass = s.id.startsWith("H") ? "lang-hebrew" : "lang-greek";
  const maxCount = Math.max(1, ...s.occurrences.byBook.map((b) => b.count));
  const maxRendering = Math.max(1, ...s.translation.renderings.map((r) => r.count));
  const maxLxx = Math.max(1, ...(s.septuagint?.renderings.map((r) => r.count) ?? [1]));
  const shown = s.occurrences.list.slice(0, LIST_SHOWN);

  /** The study's lemmas as a word list: the Tyndale variants when present, the bare entry otherwise. */
  const saveWordList = () => {
    const items: WordItem[] =
      e.tyndale && e.tyndale.length > 0
        ? e.tyndale.map((v) => ({ strongs: s.id, lemma: v.lemma, xlit: v.xlit, gloss: v.gloss }))
        : [{ strongs: s.id, lemma: e.lemma, xlit: e.xlit, gloss: e.strongs_def }];
    const doc = listDocuments.create({
      title: `Word list: ${e.lemma ?? s.id}`,
      kind: "word-list",
      items,
    });
    dispatch({ type: "openListDoc", docId: doc.id, title: doc.title });
  };

  /** The study's occurrence list as a passage list. */
  const savePassageList = () => {
    const doc = listDocuments.create({
      title: `Occurrences of ${e.lemma ?? s.id}`,
      kind: "passage-list",
      items: s.occurrences.list.map((o) => ({ book: o.slug, chapter: o.chapter, verse: o.verse })),
    });
    dispatch({ type: "openListDoc", docId: doc.id, title: doc.title });
  };

  return (
    <div className="fx-stagger space-y-6" data-print-root>
      <header className="glass rounded-[4px] px-3 py-2 print:rounded-none print:border-x-0 print:border-t-0 print:bg-none print:bg-transparent print:shadow-none print:px-0 print:pb-2 print:pt-0">
        <p className="small-caps text-xs font-semibold text-amber">Bible Word Study</p>
        <h2 className="mt-0.5 flex flex-wrap items-baseline gap-3">
          <span className={`${langClass} text-xl`}>{e.lemma ?? s.id}</span>
          {e.xlit && <span className="font-editorial text-lg text-muted">{e.xlit}</span>}
          <PronounceButton
            lemma={e.lemma}
            xlit={e.xlit}
            lang={s.id.startsWith("H") ? "he" : "el"}
            className="no-print"
          />
          <span className="text-xs font-semibold text-sapphire">{s.id}</span>
          <button
            type="button"
            title={`Open ${s.id} in the lexicon`}
            onClick={() => dispatch({ type: "openLexicon", id: s.id })}
            className="no-print ml-auto text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Open in lexicon
          </button>
          <button
            type="button"
            title="Save this study's lemmas as a word list document"
            onClick={saveWordList}
            className="no-print ml-3 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Save as word list
          </button>
          <PrintButton className="ml-3" />
        </h2>
      </header>

      <GuideSection stagger={1} title="Lexicon" hint="Strong's dictionary, Tyndale House variants">
        <div className="glass rounded-[4px] p-3">
          {e.pron && <p className="text-xs italic text-muted">{e.pron}</p>}
          {e.derivation && (
            <p className="mt-1 text-xs text-muted">
              <span className="font-semibold">Derivation:</span> {e.derivation}
            </p>
          )}
          {e.strongs_def && <p className="mt-2 text-[0.84rem] leading-relaxed">{e.strongs_def}</p>}
          {e.kjv_def && (
            <p className="mt-1.5 text-xs text-muted">
              <span className="font-semibold">KJV renders:</span> {e.kjv_def}
            </p>
          )}
        </div>
        {e.tyndale && e.tyndale.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {e.tyndale.map((v) => (
              <li key={v.id} className="flex items-baseline gap-2 text-xs">
                <span className={langClass}>{v.lemma}</span>
                <span className="italic text-muted">{v.xlit}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{v.gloss}</span>
                <span className="shrink-0 text-[0.68rem] text-muted">{v.pos}</span>
              </li>
            ))}
          </ul>
        )}
      </GuideSection>

      {s.translation.renderings.length > 0 && (
        <GuideSection
          stagger={2}
          title="Translation"
          hint={`${s.translation.distinct.toLocaleString()} KJV ${
            s.translation.distinct === 1 ? "rendering" : "renderings"
          }`}
        >
          <div className="space-y-1">
            {s.translation.renderings.map((r) => (
              <p key={r.word} className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  title={`Search for "${r.word}"`}
                  onClick={() => dispatch({ type: "openSearch", q: r.word })}
                  className="w-28 shrink-0 truncate text-left text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {r.word}
                </button>
                <span
                  className="h-2 bg-sapphire/70"
                  style={{ width: `${(r.count / maxRendering) * 100}%` }}
                />
                <span className="text-[0.68rem] text-muted">{r.count.toLocaleString()}</span>
              </p>
            ))}
          </div>
          {s.translation.distinct > s.translation.renderings.length && (
            <p className="mt-2 text-[0.68rem] text-muted">
              Top {s.translation.renderings.length} of {s.translation.distinct.toLocaleString()}{" "}
              renderings.
            </p>
          )}
          <SearchChart
            series={s.translation.renderings.map((r) => ({ key: r.word, label: r.word, value: r.count }))}
            kind={translationKind}
            onKindChange={setTranslationKind}
            onSelect={(key) => dispatch({ type: "openSearch", q: key })}
          />
        </GuideSection>
      )}

      {s.septuagint && s.septuagint.renderings.length > 0 && (
        <GuideSection
          stagger={3}
          title="Septuagint Translation"
          hint={`${s.septuagint.distinct.toLocaleString()} Greek ${
            s.septuagint.distinct === 1 ? "equivalent" : "equivalents"
          } in the LXX`}
        >
          <div className="space-y-1">
            {s.septuagint.renderings.map((r) => (
              <p key={r.id} className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  title={`Open the word study for ${r.lemma ?? r.id} (${r.id})`}
                  onClick={() => dispatch({ type: "openWordStudy", strongsId: r.id })}
                  className="lang-greek w-28 shrink-0 truncate text-left text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {r.lemma ?? r.id}
                </button>
                <span className="min-w-0 flex-1 truncate text-muted">{r.gloss}</span>
                <span
                  className="h-2 shrink-0 bg-sapphire/70"
                  style={{ width: `${(r.count / maxLxx) * 40}%` }}
                />
                <span className="shrink-0 text-[0.68rem] text-muted">{r.count.toLocaleString()}</span>
              </p>
            ))}
          </div>
          {s.septuagint.distinct > s.septuagint.renderings.length && (
            <p className="mt-2 text-[0.68rem] text-muted">
              Top {s.septuagint.renderings.length} of {s.septuagint.distinct.toLocaleString()}{" "}
              equivalents, from the MACULA Hebrew-Greek alignment.
            </p>
          )}
        </GuideSection>
      )}

      {s.occurrences.total > 0 && (
        <GuideSection
          stagger={4}
          title="Occurrences"
          hint={`${s.occurrences.total.toLocaleString()} in ${s.occurrences.books} ${
            s.occurrences.books === 1 ? "book" : "books"
          }`}
        >
          <div className="space-y-1">
            {s.occurrences.byBook.map((b) => (
              <p key={b.slug} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 truncate">{b.name}</span>
                <span className="h-2 bg-sapphire/70" style={{ width: `${(b.count / maxCount) * 100}%` }} />
                <span className="text-[0.68rem] text-muted">{b.count}</span>
              </p>
            ))}
          </div>
          <ul className="mt-3 space-y-2 border-t border-rule pt-3">
            {shown.map((o, i) => (
              <li key={i}>
                <button
                  type="button"
                  title={`Open ${o.name} ${o.chapter}:${o.verse}`}
                  onClick={() => dispatch({ type: "openRef", book: o.slug, chapter: o.chapter })}
                  className="small-caps text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {o.name} {o.chapter}:{o.verse}
                </button>
                <p className="mt-0.5 font-reader text-[0.82rem] leading-relaxed text-muted">
                  {o.text}
                </p>
              </li>
            ))}
          </ul>
          {s.occurrences.listed > shown.length && (
            <p className="mt-2 text-[0.68rem] text-muted">
              First {shown.length} of {s.occurrences.total.toLocaleString()} occurrences listed.
            </p>
          )}
          <button
            type="button"
            title="Save the listed occurrences as a passage list document"
            onClick={savePassageList}
            className="mt-2 text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Save occurrences as passage list
          </button>
        </GuideSection>
      )}

      {s.occurrences.total > 0 && (
        <GuideSection stagger={5} title="Chart" hint="frequency graph by book">
          <SearchChart
            series={s.occurrences.byBook.map((b) => ({ key: b.slug, label: b.name, value: b.count }))}
            kind={chartKind}
            onKindChange={setChartKind}
            onSelect={(key) => {
              const first = s.occurrences.list.find((o) => o.slug === key);
              if (first) dispatch({ type: "openRef", book: first.slug, chapter: first.chapter });
            }}
          />
        </GuideSection>
      )}

      {s.forms.length > 0 && (
        <GuideSection stagger={6} title="Forms" hint="parsings across the tagged originals">
          <ul className="space-y-1">
            {s.forms.map((f) => (
              <li key={f.parsing} className="flex items-baseline gap-2 text-xs">
                <span className="min-w-0 flex-1">{f.parsing}</span>
                <span className="shrink-0 text-[0.68rem] text-muted">
                  {f.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {s.topics.length > 0 && (
        <GuideSection stagger={7} title="Topics" hint="cited where this word appears">
          <ul className="space-y-1.5">
            {s.topics.map((t) => (
              <li key={`${t.work}:${t.id}`}>
                <button
                  type="button"
                  title={`Open the topic guide for ${t.title}`}
                  onClick={() =>
                    dispatch({ type: "openTopicGuide", work: t.work, topicId: t.id, title: t.title })
                  }
                  className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {t.title}
                </button>{" "}
                <span className="text-xs text-muted">
                  {t.work === "naves" ? "Nave's" : "Torrey's"} · {t.verses}{" "}
                  {t.verses === 1 ? "verse" : "verses"}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      <p
        style={{ "--i": 8 } as CSSProperties}
        className="border-t border-rule pt-2 text-[0.68rem] text-muted"
      >
        Strong's dictionary (public domain). Occurrences and renderings from
        the tagged KJV; forms from TAHOT and TAGNT; Septuagint equivalents
        from the MACULA Hebrew Linguistic Datasets (CC BY 4.0).
      </p>
    </div>
  );
}
