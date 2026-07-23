"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { playSound } from "@/lib/sound";

/**
 * The interactive chronology chart. Eras and events arrive fully computed
 * from the server (src/lib/timeline.ts); this component only handles finding,
 * focusing, and selecting events. One SVG per era band, a shared arithmetic
 * scale within each, no charting library and no engagement mechanics.
 */

export interface TimelineRefView {
  label: string;
  href: string;
}

export interface TimelineEventView {
  id: string;
  label: string;
  year: number;
  end?: number;
  kind: "event" | "period";
  approx?: boolean;
  yearsLabel: string;
  note?: string;
  refs: TimelineRefView[];
  entity?: string;
  eraId: string;
}

export interface TimelineEraView {
  id: string;
  label: string;
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
  events: TimelineEventView[];
}

const W = 1200;
const PAD = 30;
const ROW_H = 17;
const AXIS_H = 30;

function xOf(year: number, start: number, end: number): number {
  return PAD + ((year - start) / (end - start)) * (W - PAD * 2);
}

function tickStep(span: number): number {
  const target = span / 9;
  for (const s of [10, 25, 50, 100, 250, 500, 1000]) if (target <= s) return s;
  return 1000;
}

interface Placed {
  event: TimelineEventView;
  x: number;
  x2?: number;
  row: number;
}

function placeEvents(events: TimelineEventView[], start: number, end: number): Placed[] {
  const sorted = [...events].sort((a, b) => a.year - b.year);
  const rowEnds: number[] = [];
  return sorted.map((event) => {
    const x = xOf(event.year, start, end);
    const x2 = event.end !== undefined ? xOf(event.end, start, end) : undefined;
    const width = event.label.length * 6.4 + 14;
    let row = 0;
    while (row < rowEnds.length && x - 4 < rowEnds[row]) row++;
    rowEnds[row] = Math.max(x, x2 ?? x) + width;
    return { event, x, x2, row };
  });
}

