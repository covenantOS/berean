"use client";

import { useEffect, useRef, useState } from "react";
import {
  addConnector,
  addPassageCard,
  addShape,
  addTextCard,
  canvases,
  canvasSvg,
  connectorD,
  createCanvas,
  DEFAULT_VIEW,
  itemCenter,
  moveItem,
  removeItem,
  renameCanvas,
  resizeItem,
  screenToWorld,
  setCardText,
  stainedHex,
  STAINED_COLORS,
  zoomAtPoint,
  type CanvasView,
  type PlacedItem,
  type ShapeKind,
  type StainedKey,
} from "@/lib/canvas";
import { formatPassageRef, parsePassageRef } from "@/lib/documents";
import { useCollection, useRecord } from "@/lib/hooks";
import { playSound } from "@/lib/sound";
import PhoneSurfaceNote from "./PhoneSurfaceNote";
import { useWorkspaceDispatch } from "./WorkspaceContext";

/**
 * The canvas pane: the whiteboard itself. Pan by dragging empty space, zoom
 * by wheel or the toolbar buttons (bounded, zooming toward the cursor);
 * cards move by pointer drag and resize from the corner handle; a text card
 * edits in place on double-click; the toolbar adds text, passages (the
 * reference is fetched through /api/passages at insert, the text snapshot
 * and citation preserved), and shapes in the stained-glass palette. Connect
 * mode joins two clicked items with a line that follows them. Every gesture
 * lives on pointer events inside this surface and stops propagation, so the
 * workspace's own HTML5 tab drag never engages. Export serializes the
 * canvas to a standalone SVG sheet (src/lib/canvas.ts), the verse card's
 * download precedent; PNG stays out because rasterizing the SVG faithfully
 * wants more machinery than the image is worth.
 */

/** A gesture in flight. Pan carries the view at grab time; move and resize
 *  carry the item's origin and the accumulated screen delta, applied at the
 *  current zoom. The gesture commits to the collection on release. */
type Drag =
  | { kind: "pan"; startX: number; startY: number; viewX: number; viewY: number }
  | {
      kind: "move";
      id: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      dx: number;
      dy: number;
    }
  | {
      kind: "resize";
      id: string;
      startX: number;
      startY: number;
      origW: number;
      origH: number;
      dx: number;
      dy: number;
    };

const TOOL_BUTTON =
  "fx-press border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

