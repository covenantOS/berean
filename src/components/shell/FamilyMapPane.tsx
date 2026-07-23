"use client";

import { useEffect, useMemo, useState } from "react";
import { playSound } from "@/lib/sound";
import { useWorkspace } from "./WorkspaceContext";

interface MapNode {
  id: string | null;
  name: string;
  repeated?: boolean;
}

interface MapUnit {
  members: MapNode[];
  children: MapUnit[];
  parents: MapUnit[];
}

interface MapReport {
  rootId: string;
  rootName: string;
  up: number;
  down: number;
  unit: MapUnit;
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; report: MapReport };

/* ---------- the generational layout ---------- */

/**
 * A hand-rolled tidy layout over the walked graph. Each row is a
 * generation: ancestors above the root, descendants below, partners beside
 * their counterpart in one unit. A unit takes the wider of its own member
 * span and its children's combined spans, and the children center beneath
 * it, so branches never overlap and every edge reads parent to child.
 * Repeated stubs (the visitation guard's cycles) take a cell like any
 * other and never grow children.
 */
const NODE_W = 124;
const NODE_H = 40;
const MEMBER_GAP = 8;
const UNIT_GAP = 26;
const ROW_H = 88;
const PAD = 16;

interface PlacedNode {
  node: MapNode;
  x: number;
  y: number;
}

interface PlacedEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface MapLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

function naturalWidth(u: MapUnit): number {
  return u.members.length * NODE_W + (u.members.length - 1) * MEMBER_GAP;
}

function layoutFamilyMap(report: MapReport): MapLayout {
  const nodes: PlacedNode[] = [];
  const edges: PlacedEdge[] = [];

  const measure = (u: MapUnit, key: "children" | "parents", memo: WeakMap<MapUnit, number>) => {
    const cached = memo.get(u);
    if (cached !== undefined) return cached;
    const next = u[key];
    const span =
      next.reduce((s, c) => s + measure(c, key, memo), 0) +
      Math.max(0, next.length - 1) * UNIT_GAP;
    const w = Math.max(naturalWidth(u), span);
    memo.set(u, w);
    return w;
  };

  /** Places a unit at generation row y, its descendants below; answers the
   * unit's center x, the edge anchor its parent connects to. */
  const placeDown = (
    u: MapUnit,
    x: number,
    y: number,
    memo: WeakMap<MapUnit, number>
  ): { unitCx: number } => {
    const nat = naturalWidth(u);
    const w = measure(u, "children", memo);
    const ux = x + (w - nat) / 2;
    u.members.forEach((m, i) => {
      const mx = ux + i * (NODE_W + MEMBER_GAP);
      nodes.push({ node: m, x: mx, y });
      if (i > 0) {
        edges.push({ x1: mx - MEMBER_GAP, y1: y + NODE_H / 2, x2: mx, y2: y + NODE_H / 2 });
      }
    });
    const kidsW =
      u.children.reduce((s, c) => s + measure(c, "children", memo), 0) +
      Math.max(0, u.children.length - 1) * UNIT_GAP;
    let cx = x + (w - kidsW) / 2;
    for (const c of u.children) {
      const placed = placeDown(c, cx, y + ROW_H, memo);
      edges.push({ x1: ux + nat / 2, y1: y + NODE_H, x2: placed.unitCx, y2: y + ROW_H });
      cx += measure(c, "children", memo) + UNIT_GAP;
    }
    return { unitCx: ux + nat / 2 };
  };

  /** The mirror upward: a unit at row y, its ancestors above. */
  const placeUp = (
    u: MapUnit,
    x: number,
    y: number,
    memo: WeakMap<MapUnit, number>
  ): { unitCx: number } => {
    const nat = naturalWidth(u);
    const w = measure(u, "parents", memo);
    const ux = x + (w - nat) / 2;
    // Members render with the descendants' pass; only ancestors are new.
    const upsW =
      u.parents.reduce((s, p) => s + measure(p, "parents", memo), 0) +
      Math.max(0, u.parents.length - 1) * UNIT_GAP;
    let cx = x + (w - upsW) / 2;
    for (const p of u.parents) {
      p.members.forEach((m, i) => {
        const pnat = naturalWidth(p);
        const pw = measure(p, "parents", memo);
        const pux = cx + (pw - pnat) / 2;
        const mx = pux + i * (NODE_W + MEMBER_GAP);
        nodes.push({ node: m, x: mx, y: y - ROW_H });
        if (i > 0) {
          edges.push({
            x1: mx - MEMBER_GAP,
            y1: y - ROW_H + NODE_H / 2,
            x2: mx,
            y2: y - ROW_H + NODE_H / 2,
          });
        }
      });
      const placed = placeUp(p, cx, y - ROW_H, memo);
      edges.push({ x1: ux + nat / 2, y1: y, x2: placed.unitCx, y2: y - ROW_H + NODE_H });
      cx += measure(p, "parents", memo) + UNIT_GAP;
    }
    return { unitCx: ux + nat / 2 };
  };

  const upDepth = (u: MapUnit): number =>
    u.parents.length === 0 ? 0 : 1 + Math.max(...u.parents.map(upDepth));

  const downMemo = new WeakMap<MapUnit, number>();
  const upMemo = new WeakMap<MapUnit, number>();
  const rootY = PAD + upDepth(report.unit) * ROW_H;
  placeDown(report.unit, PAD, rootY, downMemo);
  placeUp(report.unit, PAD, rootY, upMemo);

  const width = Math.max(...nodes.map((n) => n.x)) + NODE_W + PAD;
  const height = Math.max(...nodes.map((n) => n.y)) + NODE_H + PAD;
  return { nodes, edges, width, height };
}

