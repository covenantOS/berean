"use client";

import { useEffect, useState } from "react";
import { collections } from "@/lib/collections";
import {
  editorOrder,
  GUIDE_SECTIONS,
  guides,
  saveGuide,
  type GuideSectionKey,
} from "@/lib/guides";
import { useCollection } from "@/lib/hooks";

/**
 * The Guide Editor: the compose surface for custom guides. The list names
 * every guide on the device with its section count, Edit, and delete; the
 * draft names a guide, toggles sections on and off, and steps them up and
 * down, the same steppers the commentary wall's priority rows carry. A
 * guide running the Commentaries section can pin the collection that
 * section answers from, overriding the workspace's active collection.
 * Saving
 * writes the composition to berean.guides.v1, and any tab already running
 * the guide follows. A tab opened with a guide id lands in that guide's
 * draft; a tab opened with none lands on the list.
 */

interface Draft {
  /** The record being edited; null while the guide is new. */
  id: string | null;
  name: string;
  /** Every section key in display order, the guide's own order first. */
  order: GuideSectionKey[];
  /** The sections the guide runs; order follows draft.order at save. */
  on: GuideSectionKey[];
  /** The Commentaries section's collection: an id, null for the whole
   * shelf, undefined to follow the workspace's active collection. */
  commentaryCollection: string | null | undefined;
}

const SECTION_TITLES = new Map<string, string>(GUIDE_SECTIONS.map((s) => [s.key, s.title]));

export default function GuideEditorPane({ guideId }: { guideId: string | null }) {
  const saved = useCollection(guides);
  const savedCollections = useCollection(collections);
  const [draft, setDraft] = useState<Draft | null>(null);

  /* A pinned guide id opens its draft; a deleted id falls back to the list. */
  useEffect(() => {
    if (!guideId) return;
    const g = guides.get(guideId);
    if (g)
      setDraft({
        id: g.id,
        name: g.name,
        order: editorOrder(g.sections),
        on: [...g.sections],
        commentaryCollection: g.commentaryCollection,
      });
  }, [guideId]);

  const startNew = () =>
    setDraft({
      id: null,
      name: "",
      order: editorOrder([]),
      on: GUIDE_SECTIONS.map((s) => s.key),
      commentaryCollection: undefined,
    });

  const startEdit = (id: string) => {
    const g = guides.get(id);
    if (g)
      setDraft({
        id: g.id,
        name: g.name,
        order: editorOrder(g.sections),
        on: [...g.sections],
        commentaryCollection: g.commentaryCollection,
      });
  };

  const toggle = (key: GuideSectionKey) => {
    if (!draft) return;
    const on = draft.on.includes(key)
      ? draft.on.filter((k) => k !== key)
      : [...draft.on, key];
    setDraft({ ...draft, on });
  };

  /* One step up or down the composition, the wall-priority idiom. */
  const move = (key: GuideSectionKey, delta: -1 | 1) => {
    if (!draft) return;
    const i = draft.order.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= draft.order.length) return;
    const order = [...draft.order];
    [order[i], order[j]] = [order[j], order[i]];
    setDraft({ ...draft, order });
  };

  const save = () => {
    if (!draft) return;
    const sections = draft.order.filter((k) => draft.on.includes(k));
    if (!saveGuide(draft.id, draft.name, sections, draft.commentaryCollection)) return;
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Guide Editor</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">Custom guides</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          Named compositions of the Passage Guide's sections; a custom guide runs from the verse
          menu, the omnibox, and the launcher
        </p>
      </header>

      {draft ? (
        <div className="space-y-3">
          <input
            value={draft.name}
            aria-label="Guide name"
            placeholder="Guide name"
            autoFocus={draft.id === null}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-72 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
          />
          <ul className="space-y-1">
            {draft.order.map((key, i) => {
              const checked = draft.on.includes(key);
              const title = SECTION_TITLES.get(key) ?? key;
              return (
                <li key={key} className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(key)}
                      className="accent-[var(--stained-sapphire)]"
                    />
                    {title}
                  </label>
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(key, -1)}
                    title="Move up the guide"
                    aria-label={`Move ${title} up the guide`}
                    className="border border-rule bg-paper px-1 leading-none text-ink hover:border-sapphire disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === draft.order.length - 1}
                    onClick={() => move(key, 1)}
                    title="Move down the guide"
                    aria-label={`Move ${title} down the guide`}
                    className="border border-rule bg-paper px-1 leading-none text-ink hover:border-sapphire disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    ▼
                  </button>
                </li>
              );
            })}
          </ul>
          {draft.on.includes("commentary") && (
            <label className="flex items-center gap-2 text-[0.68rem] text-muted">
              <span className="small-caps font-semibold">Commentaries answer from</span>
              <select
                value={
                  draft.commentaryCollection === undefined
                    ? ""
                    : draft.commentaryCollection === null
                      ? "shelf"
                      : draft.commentaryCollection
                }
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    commentaryCollection:
                      e.target.value === "" ? undefined : e.target.value === "shelf" ? null : e.target.value,
                  })
                }
                aria-label="Choose the collection this guide's Commentaries section answers from"
                className="border border-rule bg-paper px-1 py-1 text-xs text-ink focus:border-sapphire focus:outline-none"
              >
                <option value="">The workspace's active collection</option>
                <option value="shelf">The whole shelf</option>
                {savedCollections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!draft.name.trim() || draft.on.length === 0}
              className="border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {draft.id ? "Save guide" : "Create guide"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-2 py-1 text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Cancel
            </button>
            {draft.id && (
              <button
                type="button"
                onClick={() => {
                  guides.remove(draft.id as string);
                  setDraft(null);
                }}
                className="px-2 py-1 text-xs text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Delete
              </button>
            )}
          </div>
          {draft.on.length === 0 && (
            <p className="text-[0.68rem] text-muted">A guide needs at least one section.</p>
          )}
        </div>
      ) : saved.length === 0 ? (
        <p className="text-xs text-muted">
          No custom guides yet. Compose one and it joins the guides in the verse menu and the
          omnibox.
        </p>
      ) : (
        <ul className="space-y-1">
          {saved.map((g) => (
            <li key={g.id} className="flex items-baseline gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{g.name}</p>
              <span className="shrink-0 text-[0.68rem] text-muted">
                {g.sections.length} {g.sections.length === 1 ? "section" : "sections"}
              </span>
              <button
                type="button"
                onClick={() => startEdit(g.id)}
                className="shrink-0 px-1 text-[0.68rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => guides.remove(g.id)}
                title="Delete this guide; tabs running it say so"
                aria-label={`Delete ${g.name}`}
                className="shrink-0 px-1 text-[0.72rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {!draft && (
        <button
          type="button"
          onClick={startNew}
          className="border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          New guide
        </button>
      )}
    </div>
  );
}