export default function CanvasPane({ canvasId }: { canvasId: string }) {
  const { dispatch } = useWorkspaceDispatch();
  const doc = useRecord(canvases, canvasId);
  const [view, setView] = useState<CanvasView>(DEFAULT_VIEW);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** Connect mode: the next two clicked items join with a connector. */
  const [connectMode, setConnectMode] = useState(false);
  /** The first endpoint already clicked, awaiting its partner. */
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  /** The connector clicked for removal; a chip at its midpoint deletes. */
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  /** The text card being edited, with its draft. */
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  /** The passage form's reference input and its quiet failure line. */
  const [refInput, setRefInput] = useState("");
  const [passageError, setPassageError] = useState<string | null>(null);
  const [passageBusy, setPassageBusy] = useState(false);
  /** The color the next shape wears. */
  const [shapeColor, setShapeColor] = useState<StainedKey>("sapphire");
  const surfaceRef = useRef<HTMLDivElement>(null);

  /* The wheel listener attaches non-passive so the zoom can claim the
   * gesture; the page never scrolls under the cursor's intention. */
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((v) => zoomAtPoint(v, e.clientX - rect.left, e.clientY - rect.top, v.zoom * factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* Escape lets go: of the pending endpoint first, then connect mode. */
  useEffect(() => {
    if (!connectMode && !pendingFrom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingFrom) setPendingFrom(null);
      else setConnectMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectMode, pendingFrom]);

  if (!doc) {
    return <p className="p-4 text-xs text-muted">This canvas is no longer on this device.</p>;
  }

  /** The world point at the surface's center, where new items land. */
  const viewportCenter = (): { x: number; y: number } => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const px = rect ? rect.width / 2 : 300;
    const py = rect ? rect.height / 2 : 200;
    return screenToWorld(view, px, py);
  };

  /* Every drag gesture is captured by the surface, so a fast stroke that
   * leaves the card (or the pane) keeps its pointer and releases cleanly. */
  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    surfaceRef.current?.setPointerCapture(e.pointerId);
    setDrag({ kind: "pan", startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y });
    // Empty space also lets go of a pending endpoint and a selected line.
    setPendingFrom(null);
    setSelectedConnector(null);
  };

  const onSurfacePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (drag.kind === "pan") {
      setView((v) => ({ ...v, x: drag.viewX + dx, y: drag.viewY + dy }));
    } else {
      setDrag({ ...drag, dx, dy });
    }
  };

  const onSurfacePointerUp = () => {
    if (!drag) return;
    // A nudge under two pixels reads as a click and commits nothing.
    const moved = drag.kind !== "pan" && Math.hypot(drag.dx, drag.dy) >= 2;
    if (drag.kind === "move" && moved) {
      moveItem(canvasId, drag.id, drag.origX + drag.dx / view.zoom, drag.origY + drag.dy / view.zoom);
    }
    if (drag.kind === "resize" && moved) {
      resizeItem(canvasId, drag.id, drag.origW + drag.dx / view.zoom, drag.origH + drag.dy / view.zoom);
    }
    setDrag(null);
  };

  const onItemPointerDown = (e: React.PointerEvent, item: PlacedItem) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (connectMode) {
      if (!pendingFrom) {
        setPendingFrom(item.id);
      } else if (pendingFrom !== item.id) {
        addConnector(canvasId, pendingFrom, item.id);
        setPendingFrom(null);
      }
      return;
    }
    if (editing?.id === item.id) return;
    surfaceRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      kind: "move",
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y,
      dx: 0,
      dy: 0,
    });
  };

  const onResizePointerDown = (e: React.PointerEvent, item: PlacedItem) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    surfaceRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      kind: "resize",
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: item.w,
      origH: item.h,
      dx: 0,
      dy: 0,
    });
  };

  /* The passage insert: the typed reference parses through the shared
   * parser, fetches its text from the shipped KJV in one round trip, and
   * lands as a card holding the snapshot with its citation. A reference
   * that does not parse, or one the text cannot answer, says so in place. */
  const insertPassage = async () => {
    const parsed = parsePassageRef(refInput);
    if (!parsed) {
      setPassageError("Give a reference like John 3:16-18.");
      playSound("error");
      return;
    }
    const from = parsed.from ?? 1;
    // A whole chapter asks for every verse; the route clips to what exists.
    const to = parsed.to ?? parsed.from ?? 999;
    const q = `${parsed.book}.${parsed.chapter}.${from}${to !== from ? `-${to}` : ""}`;
    setPassageBusy(true);
    setPassageError(null);
    try {
      const res = await fetch(`/api/passages?refs=${encodeURIComponent(q)}`);
      const data = res.ok ? ((await res.json()) as { passages: { verses: { text: string }[] }[] }) : null;
      const verses = data?.passages[0]?.verses ?? [];
      if (verses.length === 0) {
        setPassageError("The text did not answer that reference.");
        playSound("error");
        return;
      }
      const reference = formatPassageRef(parsed);
      const at = viewportCenter();
      addPassageCard(canvasId, { x: at.x - 150, y: at.y - 95 }, {
        reference,
        citation: `${reference} (KJV)`,
        text: verses.map((v) => v.text).join(" "),
        book: parsed.book,
        chapter: parsed.chapter,
      });
      setRefInput("");
      playSound("complete");
    } catch {
      setPassageError("The passage could not be fetched.");
      playSound("error");
    } finally {
      setPassageBusy(false);
    }
  };

  /** Print/export aid: the canvas as a standalone SVG sheet, downloaded. */
  const exportImage = () => {
    const blob = new Blob([canvasSvg(doc)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.name.replace(/[^\w-]+/g, "-").toLowerCase()}-canvas.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
    playSound("complete");
  };

  /* The view during a gesture: the dragged item wears its live offset so
   * cards and their connectors track the pointer before the drop commits. */
  const placed = doc.items.filter((it): it is PlacedItem => it.kind !== "connector");
  const effective = placed.map((it) => {
    if (!drag || drag.kind === "pan" || drag.id !== it.id) return it;
    if (drag.kind === "move") {
      return { ...it, x: it.x + drag.dx / view.zoom, y: it.y + drag.dy / view.zoom };
    }
    if (drag.kind === "resize") {
      return { ...it, w: it.w + drag.dx / view.zoom, h: it.h + drag.dy / view.zoom };
    }
    return it;
  });
  const byId = new Map(effective.map((it) => [it.id, it]));

  const zoomBy = (factor: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const px = rect ? rect.width / 2 : 0;
    const py = rect ? rect.height / 2 : 0;
    setView((v) => zoomAtPoint(v, px, py, v.zoom * factor));
  };

  return (
    <div className="flex h-full flex-col">
      <PhoneSurfaceNote text="The canvas reads best on a larger screen. Everything on it stays open below." />
      {/* The toolbar: view controls, the add-row, and the export. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-rule bg-paper px-2 py-1">
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)} className={TOOL_BUTTON}>
          −
        </button>
        <span className="w-10 text-center text-[0.68rem] text-muted">
          {Math.round(view.zoom * 100)}%
        </span>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.25)} className={TOOL_BUTTON}>
          +
        </button>
        <button type="button" title="Return to the origin at full size" onClick={() => setView(DEFAULT_VIEW)} className={TOOL_BUTTON}>
          Reset view
        </button>
        <span className="mx-1 h-4 w-px bg-rule" aria-hidden />
        <button
          type="button"
          title="Add a text card at the center of the view"
          onClick={() => {
            const at = viewportCenter();
            addTextCard(canvasId, { x: at.x - 130, y: at.y - 75 });
          }}
          className={TOOL_BUTTON}
        >
          Text
        </button>
        <span className="flex items-center gap-1">
          <input
            value={refInput}
            aria-label="Passage reference"
            placeholder="John 3:16-18"
            onChange={(e) => setRefInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !passageBusy) void insertPassage();
            }}
            className="w-32 border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <button
            type="button"
            title="Fetch the passage and lay it on the canvas"
            disabled={passageBusy || !refInput.trim()}
            onClick={() => void insertPassage()}
            className={`${TOOL_BUTTON} disabled:opacity-40`}
          >
            {passageBusy ? "Fetching…" : "Passage"}
          </button>
        </span>
        {(["rect", "ellipse"] as ShapeKind[]).map((shape) => (
          <button
            key={shape}
            type="button"
            title={`Add a${shape === "ellipse" ? "n" : ""} ${shape} at the center of the view`}
            onClick={() => {
              const at = viewportCenter();
              addShape(canvasId, shape, shapeColor, { x: at.x - 90, y: at.y - 60 });
            }}
            className={TOOL_BUTTON}
          >
            {shape === "rect" ? "Rectangle" : "Ellipse"}
          </button>
        ))}
        <select
          value={shapeColor}
          aria-label="Shape color"
          title="The color the next shape wears"
          onChange={(e) => setShapeColor(e.target.value as StainedKey)}
          className="border border-rule bg-paper px-1 py-1 text-[0.72rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
        >
          {STAINED_COLORS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={connectMode}
          title="Connect mode: click two items to join them with a line"
          onClick={() => {
            const next = !connectMode;
            setConnectMode(next);
            setPendingFrom(null);
            playSound(next ? "toggle-on" : "toggle-off");
          }}
          className={`${TOOL_BUTTON} ${connectMode ? "border-sapphire text-sapphire" : ""}`}
        >
          Connect
        </button>
        <button type="button" title="Download the canvas as an SVG image" onClick={exportImage} className={TOOL_BUTTON}>
          Export image
        </button>
        {passageError && <span className="text-[0.68rem] text-ruby">{passageError}</span>}
        {connectMode && (
          <span className="text-[0.68rem] text-muted">
            {pendingFrom ? "Click the item to join it to." : "Click the first item to link."}
          </span>
        )}
      </div>

      {/* The surface: pan and zoom live here, items inside the world. */}
      <div
        ref={surfaceRef}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
        onPointerUp={onSurfacePointerUp}
        className="relative flex-1 overflow-hidden bg-surface"
        style={{
          touchAction: "none",
          cursor: connectMode ? "crosshair" : drag?.kind === "pan" ? "grabbing" : "grab",
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          {/* Connectors beneath the cards, in world coordinates. */}
          <svg className="absolute left-0 top-0" width={1} height={1} style={{ overflow: "visible" }}>
            {doc.items.map((it) => {
              if (it.kind !== "connector") return null;
              const from = byId.get(it.from);
              const to = byId.get(it.to);
              if (!from || !to) return null;
              const d = connectorD(itemCenter(from), itemCenter(to));
              const mid = { x: (itemCenter(from).x + itemCenter(to).x) / 2, y: (itemCenter(from).y + itemCenter(to).y) / 2 };
              return (
                <g key={it.id}>
                  {/* A wide invisible stroke takes the click the hairline misses. */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setSelectedConnector(it.id)}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={selectedConnector === it.id ? stainedHex("sapphire") : "#6d5f4b"}
                    strokeWidth={selectedConnector === it.id ? 2.5 : 2}
                    style={{ pointerEvents: "none" }}
                  />
                  {selectedConnector === it.id && (
                    <foreignObject x={mid.x - 10} y={mid.y - 10} width={20} height={20} style={{ overflow: "visible" }}>
                      <button
                        type="button"
                        title="Remove this link"
                        aria-label="Remove this link"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          removeItem(canvasId, it.id);
                          setSelectedConnector(null);
                          playSound("close");
                        }}
                        className="fx-scale flex h-4 w-4 items-center justify-center rounded-full border border-rule bg-paper text-[0.6rem] leading-none text-muted hover:text-ruby"
                        style={{ "--fx-origin": "50% 50%" } as React.CSSProperties}
                      >
                        ×
                      </button>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>
          {effective.map((item) => (
            <CanvasItemView
              key={item.id}
              item={item}
              pending={pendingFrom === item.id}
              editing={editing?.id === item.id ? editing.draft : null}
              onPointerDown={onItemPointerDown}
              onResizePointerDown={onResizePointerDown}
              onEdit={(draft) => setEditing({ id: item.id, draft })}
              onDraft={setEditing}
              onCommitEdit={() => {
                if (editing) setCardText(canvasId, editing.id, editing.draft);
                setEditing(null);
              }}
              onCancelEdit={() => setEditing(null)}
              onRemove={() => {
                removeItem(canvasId, item.id);
                playSound("close");
              }}
              onOpenPassage={(book, chapter) => dispatch({ type: "openRef", book, chapter })}
            />
          ))}
        </div>
        {doc.items.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-xs leading-relaxed text-muted">
            Drag to pan, scroll to zoom. Add a text card or a passage to begin;
            Connect joins two items with a line that follows them.
          </p>
        )}
      </div>
    </div>
  );
}

/** One item on the surface: a card or a shape at its world position, with
 *  its delete and resize affordances. */
function CanvasItemView({
  item,
  pending,
  editing,
  onPointerDown,
  onResizePointerDown,
  onEdit,
  onDraft,
  onCommitEdit,
  onCancelEdit,
  onRemove,
  onOpenPassage,
}: {
  item: PlacedItem;
  pending: boolean;
  /** The draft when this card is being edited; null otherwise. */
  editing: string | null;
  onPointerDown: (e: React.PointerEvent, item: PlacedItem) => void;
  onResizePointerDown: (e: React.PointerEvent, item: PlacedItem) => void;
  onEdit: (draft: string) => void;
  onDraft: (editing: { id: string; draft: string }) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onOpenPassage: (book: string, chapter: number) => void;
}) {
  const frame =
    item.kind === "shape"
      ? {
          border: `2px solid ${stainedHex(item.color)}`,
          backgroundColor: `${stainedHex(item.color)}1f`,
          borderRadius: item.shape === "ellipse" ? "50%" : 2,
        }
      : { border: "1.5px solid #d9cdb4", backgroundColor: "#fffdf8", borderRadius: 2 };
  return (
    <div
      onPointerDown={(e) => onPointerDown(e, item)}
      className={`absolute select-none ${pending ? "outline outline-2 outline-sapphire" : ""}`}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h, cursor: "inherit", ...frame }}
    >
      {item.kind === "text" &&
        (editing !== null ? (
          <textarea
            autoFocus
            value={editing}
            aria-label="Card text"
            onChange={(e) => onDraft({ id: item.id, draft: e.target.value })}
            onBlur={onCommitEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancelEdit();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-full w-full resize-none bg-transparent p-2 font-reader text-[0.82rem] leading-relaxed text-ink focus:outline focus:outline-2 focus:outline-sapphire"
          />
        ) : (
          <div
            onDoubleClick={() => onEdit(item.text)}
            title="Double-click to edit"
            className="h-full w-full overflow-y-auto whitespace-pre-wrap p-2 font-reader text-[0.82rem] leading-relaxed text-ink"
          >
            {item.text || <span className="text-muted">Double-click to write.</span>}
          </div>
        ))}
      {item.kind === "passage" && (
        <div className="flex h-full w-full flex-col p-2">
          <button
            type="button"
            title={`Open ${item.reference} in the reader`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpenPassage(item.book, item.chapter)}
            className="small-caps self-start text-[0.68rem] font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            {item.reference}
          </button>
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto font-reader text-[0.78rem] leading-relaxed text-ink">
            {item.text}
          </div>
          <div className="pt-1 text-[0.62rem] text-muted">{item.citation}</div>
        </div>
      )}
      <button
        type="button"
        title="Remove this item"
        aria-label={item.kind === "passage" ? `Remove ${item.reference}` : "Remove this item"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border border-rule bg-paper text-[0.6rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        ×
      </button>
      <span
        role="separator"
        aria-label="Drag to resize"
        title="Drag to resize"
        onPointerDown={(e) => onResizePointerDown(e, item)}
        className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize border-b-2 border-r-2 border-muted"
      />
    </div>
  );
}

/**
 * The Documents rail's canvases section: the saved canvases with create,
 * open, rename inline (the layouts menu's pattern), and delete. A deleted
 * canvas leaves its open tabs to degrade in place, the way a deleted
 * manuscript does.
 */
export function CanvasesSection() {
  const { dispatch } = useWorkspaceDispatch();
  const docs = useCollection(canvases);
  /** The canvas being renamed, with its draft. */
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);

  const openNew = () => {
    const c = createCanvas("Untitled canvas");
    dispatch({ type: "openCanvasDoc", canvasId: c.id, title: c.name });
  };

  const commitRename = () => {
    if (renaming) renameCanvas(renaming.id, renaming.draft);
    setRenaming(null);
  };

  return (
    <div className="border-b border-rule py-1">
      <div className="flex items-baseline justify-between px-3 pt-2 pb-1">
        <span className="small-caps text-[0.62rem] font-semibold text-muted">Canvases</span>
        <button
          type="button"
          onClick={openNew}
          title="Start a new canvas and open it"
          className="text-[0.62rem] text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          New canvas
        </button>
      </div>
      {docs.length === 0 ? (
        <p className="px-3 pb-1 text-[0.7rem] leading-relaxed text-muted">
          No canvases yet. A canvas is a whiteboard for visual study: passages,
          notes, and shapes, joined by lines.
        </p>
      ) : (
        <ul>
          {docs.map((c) =>
            renaming?.id === c.id ? (
              <li key={c.id} className="flex items-center gap-1.5 px-3 py-[3px]">
                <input
                  autoFocus
                  value={renaming.draft}
                  aria-label="Canvas name"
                  onChange={(e) => setRenaming({ id: c.id, draft: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="min-w-0 flex-1 border border-rule bg-paper px-1 py-0.5 text-[0.8rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "openCanvasDoc", canvasId: c.id, title: c.name })}
                  title={`Open ${c.name}`}
                  className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {c.name}
                </button>
                <span className="shrink-0 text-[0.62rem] text-muted">
                  {c.items.filter((it) => it.kind !== "connector").length}
                </span>
                <button
                  type="button"
                  onClick={() => setRenaming({ id: c.id, draft: c.name })}
                  title={`Rename ${c.name}`}
                  className="shrink-0 px-1 text-[0.62rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => canvases.remove(c.id)}
                  title="Delete this canvas"
                  aria-label={`Delete ${c.name}`}
                  className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  ×
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
