import Link from "next/link";
import { CANON, TOTAL_CHAPTERS } from "@/lib/canon";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <section className="mb-10 border-b border-rule pb-10">
        <p className="small-caps mb-3 text-sm text-sapphire">A study prepared</p>
        <h1 className="font-editorial max-w-2xl text-3xl font-bold leading-snug sm:text-4xl">
          Examining the Scriptures daily, to see if these things are so.
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Berean is software for Scripture study and authored knowledge: a
          beautiful reader, private marginalia you own, a whole-canon
          concordance, and sermon study projects with cited research briefs.
          Acts 17:11.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/read/john/1"
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white no-underline hover:opacity-90"
          >
            Open the reader
          </Link>
          <Link
            href="/study"
            className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium text-ink no-underline hover:bg-paper"
          >
            Start a study project
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          href="/read"
          accent="border-t-sapphire"
          title="Read"
          body={`The complete canon — ${CANON.length} books, ${TOTAL_CHAPTERS.toLocaleString()} chapters — set with typographic care. Poetry as poetry, warm paper and evening modes, notes in the margin.`}
        />
        <Card
          href="/study"
          accent="border-t-ruby"
          title="Study"
          body="Sermon and teaching projects linked to a passage. The Scribe prepares a cited exegetical brief; every claim opens to the text it stands on."
        />
        <Card
          href="/search"
          accent="border-t-amber"
          title="Concordance"
          body="Search every word of the canon. Each result opens the passage at the verse, in context."
        />
        <Card
          href="/sources"
          accent="border-t-emerald"
          title="Sources"
          body="The rights and provenance registry. Berean documents the source and license of every text it ships — nothing is implied that isn't licensed."
        />
      </section>

      <section className="mt-12 rounded-[4px] border border-rule bg-surface p-6">
        <h2 className="small-caps mb-2 text-sm text-muted">The house being built</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          The Chapel, the Writing Desk, the Pulpit, and the Almanac are rooms
          still to come — liturgy composition, theological writing, the full
          preaching pipeline, and the ordered calendar — built on this same
          foundation of passages, sources, notes, and projects. Berean is a
          sibling product to Covenant OS by Church Posting, and will integrate
          with the life of the congregation through explicit, approved
          contracts.
        </p>
      </section>
    </div>
  );
}

function Card({
  href,
  title,
  body,
  accent,
}: {
  href: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-[4px] border border-rule border-t-4 ${accent} bg-surface p-5 no-underline transition-colors hover:bg-paper`}
    >
      <h2 className="font-editorial mb-2 text-lg font-bold text-ink">{title}</h2>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </Link>
  );
}
