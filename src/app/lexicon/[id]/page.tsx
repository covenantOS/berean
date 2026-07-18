import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLexiconEntry, normalizeStrongs } from "@/lib/lexicon";
import { findOccurrences } from "@/lib/tagged";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const norm = normalizeStrongs(id);
  return { title: norm ? `${norm} · Lexicon` : "Lexicon" };
}

export default async function LexiconPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hit = await getLexiconEntry(id);
  if (!hit) notFound();
  // Extended ids (H7225G) and padded forms (G0025) resolve to the base entry.
  if (id.trim().toUpperCase() !== hit.id) redirect(`/lexicon/${hit.id}`);
  const { entry } = hit;
  const isHebrew = hit.id.startsWith("H");
  const tyndale = entry.tyndale ?? [];
  const gloss = tyndale[0]?.gloss;
  const { occurrences, total, byBook } = await findOccurrences(hit.id, 300);
  const maxCount = Math.max(1, ...byBook.map((b) => b.count));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/library" className="text-sapphire no-underline hover:underline">
          Library
        </Link>{" "}
        / Lexicon / {hit.id}
      </nav>

      <header className="mb-8">
        <p className="small-caps text-xs text-muted">
          {isHebrew ? "Hebrew" : "Greek"} · Strong&apos;s {hit.id}
          {gloss ? ` · ${gloss}` : ""}
        </p>
        <h1 className="mt-1 flex flex-wrap items-baseline gap-4">
          <span className={`${isHebrew ? "lang-hebrew" : "lang-greek"} text-4xl`}>
            {entry.lemma ?? tyndale[0]?.lemma}
          </span>
          <span className="font-editorial text-2xl text-muted">
            {entry.xlit ?? tyndale[0]?.xlit}
          </span>
          {entry.pron && <span className="text-base italic text-muted">{entry.pron}</span>}
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {(entry.strongs_def || entry.derivation || entry.kjv_def) && (
            <section className="rounded-[4px] border border-rule bg-surface p-5">
              <h2 className="small-caps mb-2 text-sm text-muted">Strong&apos;s</h2>
              {entry.strongs_def && (
                <p className="font-[family-name:var(--font-reader)] text-lg leading-relaxed">
                  {entry.strongs_def}
                </p>
              )}
              {entry.derivation && (
                <p className="mt-3 text-sm text-muted">
                  <span className="font-semibold">Derivation:</span> {entry.derivation}
                </p>
              )}
              {entry.kjv_def && (
                <p className="mt-3 text-sm">
                  <span className="font-semibold">The KJV renders it:</span> {entry.kjv_def}
                </p>
              )}
              <p className="mt-4 border-t border-rule pt-3 text-xs text-muted">
                Strong&apos;s Exhaustive Concordance (public domain), via the Open
                Scriptures edition.
              </p>
            </section>
          )}

          {tyndale.length > 0 && (
            <section className="rounded-[4px] border border-rule bg-surface p-5">
              <h2 className="small-caps mb-2 text-sm text-muted">
                {isHebrew ? "TBESH · Tyndale Brief Lexicon (Hebrew)" : "TBESG · Tyndale Brief Lexicon (Greek)"}
              </h2>
              <div className="space-y-5">
                {tyndale.map((v) => (
                  <div key={v.id}>
                    <p className="flex flex-wrap items-baseline gap-3">
                      <span className="small-caps text-xs text-muted">{v.id}</span>
                      <span className="font-semibold">{v.gloss}</span>
                      {v.pos && <span className="text-xs italic text-muted">{v.pos}</span>}
                      {v.rel && v.u !== v.id && (
                        <span className="text-xs text-muted">
                          {v.rel} {v.u}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-line font-[family-name:var(--font-reader)] text-base leading-relaxed">
                      {v.def}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-rule pt-3 text-xs text-muted">
                Data created by www.STEPBible.org based on work at Tyndale House
                Cambridge (CC BY 4.0).
              </p>
            </section>
          )}

          <section>
            <h2 className="section-rule small-caps mb-4 text-sm">
              {total} occurrence{total === 1 ? "" : "s"} in the canon
            </h2>
            {occurrences.length === 0 ? (
              <p className="text-sm text-muted">
                No occurrences found in the tagged text.
              </p>
            ) : (
              <ul className="space-y-3">
                {occurrences.map((o, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    <Link
                      href={`/read/${o.book.slug}/${o.chapter}#v${o.verse}`}
                      className="font-semibold text-sapphire no-underline hover:underline"
                    >
                      {o.book.name} {o.chapter}:{o.verse}
                    </Link>{" "}
                    <span className="font-[family-name:var(--font-reader)]">{o.text}</span>
                  </li>
                ))}
                {total > occurrences.length && (
                  <li className="text-xs text-muted">
                    …and {total - occurrences.length} more.
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>

        <aside>
          <div className="sticky top-6 rounded-[4px] border border-rule bg-surface p-4">
            <h2 className="small-caps mb-3 text-sm text-muted">Distribution</h2>
            {byBook.length === 0 ? (
              <p className="text-xs text-muted">No distribution to show.</p>
            ) : (
              <ul className="space-y-1.5">
                {byBook.map(({ book, count }) => (
                  <li key={book.slug} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 truncate">{book.name}</span>
                    <span
                      className="h-2 rounded-sm bg-sapphire"
                      style={{ width: `${Math.max(4, (count / maxCount) * 120)}px` }}
                    />
                    <span className="text-muted">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
