import Link from "next/link";
import { CANON, TOTAL_CHAPTERS } from "@/lib/canon";
import { getVerses } from "@/lib/bible";
import { dailyRef } from "@/lib/daily-verse";

// The daily verse turns over with the calendar, so render per request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const daily = dailyRef(new Date());
  const dailyVerses = await getVerses(daily.slug, daily.chapter, daily.verse, daily.verse);
  const dailyText = dailyVerses?.[0]?.text ?? null;
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

      {dailyText && (
        <section className="mb-10 border-b border-rule pb-10">
          <p className="small-caps mb-3 text-sm text-muted">The day's portion</p>
          <blockquote className="font-editorial max-w-2xl text-xl leading-relaxed text-ink sm:text-2xl">
            {dailyText}
          </blockquote>
          <p className="mt-3 text-sm">
            <Link
              href={`/read/${daily.slug}/${daily.chapter}#v${daily.verse}`}
              className="text-sapphire no-underline hover:underline"
            >
              {daily.label}
            </Link>
            <span className="text-muted"> (KJV)</span>
          </p>
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          href="/read"
          accent="border-t-sapphire"
          title="The Reading Desk"
          body={`The complete canon — ${CANON.length} books, ${TOTAL_CHAPTERS.toLocaleString()} chapters — set with typographic care. Poetry as poetry, warm paper and evening modes, marginalia you own, reading plans, and memory work.`}
        />
        <Card
          href="/pulpit"
          accent="border-t-ruby"
          title="The Pulpit"
          body="Sermon preparation as a craftsman's pipeline: the appointed text, the Scribe's cited brief, then your exegesis, argument, outline, manuscript, and delivery — archived and searchable for life."
        />
        <Card
          href="/chapel"
          accent="border-t-amber"
          title="The Chapel"
          body="The Lord's Day service built from the full historic vocabulary — call to worship, confession, assurance, psalms, the Table, the benediction — with settled forms, printing, and family worship."
        />
        <Card
          href="/desk"
          accent="border-t-violet"
          title="The Writing Desk"
          body="A manuscript room for theological work. Scripture inserts as verified quotation; footnotes behave; the Scribe reads drafts as an honest critic and holds every quotation to the text."
        />
        <Card
          href="/library"
          accent="border-t-emerald"
          title="The Library"
          body="The deep room: whole-canon concordance and word studies today; the original languages and the public-domain commentary shelf as verified texts are secured. It never speaks without footnotes."
        />
        <Card
          href="/almanac"
          accent="border-t-sapphire"
          title="The Almanac"
          body="The room that governs time: the preaching and teaching calendar, reading plans, memory reviews, and the rule of life — the day's appointed portion always laid out before you."
        />
      </section>

      <section className="mt-12 rounded-[4px] border border-rule bg-surface p-6">
        <h2 className="small-caps mb-2 text-sm text-muted">One house, one foundation</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          The rooms share one knowledge graph: a note taken at the Reading Desk is
          available at the Pulpit, a liturgy drafted in the Chapel answers the
          sermon being built, and the Almanac watches over all of it. Your work is
          private by default, exportable in full from{" "}
          <Link href="/settings" className="text-sapphire">
            Settings
          </Link>
          , and every text Berean ships is documented in{" "}
          <Link href="/sources" className="text-sapphire">
            Sources &amp; rights
          </Link>
          . Berean is a sibling product to Covenant OS by Church Posting and will
          integrate with the life of the congregation through explicit, approved
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
