import { NextResponse } from "next/server";
import {
  TIMELINE_ERAS,
  eraFor,
  formatEventYears,
  formatRef,
  formatYear,
  listTimelineEvents,
  refHref,
} from "@/lib/timeline";

/**
 * The Timeline pane's data: the curated chronology composed into era bands,
 * computed here so the pane stays a client component. The chart it renders
 * matches the retired /almanac/timeline page's.
 */
export async function GET() {
  const events = await listTimelineEvents();
  if (!events) {
    return NextResponse.json({ error: "The timeline is not furnished." }, { status: 404 });
  }
  const eras = TIMELINE_ERAS.map((era) => ({
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
  return NextResponse.json({ count: events.length, eras });
}