export default function TimelineChart({
  eras,
  focusId,
}: {
  eras: TimelineEraView[];
  focusId?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);
  const detailRef = useRef<HTMLDivElement>(null);

  const allEvents = useMemo(() => eras.flatMap((e) => e.events), [eras]);
  const selected = allEvents.find((e) => e.id === selectedId) ?? null;

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (q.length < 2) return [];
    return allEvents
      .filter((e) => e.label.toLowerCase().includes(q) || e.note?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allEvents, q]);

  useEffect(() => {
    if (focusId) detailRef.current?.scrollIntoView({ block: "nearest" });
  }, [focusId]);

  function select(id: string) {
    setSelectedId(id);
    playSound("navigate");
  }

  return (
    <div>
      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an event — Exodus, exile, Pentecost…"
          aria-label="Find an event on the timeline"
          className="w-full max-w-xs rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
      </div>

      {matches.length > 0 && (
        <ul className="fx-stagger mb-4 flex flex-wrap gap-1.5">
          {matches.map((m, i) => (
            <li key={m.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <button
                onClick={() => select(m.id)}
                className="glass glass-hover fx-press inline-block rounded-[3px] px-1.5 py-0.5 text-xs text-sapphire"
              >
                {m.label} <span className="text-muted">{m.yearsLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div
          ref={detailRef}
          className="glass fx-fade mb-6 rounded-[4px] p-5 text-sm"
        >
          <p className="font-editorial text-lg font-bold">{selected.label}</p>
          <p className="small-caps mb-2 text-xs text-muted">{selected.yearsLabel}</p>
          {selected.note && <p className="mb-3 max-w-2xl text-muted">{selected.note}</p>}
          {selected.refs.length > 0 && (
            <p>
              {selected.refs.map((r, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <a href={r.href} className="text-sapphire no-underline hover:underline">
                    {r.label}
                  </a>
                </span>
              ))}
            </p>
          )}
          {selected.entity && (
            <p className="mt-2">
              <a
                href={`/workspace?tab=factbook:${selected.entity}`}
                className="text-sapphire no-underline hover:underline"
              >
                Open in the Factbook
              </a>
            </p>
          )}
        </div>
      )}

      <div className="space-y-8">
        {eras.map((era) => (
          <EraBand
            key={era.id}
            era={era}
            selectedId={selectedId}
            matchIds={new Set(matches.map((m) => m.id))}
            onSelect={select}
          />
        ))}
      </div>

      <p className="mt-4 text-[0.68rem] text-muted">
        Chronology: Ussher&apos;s Annals of the World (1658, public domain) for
        the Old Testament; standard conservative dates for the New. Ancient
        dates are approximate — a &ldquo;~&rdquo; marks entries that are
        approximate or disputed even within that scheme.
      </p>
    </div>
  );
}

function EraBand({
  era,
  selectedId,
  matchIds,
  onSelect,
}: {
  era: TimelineEraView;
  selectedId: string | null;
  matchIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const placed = placeEvents(era.events, era.start, era.end);
  const rows = placed.reduce((max, p) => Math.max(max, p.row), 0);
  const axisY = rows * ROW_H + 22;
  const height = axisY + AXIS_H;

  const span = era.end - era.start;
  const step = tickStep(span);
  const ticks: number[] = [];
  for (let t = Math.ceil(era.start / step) * step; t <= era.end; t += step) ticks.push(t);

  return (
    <section id={era.id}>
      <h2 className="small-caps mb-1 text-sm text-muted">
        {era.label} <span className="text-xs">· {era.startLabel} – {era.endLabel}</span>
      </h2>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={`Timeline: ${era.label}`}
        className="w-full rounded-[4px] border border-rule bg-white"
        fontFamily="var(--font-editorial, Georgia, serif)"
      >
        {/* axis and year ticks */}
        <line x1={PAD} x2={W - PAD} y1={axisY} y2={axisY} stroke="var(--rule)" strokeWidth={1} />
        {ticks.map((t) => {
          const x = xOf(t, era.start, era.end);
          const label = t < 0 ? `${-t}` : `AD ${t}`;
          return (
            <g key={t}>
              <line x1={x} x2={x} y1={axisY} y2={axisY + 5} stroke="var(--rule)" strokeWidth={1} />
              <text x={x} y={axisY + 16} fontSize={10} textAnchor="middle" fill="var(--ink-muted, #6d5f4b)">
                {label}
              </text>
            </g>
          );
        })}

        {/* events */}
        {placed.map(({ event, x, x2, row }) => {
          const active = event.id === selectedId;
          const matched = matchIds.has(event.id);
          const labelY = row * ROW_H + 11;
          const color =
            active || matched ? "var(--stained-amber)" : "var(--stained-sapphire)";
          return (
            <g
              key={event.id}
              onClick={() => onSelect(event.id)}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`${event.label}, ${event.yearsLabel}`}
            >
              {x2 !== undefined ? (
                <rect
                  x={x}
                  y={labelY - 6}
                  width={Math.max(4, x2 - x)}
                  height={6}
                  rx={2}
                  fill={color}
                  fillOpacity={active ? 0.95 : 0.55}
                />
              ) : (
                <circle
                  cx={x}
                  cy={labelY - 3}
                  r={active ? 4 : 3}
                  fill={color}
                  stroke="white"
                  strokeWidth={0.8}
                />
              )}
              <line
                x1={x2 !== undefined ? (x + x2) / 2 : x}
                x2={x2 !== undefined ? (x + x2) / 2 : x}
                y1={labelY}
                y2={axisY}
                stroke="var(--rule)"
                strokeWidth={0.5}
                strokeDasharray="2 2"
              />
              <text
                x={(x2 !== undefined ? x + Math.max(4, x2 - x) : 0) + 7}
                y={labelY}
                fontSize={11}
                fontWeight={active || matched ? "bold" : "normal"}
                fill="var(--ink, #221d15)"
              >
                {event.label}
                {event.approx ? " ~" : ""}
              </text>
              <title>{`${event.label} — ${event.yearsLabel}`}</title>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
