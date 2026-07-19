"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getBook } from "@/lib/canon";
import { useCollection } from "@/lib/hooks";
import {
  addTag,
  COMMENTARY_WALL,
  commentaryOrder,
  librarymeta,
  moveCommentaryWork,
  removeTag,
  setRating,
  type LibraryMeta,
} from "@/lib/librarymeta";
import { RIGHTS_REGISTRY, type RightsEntry } from "@/lib/rights";
import { useWorkspace } from "./WorkspaceContext";
import { commentaryTab, crossrefsTab, lexiconTab, readerTab, type Tab } from "./workspace-state";

/**
 * The library browser pane: the whole rights registry as a faceted catalog.
 * Facets follow what the registry genuinely carries (kind, status, license
 * class) plus the reader's own tags and ratings from the librarymeta
 * collection; language and era wait on structured metadata the registry
 * does not have yet. Entries with a reader open straight into the
 * workspace: translations as reader tabs, the commentary wall, the
 * cross-reference treasury, and the lexicon as pane tabs, topical works,
 * the Atlas, and the Timeline at their routes. Commentaries also carry the
 * priority steppers the wall answers.
 */

const KIND_LABELS: Record<RightsEntry["kind"], string> = {
  "bible-translation": "Translation",
  commentary: "Commentary",
  lexicon: "Lexicon",
  hymnal: "Hymnal",
  font: "Font",
  dataset: "Dataset",
};

const STATUS_LABELS: Record<RightsEntry["status"], string> = {
  shipped: "On the shelf",
  planned: "Planned",
  "pending-license": "Pending license",
};

/** The license facet: the registry's license strings grouped into classes. */
function licenseClass(license: string): string {
  if (license.startsWith("Public domain")) return "Public domain";
  if (license.startsWith("CC BY")) return "CC BY 4.0";
  return "Other";
}

/* Registry id → translation id for the reader tab; mirrors TRANSLATIONS in
 * src/lib/translations.ts, which is fs-backed and server-only. */
const TRANSLATION_IDS: Record<string, string> = {
  "kjv-1769": "kjv",
  web: "web",
  asv: "asv",
  bbe: "bbe",
  darby: "darby",
  ylt: "ylt",
  "brenton-lxx-english": "brenton",
  "lxx-greek-brenton": "lxx",
};
const OT_ONLY = new Set(["brenton", "lxx"]);

/* Both topical works index together at /topics; there is no per-work page. */
const TOPIC_ROUTES: Record<string, string> = {
  "naves-topical": "/topics",
  "torreys-topical": "/topics",
};
const TOOL_ROUTES: Record<string, string> = {
  naturalearth: "/library/atlas",
  "ussher-chronology": "/almanac/timeline",
};

type Facets = {
  text: string;
  kind: string;
  status: string;
  license: string;
  tag: string;
  minRating: number;
};

const ALL_FACETS: Facets = { text: "", kind: "all", status: "all", license: "all", tag: "all", minRating: 0 };

