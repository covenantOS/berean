import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import { LexiconEntry, lexiconAvailable } from "@/lib/lexicon";
import LexiconLookup from "./LexiconLookup";

export const metadata = { title: "Lexicon" };

type Row = { id: string; entry: LexiconEntry };

async function searchLexicon(q: string): Promise<Row[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const out: Row[] = [];
  for (const which of ["hebrew", "greek"] as const) {
    try {
      const file = path.join(process.cwd(), "data", "lexicon", `strongs-${which}.json`);
      const dict = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, LexiconEntry>;
      for (const [id, entry] of Object.entries(dict)) {
        if (
          entry.lemma?.toLowerCase().includes(needle) ||
          entry.xlit?.toLowerCase().includes(needle) ||
          entry.kjv_def?.toLowerCase().includes(needle) ||
          entry.strongs_def?.toLowerCase().includes(needle)
        ) {
          out.push({ id, entry });
          if (out.length >= 60) return out;
        }
      }
    } catch {
      /* dictionary not furnished */
    }
  }
  return out;
}

export default async function LexiconIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const available = await lexiconAvailable();
  const results = q ? await searchLexicon(q) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/library" className="text-sapphire no-underline hover:underline">
          Library
        </Link>{" "}
        / Lexicon
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl">The Lexicon</h1>
        <p className="mt-2 text-sm text-muted">
          Strong&apos;s Hebrew and Greek dictionaries (public domain). Enter a
          Strong&apos;s number — H7225, G26 — or search a transliteration or
          definition.
        </p>
      </header>

      {!available ? (
        <p className="rounded-[4px] border border-rule bg-surface p-5 text-sm text-muted">
          The Strong&apos;s dictionaries are not furnished on this device yet.
        </p>
      ) : (
        <>
          <LexiconLookup />
          <form method="get" className="mt-3">
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search definitions — e.g. love, covenant, agape"
              className="w-full rounded-[4px] border border-rule bg-surface px-4 py-2.5 text-sm outline-none focus:border-sapphire"
            />
          </form>

          {q && (
            <section className="mt-8">
              <h2 className="section-rule small-caps mb-4 text-sm">
                {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
              </h2>
              {results.length === 0 ? (
                <p className="text-sm text-muted">Nothing in the dictionaries matches.</p>
              ) : (
                <ul className="space-y-3">
                  {results.map(({ id, entry }) => (
                    <li key={id} className="rounded-[4px] border border-rule bg-surface p-4">
                      <Link
                        href={`/lexicon/${id}`}
                        className="flex flex-wrap items-baseline gap-3 no-underline"
                      >
                        <span className="small-caps text-xs text-muted">{id}</span>
                        <span
                          className={`${id.startsWith("H") ? "lang-hebrew" : "lang-greek"} text-xl text-ink`}
                        >
                          {entry.lemma}
                        </span>
                        <span className="font-editorial text-muted">{entry.xlit}</span>
                      </Link>
                      {entry.kjv_def && (
                        <p className="mt-1 text-sm text-muted">KJV: {entry.kjv_def}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
