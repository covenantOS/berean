"use client";

/**
 * The frequency graph for a result set: hits counted by book or by chapter
 * and drawn as bar, column, pie, donut, line, or area. Hand-rolled SVG in
 * the timeline's idiom (src/components/TimelineChart.tsx): the workspace's
 * stained-glass tokens, a <title> tooltip on every mark, no charting
 * library. Every mark answers a click through onSelect, so a book bar can
 * drill into its chapters and a chapter column can open the passage.
 */

export interface ChartSlice {
  key: string;
  label: string;
  value: number;
}

export type ChartKind = "bar" | "column" | "pie" | "donut" | "line" | "area";

export const CHART_KINDS: { key: ChartKind; label: string }[] = [
  { key: "bar", label: "Bar" },
  { key: "column", label: "Column" },
  { key: "pie", label: "Pie" },
  { key: "donut", label: "Donut" },
  { key: "line", label: "Line" },
  { key: "area", label: "Area" },
];

const SAPPHIRE = "var(--stained-sapphire)";
const AMBER = "var(--stained-amber)";
const RULE = "var(--rule)";
const MUTED = "var(--ink-muted)";

/** Beyond this many slices a pie reads as noise; the tail folds into Other. */
const PIE_MAX_SLICES = 12;

export default function SearchChart({
  series,
  kind,
  onKindChange,
  onSelect,
}: {
  series: ChartSlice[];
  kind: ChartKind;
  /** When given, the kind switcher renders above the graph. */
  onKindChange?: (kind: ChartKind) => void;
  onSelect?: (key: string) => void;
}) {
  const total = series.reduce((n, s) => n + s.value, 0);
  return (
    <div>
      {onKindChange && (
        <div className="seg mb-2" role="group" aria-label="Chart type">
          {CHART_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              aria-pressed={kind === k.key}
              onClick={() => onKindChange(k.key)}
              className="small-caps"
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
      {total === 0 ? (
        <p className="py-6 text-center text-xs text-muted">Nothing to graph.</p>
      ) : (
        /* The kind names its own graph; keying the wrapper lets a kind swap
         * draw the new graph in rather than snapping. */
        <div key={kind} className="fx-rise">
          {kind === "bar" ? (
            <BarChart series={series} onSelect={onSelect} />
          ) : kind === "column" ? (
            <ColumnChart series={series} onSelect={onSelect} />
          ) : kind === "line" || kind === "area" ? (
            <LineChart series={series} area={kind === "area"} onSelect={onSelect} />
          ) : (
            <PieChart series={series} donut={kind === "donut"} onSelect={onSelect} />
          )}
        </div>
      )}
    </div>
  );
}

function sliceColor(i: number): string {
  return i % 2 === 0 ? SAPPHIRE : AMBER;
}

function sliceOpacity(i: number): number {
  return 0.95 - (i % 5) * 0.16;
}

/* ---------- bar: one horizontal row per category ---------- */

function BarChart({
  series,
  onSelect,
}: {
  series: ChartSlice[];
  onSelect?: (key: string) => void;
}) {
  const LABEL_W = 130;
  const COUNT_W = 44;
  const ROW_H = 18;
  const W = 720;
  const max = Math.max(1, ...series.map((s) => s.value));
  const H = series.length * ROW_H + 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Frequency by row">
      {series.map((s, i) => {
        const y = 4 + i * ROW_H;
        const bw = (s.value / max) * (W - LABEL_W - COUNT_W - 16);
        return (
          <g
            key={s.key}
            onClick={() => onSelect?.(s.key)}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            <title>{`${s.label}: ${s.value.toLocaleString()}`}</title>
            <text x={LABEL_W - 6} y={y + ROW_H / 2 + 3.5} textAnchor="end" fontSize={10} fill={MUTED}>
              {s.label}
            </text>
            {s.value > 0 && (
              <rect
                x={LABEL_W}
                y={y + 3}
                width={Math.max(2, bw)}
                height={ROW_H - 6}
                fill={SAPPHIRE}
                opacity={0.85}
              />
            )}
            {s.value > 0 && (
              <text x={LABEL_W + Math.max(2, bw) + 5} y={y + ROW_H / 2 + 3.5} fontSize={9} fill={MUTED}>
                {s.value.toLocaleString()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- column / line / area: one slot per category, scrolling ---------- */

const SLOT = 16;
const PLOT_H = 190;
const AXIS_H = 24;
const SIDE = 20;

function plotWidth(count: number): number {
  return Math.max(360, count * SLOT + SIDE * 2);
}

function ColumnChart({
  series,
  onSelect,
}: {
  series: ChartSlice[];
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const W = plotWidth(series.length);
  const base = PLOT_H;
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={PLOT_H + AXIS_H} role="img" aria-label="Frequency by column">
        <line x1={SIDE} x2={W - SIDE} y1={base} y2={base} stroke={RULE} strokeWidth={1} />
        {series.map((s, i) => {
          const h = (s.value / max) * (PLOT_H - 16);
          const x = SIDE + i * SLOT + 2;
          return (
            <g
              key={s.key}
              onClick={() => onSelect?.(s.key)}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              <title>{`${s.label}: ${s.value.toLocaleString()}`}</title>
              {s.value > 0 && (
                <rect x={x} y={base - h} width={SLOT - 4} height={h} fill={SAPPHIRE} opacity={0.85} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LineChart({
  series,
  area,
  onSelect,
}: {
  series: ChartSlice[];
  area: boolean;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const W = plotWidth(series.length);
  const base = PLOT_H;
  const points = series.map((s, i) => ({
    s,
    x: SIDE + i * SLOT + SLOT / 2,
    y: base - (s.value / max) * (PLOT_H - 16),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const fill = `${SIDE},${base} ${line} ${W - SIDE},${base}`;
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={PLOT_H + AXIS_H} role="img" aria-label="Frequency trend">
        <line x1={SIDE} x2={W - SIDE} y1={base} y2={base} stroke={RULE} strokeWidth={1} />
        {area && <polygon points={fill} fill={SAPPHIRE} opacity={0.14} />}
        <polyline points={line} fill="none" stroke={SAPPHIRE} strokeWidth={1.5} />
        {points.map((p) => (
          <circle
            key={p.s.key}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={SAPPHIRE}
            onClick={() => onSelect?.(p.s.key)}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            <title>{`${p.s.label}: ${p.s.value.toLocaleString()}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/* ---------- pie and donut: share of the result set ---------- */

interface PieSlice extends ChartSlice {
  from: number;
  to: number;
}

function pieSlices(series: ChartSlice[]): { slices: PieSlice[]; folded: number } {
  const ranked = series
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const kept = ranked.slice(0, PIE_MAX_SLICES - 1);
  const rest = ranked.slice(PIE_MAX_SLICES - 1);
  const rows =
    rest.length > 0
      ? [...kept, { key: "__other", label: "Other", value: rest.reduce((n, s) => n + s.value, 0) }]
      : kept;
  const total = rows.reduce((n, s) => n + s.value, 0) || 1;
  let angle = -Math.PI / 2;
  const slices = rows.map((s) => {
    const from = angle;
    angle += (s.value / total) * Math.PI * 2;
    return { ...s, from, to: angle };
  });
  return { slices, folded: rest.length };
}

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function slicePath(cx: number, cy: number, r: number, from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function donutPath(cx: number, cy: number, r: number, inner: number, from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const [x3, y3] = polar(cx, cy, inner, to);
  const [x4, y4] = polar(cx, cy, inner, from);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

function PieChart({
  series,
  donut,
  onSelect,
}: {
  series: ChartSlice[];
  donut: boolean;
  onSelect?: (key: string) => void;
}) {
  const { slices, folded } = pieSlices(series);
  const CX = 110;
  const CY = 110;
  const R = 96;
  const INNER = 52;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={220} height={220} role="img" aria-label="Share of results" className="shrink-0">
        {slices.length === 1 ? (
          // An arc from a point to itself draws nothing; one slice is a ring.
          <>
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill={sliceColor(0)}
              opacity={sliceOpacity(0)}
              onClick={() => onSelect?.(slices[0].key)}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              <title>{`${slices[0].label}: ${slices[0].value.toLocaleString()}`}</title>
            </circle>
            {donut && <circle cx={CX} cy={CY} r={INNER} fill="var(--signal-paper)" />}
          </>
        ) : (
          slices.map((s, i) => (
            <path
              key={s.key}
              d={donut ? donutPath(CX, CY, R, INNER, s.from, s.to) : slicePath(CX, CY, R, s.from, s.to)}
              fill={s.key === "__other" ? MUTED : sliceColor(i)}
              opacity={s.key === "__other" ? 0.5 : sliceOpacity(i)}
              stroke="var(--signal-paper)"
              strokeWidth={1}
              onClick={s.key === "__other" ? undefined : () => onSelect?.(s.key)}
              className={onSelect && s.key !== "__other" ? "cursor-pointer" : undefined}
            >
              <title>{`${s.label}: ${s.value.toLocaleString()}`}</title>
            </path>
          ))
        )}
      </svg>
      <ul className="min-w-0 flex-1 space-y-0.5">
        {slices.slice(0, 8).map((s, i) => (
          <li key={s.key} className="flex items-baseline gap-2 text-[0.7rem]">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 self-center"
              style={{ background: s.key === "__other" ? MUTED : sliceColor(i), opacity: sliceOpacity(i) }}
            />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 text-muted">{s.value.toLocaleString()}</span>
          </li>
        ))}
        {slices.length > 8 && (
          <li className="text-[0.66rem] text-muted">and {slices.length - 8} more slices</li>
        )}
        {folded > 0 && (
          <li className="text-[0.66rem] text-muted">
            Other folds in {folded} {folded === 1 ? "row" : "rows"}.
          </li>
        )}
      </ul>
    </div>
  );
}