export default function LibraryPane() {
  const { state, activeRef, dispatch } = useWorkspace();
  const metaRows = useCollection(librarymeta);
  const [facets, setFacets] = useState<Facets>(ALL_FACETS);

  const metaById = new Map(metaRows.map((m) => [m.resourceId, m]));
  const allTags = [...new Set(metaRows.flatMap((m) => m.tags))].sort();
  const order = commentaryOrder();

  const q = facets.text.trim().toLowerCase();
  const rows = RIGHTS_REGISTRY.filter((r) => {
    if (facets.kind !== "all" && r.kind !== facets.kind) return false;
    if (facets.status !== "all" && r.status !== facets.status) return false;
    if (facets.license !== "all" && licenseClass(r.license) !== facets.license) return false;
    const meta = metaById.get(r.id);
    if (facets.tag !== "all" && !meta?.tags.includes(facets.tag)) return false;
    if (facets.minRating > 0 && (meta?.rating ?? 0) < facets.minRating) return false;
    if (q) {
      const hay =
        `${r.title} ${r.id} ${r.rightsHolder} ${r.license} ${r.notes ?? ""} ${(meta?.tags ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  /* True when a workspace tab answers this entry's Open action. */
  const opensAsTab = (r: RightsEntry): boolean =>
    r.status === "shipped" &&
    (r.id in TRANSLATION_IDS ||
      COMMENTARY_WALL.some((w) => w.rightsId === r.id) ||
      r.id === "tbesh" ||
      r.id === "tbesg" ||
      r.id === "strongs" ||
      r.id === "tsk-crossrefs");

  /* The open action an entry earns, when a reader exists for it. */
  const openTabFor = (r: RightsEntry): Tab | null => {
    if (r.status !== "shipped") return null;
    const translation = TRANSLATION_IDS[r.id];
    if (translation) {
      let ref = activeRef ?? { book: "genesis", chapter: 1 };
      if (OT_ONLY.has(translation) && getBook(ref.book)?.testament === "NT") {
        ref = { book: "genesis", chapter: 1 };
      }
      // The entry's own text wins over the default translation preference.
      return { ...readerTab(ref.book, ref.chapter), translation: translation === "kjv" ? undefined : translation };
    }
    if (COMMENTARY_WALL.some((w) => w.rightsId === r.id)) return commentaryTab();
    if (r.id === "tbesh" || r.id === "tbesg" || r.id === "strongs") return lexiconTab(null);
    if (r.id === "tsk-crossrefs") return crossrefsTab();
    return null;
  };

  const open = (r: RightsEntry) => {
    const tab = openTabFor(r);
    if (tab) dispatch({ type: "openTab", tab, target: { kind: "strip", paneId: state.activePaneId } });
  };

  const set = (patch: Partial<Facets>) => setFacets((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Library</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">The catalog</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {rows.length} of {RIGHTS_REGISTRY.length} registered works · every entry and its license
          from the rights registry
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={facets.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Filter the catalog"
          aria-label="Filter the catalog"
          spellCheck={false}
          autoComplete="off"
          className="w-44 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
        />
        <FacetSelect
          label="Kind"
          value={facets.kind}
          onChange={(v) => set({ kind: v })}
          options={[
            ["all", "Every kind"],
            ...Object.entries(KIND_LABELS).map(([v, l]) => [v, l] as [string, string]),
          ]}
        />
        <FacetSelect
          label="Status"
          value={facets.status}
          onChange={(v) => set({ status: v })}
          options={[
            ["all", "Every status"],
            ...Object.entries(STATUS_LABELS).map(([v, l]) => [v, l] as [string, string]),
          ]}
        />
        <FacetSelect
          label="License"
          value={facets.license}
          onChange={(v) => set({ license: v })}
          options={[
            ["all", "Every license"],
            ["Public domain", "Public domain"],
            ["CC BY 4.0", "CC BY 4.0"],
            ["Other", "Other"],
          ]}
        />
        <FacetSelect
          label="Tag"
          value={facets.tag}
          onChange={(v) => set({ tag: v })}
          options={[["all", "Every tag"], ...allTags.map((t) => [t, t] as [string, string])]}
        />
        <FacetSelect
          label="Rating"
          value={String(facets.minRating)}
          onChange={(v) => set({ minRating: Number(v) })}
          options={[
            ["0", "Any rating"],
            ["3", "3+ stars"],
            ["4", "4+ stars"],
            ["5", "5 stars"],
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted">No catalog entry matches these filters.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <CatalogEntry
              key={r.id}
              entry={r}
              meta={metaById.get(r.id)}
              priorityWork={COMMENTARY_WALL.find((w) => w.rightsId === r.id)?.workId ?? null}
              priorityIndex={order}
              route={TOPIC_ROUTES[r.id] ?? TOOL_ROUTES[r.id] ?? null}
              canOpen={opensAsTab(r)}
              onOpen={() => open(r)}
            />
          ))}
        </ul>
      )}

      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Facets follow what the registry genuinely carries: kind, status, and
        license class, plus your tags and ratings. Language and era wait on
        structured metadata. Commentary priority orders the wall in the dock.
      </p>
    </div>
  );
}

function FacetSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex items-center gap-1 text-[0.68rem] text-muted">
      <span className="small-caps font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-rule bg-paper px-1 py-1 text-xs text-ink focus:border-sapphire focus:outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function CatalogEntry({
  entry: r,
  meta,
  priorityWork,
  priorityIndex,
  route,
  canOpen,
  onOpen,
}: {
  entry: RightsEntry;
  meta: LibraryMeta | undefined;
  priorityWork: string | null;
  priorityIndex: string[];
  route: string | null;
  canOpen: boolean;
  onOpen: () => void;
}) {
  const rating = meta?.rating ?? null;
  const tags = meta?.tags ?? [];
  const position = priorityWork ? priorityIndex.indexOf(priorityWork) : -1;

  return (
    <li className="border border-rule bg-surface p-3">
      <div className="flex items-baseline gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-ink">{r.title}</p>
        <Stars rating={rating} onRate={(n) => setRating(r.id, n)} />
      </div>
      <p className="mt-0.5 text-[0.68rem] text-muted">
        {KIND_LABELS[r.kind]} · {STATUS_LABELS[r.status]} · {licenseClass(r.license)} ·{" "}
        {r.rightsHolder}
      </p>
      {r.notes && <p className="mt-1 line-clamp-2 text-[0.72rem] leading-relaxed text-muted">{r.notes}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-0.5 rounded-[3px] border border-rule bg-paper px-1.5 py-0.5 text-[0.68rem] text-ink"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(r.id, t)}
              title={`Remove the tag ${t}`}
              aria-label={`Remove the tag ${t}`}
              className="text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              ×
            </button>
          </span>
        ))}
        <TagInput onAdd={(t) => addTag(r.id, t)} />
      </div>

      <div className="mt-2 flex items-center gap-3">
        {canOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Open
          </button>
        )}
        {route && (
          <Link
            href={route}
            className="text-xs text-sapphire no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Open
          </Link>
        )}
        {priorityWork && position >= 0 && (
          <span className="flex items-center gap-1 text-[0.68rem] text-muted">
            <span className="small-caps font-semibold">Wall priority {position + 1}</span>
            <button
              type="button"
              disabled={position === 0}
              onClick={() => moveCommentaryWork(priorityWork, -1)}
              title="Move up the commentary wall"
              aria-label={`Move ${r.title} up the commentary wall`}
              className="border border-rule bg-paper px-1 leading-none text-ink hover:border-sapphire disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={position === priorityIndex.length - 1}
              onClick={() => moveCommentaryWork(priorityWork, 1)}
              title="Move down the commentary wall"
              aria-label={`Move ${r.title} down the commentary wall`}
              className="border border-rule bg-paper px-1 leading-none text-ink hover:border-sapphire disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              ▼
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

/** Five stars; clicking the current rating clears it. */
function Stars({ rating, onRate }: { rating: number | null; onRate: (n: number | null) => void }) {
  return (
    <span className="flex shrink-0 items-center" role="group" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onRate(rating === n ? null : n)}
          title={rating === n ? "Clear your rating" : `Rate ${n} of 5`}
          aria-label={rating === n ? "Clear your rating" : `Rate ${n} of 5`}
          className={`px-0.5 text-[0.8rem] leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
            rating !== null && n <= rating ? "text-amber" : "text-muted hover:text-ink"
          }`}
        >
          {rating !== null && n <= rating ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}

function TagInput({ onAdd }: { onAdd: (tag: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  };
  return (
    <form onSubmit={submit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="+ tag"
        aria-label="Add a tag"
        spellCheck={false}
        autoComplete="off"
        className="w-16 border border-rule bg-paper px-1.5 py-0.5 text-[0.68rem] text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
      />
    </form>
  );
}
