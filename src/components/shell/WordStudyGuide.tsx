"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";
import GuideSection from "./GuideSection";

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
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; study: WordStudyPayload };

/** The occurrence list shows this many verses; the counts stay complete. */
const LIST_SHOWN = 24;

/**
 * The Bible Word Study pane: one Strong's number's lexical report, pinned
 * at open time. The lexicon entry heads it; the occurrence counts and book
 * distribution come from the tagged KJV, the form breakdown from the
 * morphologically tagged originals, and the topics from the verse-to-topic
 * index. Every occurrence opens its passage in the reader.
 */
export default function WordStudyGuide({ strongsId }: { strongsId: string }) {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

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
  const shown = s.occurrences.list.slice(0, LIST_SHOWN);

  return (
    <div className="space-y-6">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Bible Word Study</p>
        <h2 className="mt-0.5 flex flex-wrap items-baseline gap-3">
          <span className={`${langClass} text-xl`}>{e.lemma ?? s.id}</span>
          {e.xlit && <span className="font-editorial text-lg text-muted">{e.xlit}</span>}
          <span className="text-xs font-semibold text-sapphire">{s.id}</span>
          <button
            type="button"
            title={`Open ${s.id} in the lexicon`}
            onClick={() => dispatch({ type: "openLexicon", id: s.id })}
            className="ml-auto text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Open in lexicon
          </button>
        </h2>
      </header>

      <GuideSection title="Lexicon" hint="Strong's dictionary, Tyndale House variants">
        <div className="rounded-[4px] border border-rule bg-paper p-3">
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

      {s.occurrences.total > 0 && (
        <GuideSection
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
        </GuideSection>
      )}

      {s.forms.length > 0 && (
        <GuideSection title="Forms" hint="parsings across the tagged originals">
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
        <GuideSection title="Topics" hint="cited where this word appears">
          <ul className="space-y-1.5">
            {s.topics.map((t) => (
              <li key={`${t.work}:${t.id}`}>
                <Link
                  href={`/topics/${t.work}/${t.id}`}
                  className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {t.title}
                </Link>{" "}
                <span className="text-xs text-muted">
                  {t.work === "naves" ? "Nave's" : "Torrey's"} · {t.verses}{" "}
                  {t.verses === 1 ? "verse" : "verses"}
                </span>
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Strong's dictionary (public domain). Occurrences from the tagged KJV;
        forms from TAHOT and TAGNT.
      </p>
    </div>
  );
}
