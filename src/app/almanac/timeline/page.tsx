import Link from "next/link";
import type { Metadata } from "next";
import TimelineChart, { TimelineEraView } from "@/components/TimelineChart";
import {
  TIMELINE_ERAS,
  eraFor,
  formatEventYears,
  formatRef,
  formatYear,
  listTimelineEvents,
  refHref,
} from "@/lib/timeline";

export const metadata: Metadata = {
  title: "The Timeline",
  description:
    "A biblical chronology from creation to the early church, in era bands, linked to the reader and the Factbook.",
};

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const events = await listTimelineEvents();

  if (!events) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="font-editorial mb-1 text-2xl font-bold">The Timeline</h1>
        <p className="text-sm text-muted">
          The timeline is not furnished in this build — it ships only when the
          curated chronology is present and registered in the rights registry.
        </p>
      </div>
    );
  }

  const eras: TimelineEraView[] = TIMELINE_ERAS.map((era) => ({
    id: era.id,
    label: era.label,
    start: era.start,
    end: era.end,
    startLabel: formatYear(era.start),
    endLabel: formatYear(era.end),
    events: events
      .filter((e) => eraFor(e).id === era.id)
      .map((e) => ({
        id: e.id,
        label: e.label,
        year: e.year,
        end: e.end,
        kind: e.kind,
        approx: e.approx,
        yearsLabel: formatEventYears(e),
        note: e.note,
        refs: (e.refs ?? []).map((r) => ({ label: formatRef(r), href: refHref(r) })),
        entity: e.entity,
        eraId: era.id,
      })),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/almanac" className="text-sapphire no-underline hover:underline">
          The Almanac
        </Link>{" "}
        / The Timeline
      </nav>

      <h1 className="font-editorial mb-1 text-2xl font-bold">The Timeline</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        {events.length} events from creation to the Revelation, banded by era.
        Old Testament years follow Ussher&apos;s public-domain chronology;
        ancient dates are approximate, and the contested ones say so. Every
        event opens its passages in the reader and, where the Factbook knows
        the person or place, its entry there. Select a marker to see its
        references.
      </p>

      <TimelineChart eras={eras} focusId={event} />
    </div>
  );
}
