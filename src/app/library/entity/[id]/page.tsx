import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/canon";
import { getEntity, Entity, EntityRelation } from "@/lib/entities";
import { eventsForEntity, formatEventYears } from "@/lib/timeline";
import LocatorMap from "@/components/LocatorMap";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const entity = await getEntity(id);
  return { title: entity ? entity.name : "The Library" };
}

const RELATION_LABELS: [keyof Entity["relations"], string][] = [
  ["parents", "Parents"],
  ["siblings", "Siblings"],
  ["partners", "Married to"],
  ["offspring", "Children"],
];

function RelationGroup({ label, items }: { label: string; items: EntityRelation[] }) {
  if (items.length === 0) return null;
  return (
    <p className="text-sm">
      <span className="small-caps text-xs text-muted">{label}: </span>
      {items.map((r, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {r.id ? (
            <Link
              href={`/library/entity/${r.id}`}
              className="text-sapphire no-underline hover:underline"
            >
              {r.name}
            </Link>
          ) : (
            r.name
          )}
        </span>
      ))}
    </p>
  );
}

export default async function EntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entity = await getEntity(id);
  if (!entity) notFound();

  const timelineEvents = await eventsForEntity(id);

  const byBook = new Map<string, { chapter: number; verse: number }[]>();
  for (const ref of entity.refs) {
    if (!byBook.has(ref.slug)) byBook.set(ref.slug, []);
    byBook.get(ref.slug)!.push({ chapter: ref.chapter, verse: ref.verse });
  }
  const relations = entity.relations;
  const hasRelations = RELATION_LABELS.some(([key]) => relations[key].length > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/library" className="text-sapphire no-underline hover:underline">
          The Library
        </Link>{" "}
        / People and places
      </nav>

      <h1 className="font-editorial mb-1 text-3xl font-bold">{entity.name}</h1>
      <p className="mb-6 text-sm text-muted">
        {entity.kind === "place" ? "Place" : entity.type || "Name"}
        {entity.tribe ? ` · ${entity.tribe}` : ""}
        {entity.tag ? ` · first at ${entity.tag}` : ""}
        {entity.aliases.length > 0 && ` · also ${entity.aliases.join(", ")}`}
      </p>

      {entity.geo && (
        <div className="mb-6 flex flex-wrap items-start gap-6">
          <p className="text-sm text-muted">
            Located at {entity.geo.lat.toFixed(5)}, {entity.geo.lng.toFixed(5)}
            {entity.area ? ` · ${entity.area}` : ""}
          </p>
          <LocatorMap
            id={entity.id}
            name={entity.name}
            lat={entity.geo.lat}
            lng={entity.geo.lng}
          />
        </div>
      )}

      {entity.brief && (
        <p className="font-editorial mb-6 text-lg leading-relaxed">{entity.brief}</p>
      )}
      {entity.short && entity.short !== entity.brief && (
        <p className="mb-6 max-w-2xl text-sm leading-relaxed">{entity.short}</p>
      )}

      {hasRelations && (
        <section className="mb-8 space-y-1.5 rounded-[4px] border border-rule bg-surface p-5">
          {RELATION_LABELS.map(([key, label]) => (
            <RelationGroup key={key} label={label} items={relations[key]} />
          ))}
        </section>
      )}

      {timelineEvents.length > 0 && (
        <section className="mb-8 rounded-[4px] border border-rule bg-surface p-5">
          <h2 className="small-caps mb-2 text-sm text-muted">On the timeline</h2>
          <ul className="space-y-1 text-sm">
            {timelineEvents.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/almanac/timeline?event=${e.id}`}
                  className="text-sapphire no-underline hover:underline"
                >
                  {e.label}
                </Link>{" "}
                <span className="text-xs text-muted">{formatEventYears(e)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {entity.article && (
        <section className="mb-10 max-w-2xl">
          {entity.article.split(/\n\n+/).map((para, i) => (
            <p key={i} className="mb-3 text-sm leading-relaxed">
              {para}
            </p>
          ))}
        </section>
      )}

      <section>
        <h2 className="small-caps mb-3 border-b border-rule pb-2 text-sm text-muted">
          Every reference · {entity.refs.length.toLocaleString()}{" "}
          {entity.refs.length === 1 ? "verse" : "verses"}
        </h2>
        <div className="space-y-4">
          {[...byBook.entries()].map(([slug, refs]) => {
            const book = getBook(slug);
            if (!book) return null;
            return (
              <div key={slug}>
                <p className="mb-1 text-sm font-medium">{book.name}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {refs.map((r, i) => (
                    <li key={i}>
                      <Link
                        href={`/read/${slug}/${r.chapter}#v${r.verse}`}
                        className="inline-block rounded-[3px] border border-rule bg-surface px-1.5 py-0.5 text-xs text-sapphire no-underline hover:border-sapphire"
                      >
                        {r.chapter}:{r.verse}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-6 border-t border-rule pt-3 text-[0.68rem] text-muted">
          People and places: TIPNR, data created by www.STEPBible.org based on
          work at Tyndale House Cambridge (CC BY 4.0).
        </p>
      </section>
    </div>
  );
}
