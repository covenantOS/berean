"use client";

import { useMemo, useState } from "react";

/**
 * The interactive atlas map. Land and projection arrive precomputed from the
 * server (src/lib/atlas.ts); this component only handles finding, filtering,
 * and highlighting places. No engagement mechanics — quiet cartography.
 */

export interface AtlasPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  refs: number;
  major: boolean;
}

export default function AtlasMap({
  viewBox,
  paths,
  points,
  focusId,
}: {
  viewBox: string;
  paths: string[];
  points: AtlasPoint[];
  focusId?: string;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const focus = focusId ? byId.get(focusId) : undefined;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return points.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [points, query]);
  const matchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);

  const visible = showAll ? points : points.filter((p) => p.major);
  const labeled = showAll ? [] : visible;
  const activeId = hoverId ?? focus?.id ?? null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a place — Jerusalem, Antioch, Ur…"
          aria-label="Find a place on the atlas"
          className="w-full max-w-xs rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="accent-[var(--stained-sapphire)]"
          />
          All {points.length.toLocaleString()} places (labels off)
        </label>
      </div>

      {matches.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {matches.map((m) => (
            <li key={m.id}>
              <a
                href={`/workspace?tab=factbook:${m.id}`}
                onMouseEnter={() => setHoverId(m.id)}
                onMouseLeave={() => setHoverId(null)}
                className="inline-block rounded-[3px] border border-rule bg-surface px-1.5 py-0.5 text-xs text-sapphire no-underline hover:border-sapphire"
              >
                {m.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      <svg
        viewBox={viewBox}
        role="img"
        aria-label="Map of the biblical world with TIPNR places"
        className="w-full rounded-[4px] border border-rule bg-white"
      >
        <g fill="var(--surface)" stroke="var(--rule)" strokeWidth={0.5}>
          {paths.map((d, i) => (
            <path key={i} d={d} fillRule="evenodd" />
          ))}
        </g>

        {visible.map((p) => {
          const active = p.id === activeId;
          const matched = matchIds.has(p.id);
          return (
            <a key={p.id} href={`/workspace?tab=factbook:${p.id}`} aria-label={p.name}>
              <circle
                cx={p.x}
                cy={p.y}
                r={active ? 2.4 : matched ? 2 : 1.3}
                fill={
                  active || matched
                    ? "var(--stained-amber)"
                    : p.major
                      ? "var(--stained-sapphire)"
                      : "var(--stained-sapphire)"
                }
                fillOpacity={p.major || active || matched ? 0.95 : 0.45}
                stroke="white"
                strokeWidth={0.35}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <title>{`${p.name} — ${p.refs} reference${p.refs === 1 ? "" : "s"}`}</title>
              </circle>
            </a>
          );
        })}

        <g
          fontFamily="var(--font-editorial, Georgia, serif)"
          fontSize={4.4}
          fill="var(--ink, #221d15)"
          stroke="white"
          strokeWidth={1.1}
          paintOrder="stroke"
        >
          {labeled.map((p) => (
            <text key={p.id} x={p.x + 1.9} y={p.y + 1.4}>
              {p.name}
            </text>
          ))}
          {activeId &&
            (() => {
              const p = byId.get(activeId);
              if (!p) return null;
              return (
                <text x={p.x + 2.4} y={p.y - 1.8} fontSize={5.4} fontWeight="bold">
                  {p.name}
                </text>
              );
            })()}
          {matches
            .filter((m) => m.id !== activeId && !labeled.some((p) => p.id === m.id))
            .map((m) => (
              <text key={m.id} x={m.x + 2.4} y={m.y - 1.8} fontWeight="bold">
                {m.name}
              </text>
            ))}
        </g>
      </svg>

      <p className="mt-2 text-[0.68rem] text-muted">
        Land: Natural Earth 1:110m (public domain). Places: TIPNR, data created
        by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY
        4.0). Modern coastline; ancient boundaries are not implied.
      </p>
    </div>
  );
}
