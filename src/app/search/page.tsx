import Link from "next/link";
import type { Metadata } from "next";
import { searchCanon } from "@/lib/bible";
import {
  GREEK_FILTER_DEFS,
  HEBREW_FILTER_DEFS,
  MorphFilters,
  OriginalHit,
  searchOriginal,
} from "@/lib/morphsearch";
import { DEFAULT_TRANSLATION, getAvailableTranslations } from "@/lib/translations";
import { searchEntities } from "@/lib/entities";
import { searchTopics } from "@/lib/topics";
import SemanticMode from "./semantic";

export const metadata: Metadata = { title: "Concordance" };

const FILTER_KEYS = [
  "gpos", "gtense", "gvoice", "gmood", "gcase", "gperson", "gnumber", "ggender",
  "hpos", "hstem", "haspect", "hstate", "hperson", "hnumber", "hgender",
] as const;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { q, t } = params;
  const mode = params.mode === "original" ? "original" : params.mode === "semantic" ? "semantic" : "english";
  const query = (q ?? "").trim();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Concordance</h1>
      <p className="mb-6 text-sm text-muted">
        Search every word of the canon. Results open the passage at the verse.
      </p>

      <nav className="mb-8 flex gap-4 border-b border-rule text-sm">
        <ModeTab href={`/search?q=${encodeURIComponent(query)}`} active={mode === "english"}>
          English concordance
        </ModeTab>
        <ModeTab
          href={`/search?mode=original&q=${encodeURIComponent(query)}`}
          active={mode === "original"}
        >
          Original languages
        </ModeTab>
        <ModeTab href="/search?mode=semantic" active={mode === "semantic"}>
          Search by meaning
        </ModeTab>
      </nav>

      {mode === "english" ? (
        <EnglishMode query={query} t={t} />
      ) : mode === "original" ? (
        <OriginalMode query={query} params={params} />
      ) : (
        <SemanticMode />
      )}
    </div>
  );
}

function ModeTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-1 pb-2 no-underline ${
        active
          ? "border-sapphire font-medium text-ink"
          : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------ English mode ------------------------------ */

async function EnglishMode({ query, t }: { query: string; t?: string }) {
  const available = await getAvailableTranslations();
  const translation =
    t && available.some((x) => x.id === t) ? t : DEFAULT_TRANSLATION;
  const results =
    query.length >= 2 ? await searchCanon(query, 200, translation) : null;
  const entities = query.length >= 2 ? await searchEntities(query) : [];
  const topics = query.length >= 2 ? await searchTopics(query) : [];

  return (
    <>
      <form action="/search" method="get" className="mb-8 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="e.g. mercy and truth"
          aria-label="Search the canon"
          className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <select
          name="t"
          defaultValue={translation}
          aria-label="Translation"
          className="rounded-[4px] border border-rule bg-surface px-2 py-2 text-sm"
        >
          {available.map((x) => (
            <option key={x.id} value={x.id}>
              {x.abbrev}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
        >
          Search
        </button>
      </form>

      {entities.length > 0 && (
        <section className="mb-8">
          <p className="small-caps mb-3 border-b border-rule pb-2 text-sm text-muted">
            People and places
          </p>
          <ul className="space-y-2">
            {entities.map((e) => (
              <li key={e.id} className="text-sm">
                <Link
                  href={`/library/entity/${e.id}`}
                  className="font-medium text-sapphire no-underline hover:underline"
                >
                  {e.name}
                </Link>{" "}
                <span className="text-xs text-muted">
                  {e.kind === "place" ? "place" : e.type.toLowerCase() || e.kind}
                  {e.brief ? ` · ${e.brief}` : ""} · {e.refs.toLocaleString()}{" "}
                  {e.refs === 1 ? "reference" : "references"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topics.length > 0 && (
        <section className="mb-8">
          <p className="small-caps mb-3 border-b border-rule pb-2 text-sm text-muted">
            Topics
          </p>
          <ul className="space-y-2">
            {topics.map((t) => (
              <li key={`${t.work}-${t.id}`} className="text-sm">
                <Link
                  href={`/topics/${t.work}/${t.id}`}
                  className="font-medium text-sapphire no-underline hover:underline capitalize"
                >
                  {t.title}
                </Link>{" "}
                <span className="text-xs text-muted">
                  {t.work === "naves" ? "Nave's" : "Torrey's"} · {t.refs.toLocaleString()}{" "}
                  {t.refs === 1 ? "reference" : "references"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && (
        <>
          <p className="small-caps mb-4 border-b border-rule pb-2 text-sm text-muted">
            {results.total.toLocaleString()} {results.total === 1 ? "verse" : "verses"}
            {results.total > results.hits.length &&
              ` · showing first ${results.hits.length}`}
          </p>
          <ol className="space-y-4">
            {results.hits.map((hit) => (
              <li key={`${hit.book.slug}-${hit.chapter}-${hit.verse}`}>
                <Link
                  href={`/read/${hit.book.slug}/${hit.chapter}#v${hit.verse}`}
                  className="small-caps text-sm font-medium text-sapphire no-underline hover:underline"
                >
                  {hit.book.name} {hit.chapter}:{hit.verse}
                </Link>
                <p className="font-reader mt-0.5 leading-relaxed">
                  <Highlighted text={hit.text} needle={query} />
                </p>
              </li>
            ))}
          </ol>
          {results.total === 0 && (
            <p className="text-sm text-muted">No verses contain “{query}”.</p>
          )}
        </>
      )}
    </>
  );
}

/* ----------------------------- Original mode ----------------------------- */

async function OriginalMode({
  query,
  params,
}: {
  query: string;
  params: Record<string, string | undefined>;
}) {
  const filters: MorphFilters = {};
  for (const key of FILTER_KEYS) {
    if (params[key]) filters[key] = params[key];
  }
  const ran = query.length >= 2 || Object.keys(filters).length > 0;
  const results = ran ? await searchOriginal(query, filters, 200) : null;

  return (
    <>
      <form action="/search" method="get" className="mb-8">
        <input type="hidden" name="mode" value="original" />
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Lemma, transliteration, Strong's (G25, H1254), or letters in the script (λογ, ברא)"
            aria-label="Search the Greek and Hebrew text"
            className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <button
            type="submit"
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
          >
            Search
          </button>
        </div>

        <details className="mt-3 rounded-[4px] border border-rule bg-surface p-4" open={Object.keys(filters).length > 0}>
          <summary className="small-caps cursor-pointer text-sm text-muted">
            Narrow by parsing
          </summary>
          <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <p className="small-caps text-xs text-muted sm:col-span-2 lg:col-span-4">
              Greek (New Testament)
            </p>
            {GREEK_FILTER_DEFS.map((def) => (
              <FilterSelect key={def.key} def={def} value={params[def.key]} />
            ))}
            <p className="small-caps mt-2 text-xs text-muted sm:col-span-2 lg:col-span-4">
              Hebrew (Old Testament)
            </p>
            {HEBREW_FILTER_DEFS.map((def) => (
              <FilterSelect key={def.key} def={def} value={params[def.key]} />
            ))}
          </div>
        </details>
      </form>

      {results && (
        <>
          <p className="small-caps mb-4 border-b border-rule pb-2 text-sm text-muted">
            {results.total.toLocaleString()} {results.total === 1 ? "occurrence" : "occurrences"}
            {" in "}
            {results.verses.toLocaleString()} {results.verses === 1 ? "verse" : "verses"}
            {results.verses > results.hits.length &&
              ` · showing first ${results.hits.length} verses`}
          </p>
          <ol className="space-y-4">
            {results.hits.map((hit) => (
              <OriginalResult key={`${hit.book.slug}-${hit.chapter}-${hit.verse}`} hit={hit} />
            ))}
          </ol>
          {results.total === 0 && (
            <p className="text-sm text-muted">
              Nothing in the tagged {results.lang === "hebrew" ? "Hebrew" : results.lang === "greek" ? "Greek" : "original"} text matches
              {query ? ` “${query}”` : ""} with those filters.
            </p>
          )}
        </>
      )}
    </>
  );
}

function FilterSelect({
  def,
  value,
}: {
  def: { key: string; label: string; options: string[] };
  value?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {def.label}
      <select
        name={def.key}
        defaultValue={value ?? ""}
        className="rounded-[4px] border border-rule bg-surface px-2 py-1.5 text-sm text-ink"
      >
        <option value="">any</option>
        {def.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function OriginalResult({ hit }: { hit: OriginalHit }) {
  const matched = new Set(hit.matches.map((m) => m.t));
  return (
    <li>
      <Link
        href={`/read/${hit.book.slug}/${hit.chapter}#v${hit.verse}`}
        className="small-caps text-sm font-medium text-sapphire no-underline hover:underline"
      >
        {hit.book.name} {hit.chapter}:{hit.verse}
      </Link>
      <p
        className={`mt-0.5 text-lg leading-relaxed ${
          hit.book.testament === "OT" ? "lang-hebrew" : "lang-greek"
        }`}
        dir={hit.book.testament === "OT" ? "rtl" : "ltr"}
      >
        {hit.text.split(" ").map((w, i) =>
          matched.has(w) ? (
            <mark key={i} className="rounded-[2px] bg-amber/25 px-0.5">
              {w}{" "}
            </mark>
          ) : (
            <span key={i}>{w} </span>
          )
        )}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-muted">
        {hit.matches.map((m, i) => (
          <li key={i}>
            <span className={hit.book.testament === "OT" ? "lang-hebrew" : "lang-greek"}>
              {m.t}
            </span>
            {" · "}
            {m.parsing}
            {m.gloss ? ` · “${m.gloss}”` : ""}
            {m.strongs ? (
              <>
                {" · "}
                <Link href={`/lexicon/${m.strongs}`} className="text-sapphire no-underline hover:underline">
                  {m.strongs}
                </Link>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

function Highlighted({ text, needle }: { text: string; needle: string }) {
  const lower = text.toLowerCase();
  const n = needle.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(n);
  let key = 0;
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="rounded-[2px] bg-amber/25 px-0.5">
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    i = idx + needle.length;
    idx = lower.indexOf(n, i);
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}
