import Link from "next/link";
import type { Metadata } from "next";
import { studyWord } from "@/lib/bible";
import { COMMENTARY_WORKS } from "@/lib/commentary";
import { getRights } from "@/lib/rights";
import { listEntities } from "@/lib/entities";

export const metadata: Metadata = { title: "The Library" };

const ENTITY_PAGE = 60;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ word?: string; eq?: string; ek?: string }>;
}) {
  const { word, eq, ek } = await searchParams;
  const study = word ? await studyWord(word) : null;
  const maxCount = study ? Math.max(...study.byBook.map((b) => b.count), 1) : 1;

  const entityQuery = (eq ?? "").trim().toLowerCase();
  const entityKind = ek === "person" || ek === "place" || ek === "other" ? ek : "";
  const allEntities = (await listEntities()) ?? [];
  const kindCounts = {
    person: allEntities.filter((e) => e.kind === "person").length,
    place: allEntities.filter((e) => e.kind === "place").length,
    other: allEntities.filter((e) => e.kind === "other").length,
  };
  const entities = allEntities.filter(
    (e) =>
      (!entityKind || e.kind === entityKind) &&
      (!entityQuery ||
        e.name.toLowerCase().includes(entityQuery) ||
        e.aliases.some((a) => a.toLowerCase().includes(entityQuery)))
  );
  const shownEntities = entities.slice(0, ENTITY_PAGE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">The Library</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        The deep room, built for exegesis that can bear the weight of a pulpit. Its apparatus grows
        only as verified datasets and licensed texts arrive — nothing on this shelf is implied that
        Berean cannot actually open. The whole catalog, rights and provenance included, downloads
        as a spreadsheet:{" "}
        <a
          href="/api/library/catalog"
          download="berean-library-catalog.csv"
          className="text-sapphire no-underline hover:underline"
        >
          catalog CSV
        </a>
        .
      </p>

      <section className="mb-10">
        <h2 className="small-caps mb-2 text-sm text-muted">Word study — usage across the canon</h2>
        <form action="/library" method="get" className="mb-4 flex gap-2">
          <input
            name="word"
            defaultValue={word ?? ""}
            placeholder="A word — mercy, covenant, propitiation…"
            aria-label="Word to study"
            className="w-full max-w-md rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <button
            type="submit"
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Study
          </button>
        </form>

        {word && !study && (
          <p className="text-sm text-muted">Give at least two letters.</p>
        )}
        {study && study.total === 0 && (
          <p className="text-sm text-muted">
            &ldquo;{study.word}&rdquo; does not occur as a whole word in the KJV text.
          </p>
        )}
        {study && study.total > 0 && (
          <div className="rounded-[4px] border border-rule bg-surface p-5">
            <p className="text-sm">
              <span className="font-editorial text-lg font-bold">&ldquo;{study.word}&rdquo;</span>{" "}
              occurs <span className="font-medium">{study.total.toLocaleString()}</span> time
              {study.total === 1 ? "" : "s"} in {study.byBook.length} book
              {study.byBook.length === 1 ? "" : "s"}.
              {study.first && (
                <>
                  {" "}
                  First:{" "}
                  <Link
                    href={`/read/${study.first.book.slug}/${study.first.chapter}#v${study.first.verse}`}
                    className="text-sapphire no-underline hover:underline"
                  >
                    {study.first.book.name} {study.first.chapter}:{study.first.verse}
                  </Link>
                  .
                </>
              )}
              {study.last && (
                <>
                  {" "}
                  Last:{" "}
                  <Link
                    href={`/read/${study.last.book.slug}/${study.last.chapter}#v${study.last.verse}`}
                    className="text-sapphire no-underline hover:underline"
                  >
                    {study.last.book.name} {study.last.chapter}:{study.last.verse}
                  </Link>
                  .
                </>
              )}
            </p>
            <ul className="mt-4 space-y-1">
              {study.byBook.map(({ book, count }) => (
                <li key={book.slug} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 truncate">{book.name}</span>
                  <span
                    className="h-3 bg-sapphire"
                    style={{ width: `${Math.max(2, (count / maxCount) * 60)}%` }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-muted">{count}</span>
                  <Link
                    href={`/search?q=${encodeURIComponent(study.word)}`}
                    className="text-xs text-sapphire no-underline hover:underline"
                  >
                    verses
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-rule pt-3 text-xs text-muted">
              Whole-word occurrences in the KJV. Open every verse in the{" "}
              <Link href={`/search?q=${encodeURIComponent(study.word)}`} className="text-sapphire">
                concordance
              </Link>
              .
            </p>
          </div>
        )}
        {!word && (
          <p className="text-sm text-muted">
            Rest a word here and see where and how the canon uses it — counts by book, first and last
            occurrence, and every verse through the concordance.
          </p>
        )}
      </section>

      <section className="mb-10">
        <h2 className="small-caps mb-2 text-sm text-muted">People and places</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted">
          Every individualised name in the canon — {kindCounts.person.toLocaleString()} people,{" "}
          {kindCounts.place.toLocaleString()} places — with family relationships and exhaustive
          references. From STEPBible&apos;s TIPNR dataset (CC BY 4.0). The places with coordinates
          are plotted in <Link href="/library/atlas" className="text-sapphire no-underline hover:underline">the Atlas</Link>.
        </p>
        <form action="/library" method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            name="eq"
            defaultValue={eq ?? ""}
            placeholder="A name — Abraham, Jerusalem, Beelzebul…"
            aria-label="Find a person or place"
            className="w-full max-w-md rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <select
            name="ek"
            defaultValue={entityKind}
            aria-label="Kind"
            className="rounded-[4px] border border-rule bg-surface px-2 py-2 text-sm"
          >
            <option value="">people &amp; places</option>
            <option value="person">people</option>
            <option value="place">places</option>
            <option value="other">other names</option>
          </select>
          <button
            type="submit"
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Find
          </button>
        </form>
        {(entityQuery || entityKind) && (
          <p className="small-caps mb-3 text-xs text-muted">
            {entities.length.toLocaleString()} {entities.length === 1 ? "entry" : "entries"}
            {entities.length > shownEntities.length && ` · showing first ${shownEntities.length}`}
          </p>
        )}
        <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {shownEntities.map((e) => (
            <li key={e.id} className="text-sm">
              <Link
                href={`/library/entity/${e.id}`}
                className="text-sapphire no-underline hover:underline"
              >
                {e.name}
              </Link>{" "}
              <span className="text-xs text-muted">
                {e.kind === "place" ? "place" : e.type.toLowerCase() || e.kind}
                {e.brief ? ` · ${e.brief}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {entities.length === 0 && (
          <p className="text-sm text-muted">No entry matches that name.</p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[4px] border border-rule bg-surface p-5 text-sm leading-relaxed">
          <h3 className="font-editorial mb-1 font-bold">The topical index</h3>
          <p className="text-muted">
            The canon gathered under its subjects: Nave&apos;s Topical Bible and Torrey&apos;s New
            Topical Textbook, every reference set out with its KJV text and linked to the reader.
          </p>
          <p className="mt-2">
            <Link href="/topics" className="text-sapphire no-underline hover:underline">
              Open the topical index
            </Link>
          </p>
        </div>
        <div className="rounded-[4px] border border-rule bg-surface p-5 text-sm leading-relaxed">
          <h3 className="font-editorial mb-1 font-bold">The original languages</h3>
          <p className="text-muted">
            Interlinear text, morphology, and the standard lexicons arrive only at the depth
            supported by verified datasets — never reconstructed from an engine&apos;s memory. The
            shelf is being sourced; see{" "}
            <Link href="/sources" className="text-sapphire no-underline hover:underline">
              Sources &amp; rights
            </Link>{" "}
            for what is secured and what is planned.
          </p>
        </div>
        <div className="rounded-[4px] border border-rule bg-surface p-5 text-sm leading-relaxed">
          <h3 className="font-editorial mb-1 font-bold">The commentary shelf</h3>
          <p className="text-muted">
            Public-domain volumes ride along with every chapter in the reader&apos;s Shelf tab.
            On the shelf now:
          </p>
          <ul className="mt-2 space-y-1">
            {COMMENTARY_WORKS.filter((w) => getRights(w.rightsId)?.status === "shipped").map(
              (w) => (
                <li key={w.id}>
                  <Link
                    href={`/read/genesis/1`}
                    className="text-sapphire no-underline hover:underline"
                  >
                    {w.label}
                  </Link>
                </li>
              )
            )}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Gill, Poole, the Pulpit Commentary, Ellicott, and the Geneva notes join as verified
            source editions are secured — see{" "}
            <Link href="/sources" className="text-sapphire no-underline hover:underline">
              Sources &amp; rights
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
