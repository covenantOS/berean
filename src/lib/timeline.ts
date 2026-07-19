import { promises as fs } from "fs";
import path from "path";
import { getBook } from "./canon";
import { getRights } from "./rights";

/**
 * The Timeline: a curated biblical chronology, rendered as quiet SVG era
 * bands in the workspace's timeline tab. The event list is hand-curated at
 * data/timeline/events.json following Ussher's public-domain chronology for
 * the OT (rights id "ussher-chronology") with honest approximate flags; every
 * event cross-links canonical passages and, where one exists, a TIPNR
 * Factbook entity. No rendering library — arithmetic and SVG, like the Atlas.
 */

export interface TimelineRef {
  slug: string;
  chapter: number;
  verse?: number;
}

export interface TimelineEvent {
  id: string;
  label: string;
  /** Astronomical-style year: negative is BC, positive is AD. */
  year: number;
  /** End year for kind "period". */
  end?: number;
  kind: "event" | "period";
  approx?: boolean;
  /** Canonical passages; omitted for events known only from the secular record. */
  refs?: TimelineRef[];
  entity?: string;
  note?: string;
}

export interface TimelineEra {
  id: string;
  label: string;
  /** Inclusive bounds; negative is BC. */
  start: number;
  end: number;
}

/** The era bands, oldest first. Every event falls inside exactly one era. */
export const TIMELINE_ERAS: TimelineEra[] = [
  { id: "patriarchs", label: "Primeval and the Patriarchs", start: -4004, end: -1492 },
  { id: "exodus-conquest", label: "Exodus and Conquest", start: -1491, end: -1375 },
  { id: "judges", label: "The Judges", start: -1374, end: -1096 },
  { id: "united-kingdom", label: "The United Kingdom", start: -1095, end: -976 },
  { id: "divided-kingdom", label: "The Divided Kingdom", start: -975, end: -589 },
  { id: "exile", label: "The Exile", start: -588, end: -537 },
  { id: "return", label: "The Return", start: -536, end: -401 },
  { id: "intertestamental", label: "Between the Testaments", start: -400, end: -5 },
  { id: "new-testament", label: "The New Testament", start: -4, end: 34 },
  { id: "church", label: "The Early Church", start: 35, end: 100 },
];

interface TimelineData {
  events: TimelineEvent[];
}

let dataPromise: Promise<TimelineEvent[] | null> | null = null;

function timelineAvailable(): boolean {
  return getRights("ussher-chronology")?.status === "shipped";
}

async function loadEvents(): Promise<TimelineEvent[] | null> {
  if (!timelineAvailable()) return null;
  if (!dataPromise) {
    dataPromise = fs
      .readFile(path.join(process.cwd(), "data", "timeline", "events.json"), "utf8")
      .then((raw) => (JSON.parse(raw) as TimelineData).events)
      .catch(() => null);
  }
  return dataPromise;
}

/** Every curated event, oldest first; null when the chronology is not furnished. */
export async function listTimelineEvents(): Promise<TimelineEvent[] | null> {
  const events = await loadEvents();
  if (!events) return null;
  return [...events].sort((a, b) => a.year - b.year);
}

export async function getTimelineEvent(id: string): Promise<TimelineEvent | null> {
  const events = await loadEvents();
  return events?.find((e) => e.id === id) ?? null;
}

/** Events linked to a TIPNR entity, for the Factbook's "On the timeline". */
export async function eventsForEntity(entityId: string): Promise<TimelineEvent[]> {
  const events = (await listTimelineEvents()) ?? [];
  return events.filter((e) => e.entity === entityId);
}

/** The era an event belongs to (by its start year). */
export function eraFor(event: TimelineEvent): TimelineEra {
  return (
    TIMELINE_ERAS.find((era) => event.year >= era.start && event.year <= era.end) ??
    TIMELINE_ERAS[TIMELINE_ERAS.length - 1]
  );
}

/** "-1491" renders "1491 BC", "33" renders "AD 33"; approximate gets "~". */
export function formatYear(year: number, approx = false): string {
  const label = year < 0 ? `${-year} BC` : `AD ${year}`;
  return approx ? `~${label}` : label;
}

export function formatEventYears(event: TimelineEvent): string {
  if (event.end !== undefined && event.end !== event.year) {
    return `${formatYear(event.year, event.approx)} – ${formatYear(event.end)}`;
  }
  return formatYear(event.year, event.approx);
}

/** A reference rendered "Genesis 12:1" / "Exodus 19"; null-safe against canon drift. */
export function formatRef(ref: TimelineRef): string {
  const book = getBook(ref.slug);
  const name = book?.name ?? ref.slug;
  return ref.verse ? `${name} ${ref.chapter}:${ref.verse}` : `${name} ${ref.chapter}`;
}

export function refHref(ref: TimelineRef): string {
  return `/read/${ref.slug}/${ref.chapter}${ref.verse ? `#v${ref.verse}` : ""}`;
}