/* ---------- the pane ---------- */

const MAX_DEPTH = 4;

/**
 * The family map pane: one TIPNR person's kin read off the relationship
 * lists and laid out in generations. A node's name opens its Factbook
 * report; its "root" chip re-roots the map on that person, so any figure
 * can stand at the center. The steppers pace the generations up and down.
 * A dashed name is the visitation guard's repeated stub: the person
 * already stands elsewhere on the map and the walk refused a second copy.
 */
export default function FamilyMapPane({ entityId }: { entityId: string }) {
  const { dispatch } = useWorkspace();
  const [root, setRoot] = useState<{ id: string }>({ id: entityId });
  const [up, setUp] = useState(2);
  const [down, setDown] = useState(2);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(
      `/api/pane/familymap?root=${encodeURIComponent(root.id)}&up=${up}&down=${down}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (res.status === 404) {
          setLoad({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", report: (await res.json()) as MapReport });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [root.id, up, down]);

  const layout = useMemo(
    () => (load.status === "ready" ? layoutFamilyMap(load.report) : null),
    [load]
  );

  const stepper = (value: number, set: (n: number) => void, label: string) => (
    <span className="flex items-center gap-1 text-[0.68rem] text-muted">
      {label}
      <button
        type="button"
        aria-label={`Fewer generations ${label}`}
        disabled={value <= 0}
        onClick={() => set(value - 1)}
        className="fx-press border border-rule bg-paper px-1.5 py-0.5 text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        −
      </button>
      <span className="w-4 text-center font-semibold text-ink">{value}</span>
      <button
        type="button"
        aria-label={`More generations ${label}`}
        disabled={value >= MAX_DEPTH}
        onClick={() => set(value + 1)}
        className="fx-press border border-rule bg-paper px-1.5 py-0.5 text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        +
      </button>
    </span>
  );

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Family map</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">
          {load.status === "ready" ? load.report.rootName : "…"}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          {stepper(up, setUp, "up")}
          {stepper(down, setDown, "down")}
          <span className="text-[0.68rem] text-muted">generations</span>
        </p>
      </header>

      {load.status === "loading" && <p className="text-xs text-muted">Walking the kin…</p>}
      {load.status === "missing" && (
        <p className="text-xs text-muted">No such person in the factbook.</p>
      )}
      {load.status === "ready" && layout && (
        <div className="fx-fade relative" style={{ width: layout.width, height: layout.height }}>
          <svg
            className="absolute inset-0"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {layout.edges.map((e, i) => (
              <line
                key={i}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke="var(--rule)"
                strokeWidth={1}
              />
            ))}
          </svg>
          {layout.nodes.map((p, i) => {
            const isRoot = p.node.id === load.report.rootId && !p.node.repeated;
            const cell =
              "flex h-full w-full flex-col items-center justify-center rounded-[4px] border px-1 text-center";
            const look = p.node.repeated
              ? "border-dashed border-rule bg-paper text-muted"
              : isRoot
                ? "border-amber bg-surface text-ink"
                : "glass glass-hover text-ink";
            return (
              <div
                key={i}
                className="absolute"
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                title={p.node.repeated ? `${p.node.name}, shown earlier on this map` : p.node.name}
              >
                {p.node.id ? (
                  <div className={`${cell} ${look} relative`}>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({
                          type: "openFactbook",
                          entityId: p.node.id!,
                          title: p.node.name,
                        });
                      }}
                      className="w-full truncate text-[0.72rem] font-semibold leading-tight hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      {p.node.name}
                    </button>
                    {!p.node.repeated && !isRoot && (
                      <button
                        type="button"
                        onClick={() => {
                          setRoot({ id: p.node.id! });
                          playSound("navigate");
                        }}
                        className="text-[0.58rem] uppercase tracking-wide text-muted hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        root here
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={`${cell} ${look}`}>
                    <span className="w-full truncate text-[0.72rem] leading-tight">
                      {p.node.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Kinship: TIPNR, data created by www.STEPBible.org based on work at Tyndale House
        Cambridge (CC BY 4.0). A dashed name already stands elsewhere on the map.
      </p>
    </div>
  );
}
