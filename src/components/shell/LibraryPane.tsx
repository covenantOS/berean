"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { getBook } from "@/lib/canon";
import {
  activeCollection,
  collections,
  deleteCollection,
  getActiveCollectionId,
  licenseClass,
  memberIds,
  saveCollection,
  setActiveCollection,
  type CollectionRules,
} from "@/lib/collections";
import { citeWork, listDocuments } from "@/lib/documents";
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
import { importBook, personalbooks } from "@/lib/personalbooks";
import { printbooks, type PrintBook } from "@/lib/printbooks";
import { RIGHTS_REGISTRY, type RightsEntry } from "@/lib/rights";
import { useWorkspace } from "./WorkspaceContext";
import {
  atlasTab,
  commentaryTab,
  crossrefsTab,
  lexiconTab,
  readerTab,
  timelineTab,
  type Tab,
} from "./workspace-state";

/**
 * The library browser pane: the whole rights registry as a faceted catalog.
 * Facets follow what the registry genuinely carries (kind, status, license
 * class) plus the reader's own tags and ratings from the librarymeta
 * collection; language and era wait on structured metadata the registry
 * does not have yet. The facet filter composes into a named collection
 * (src/lib/collections.ts): a saved rule set filters the pane live, and one
 * workspace-active collection scopes the commentary wall in the dock.
 * Entries with a reader open straight into the
 * workspace: translations as reader tabs, the commentary wall, the
 * cross-reference treasury, and the lexicon as pane tabs, plus the Atlas and
 * the Timeline. Topical works open the Topical Index tab. Commentaries also
 * carry the priority steppers the wall answers, and every shipped work
 * carries the Add to bibliography handoff into a bibliography document.
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

/* Both topical works index together in the workspace's topics tab. */
const TOPIC_IDS = new Set(["naves-topical", "torreys-topical"]);

type Facets = {
  text: string;
  kind: string;
  status: string;
  license: string;
  tag: string;
  minRating: number;
};

const ALL_FACETS: Facets = { text: "", kind: "all", status: "all", license: "all", tag: "all", minRating: 0 };

/** The pane's facet state as a collection's rules. The text filter is a
 * browsing aid and never persists into a rule set. */
function rulesFromFacets(f: Facets): CollectionRules {
  return {
    kinds: f.kind === "all" ? undefined : [f.kind as RightsEntry["kind"]],
    statuses: f.status === "all" ? undefined : [f.status as RightsEntry["status"]],
    licenseClasses: f.license === "all" ? undefined : [f.license],
    tags: f.tag === "all" ? undefined : [f.tag],
    minRating: f.minRating > 0 ? f.minRating : undefined,
  };
}

/** A collection's rules as facet state, for editing. The facet row is
 * single-choice, so a multi-value facet wears its first value here. */
function facetsFromRules(rules: CollectionRules): Facets {
  return {
    ...ALL_FACETS,
    kind: rules.kinds?.[0] ?? "all",
    status: rules.statuses?.[0] ?? "all",
    license: rules.licenseClasses?.[0] ?? "all",
    tag: rules.tags?.[0] ?? "all",
    minRating: rules.minRating ?? 0,
  };
}

export default function LibraryPane() {
  const { state, activeRef, dispatch } = useWorkspace();
  const metaRows = useCollection(librarymeta);
  const savedCollections = useCollection(collections);
  useCollection(activeCollection);
  const [facets, setFacets] = useState<Facets>(ALL_FACETS);
  /** The collection filtering the pane; null leaves the facets in charge. */
  const [appliedId, setAppliedId] = useState<string | null>(null);
  /** The compose draft: naming a new collection or renaming one in edit. */
  const [draft, setDraft] = useState<{ id: string | null; name: string } | null>(null);

  const metaById = new Map(metaRows.map((m) => [m.resourceId, m]));
  const allTags = [...new Set(metaRows.flatMap((m) => m.tags))].sort();
  const order = commentaryOrder();

  const applied = savedCollections.find((c) => c.id === appliedId) ?? null;
  /* Membership evaluates live: tagging or rating a work moves it in and out
   * of the applied collection without re-selecting anything. */
  const appliedMembers = applied ? memberIds(applied.rules) : null;
  const activeId = getActiveCollectionId();

  const q = facets.text.trim().toLowerCase();
  const rows = RIGHTS_REGISTRY.filter((r) => {
    if (appliedMembers && !appliedMembers.has(r.id)) return false;
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
      r.id === "tsk-crossrefs" ||
      r.id === "naturalearth" ||
      r.id === "ussher-chronology" ||
      TOPIC_IDS.has(r.id));

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
    if (r.id === "naturalearth") return atlasTab();
    if (r.id === "ussher-chronology") return timelineTab();
    return null;
  };

  const open = (r: RightsEntry) => {
    // The topical works answer with the singleton index, not a fresh tab.
    if (TOPIC_IDS.has(r.id)) {
      dispatch({ type: "openTopics", paneId: state.activePaneId });
      return;
    }
    const tab = openTabFor(r);
    if (tab) dispatch({ type: "openTab", tab, target: { kind: "strip", paneId: state.activePaneId } });
  };

  const set = (patch: Partial<Facets>) => setFacets((f) => ({ ...f, ...patch }));

  /* Saving applies the collection at once: the pane filters by it and the
   * facet row rests until the collection is cleared. */
  const saveDraft = () => {
    if (!draft) return;
    const saved = saveCollection(draft.id, draft.name, rulesFromFacets(facets));
    if (!saved) return;
    setDraft(null);
    setAppliedId(saved.id);
  };

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
          disabled={applied !== null && draft === null}
          className="w-44 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none disabled:opacity-50"
        />
        <FacetSelect
          label="Kind"
          value={facets.kind}
          onChange={(v) => set({ kind: v })}
          disabled={applied !== null && draft === null}
          options={[
            ["all", "Every kind"],
            ...Object.entries(KIND_LABELS).map(([v, l]) => [v, l] as [string, string]),
          ]}
        />
        <FacetSelect
          label="Status"
          value={facets.status}
          onChange={(v) => set({ status: v })}
          disabled={applied !== null && draft === null}
          options={[
            ["all", "Every status"],
            ...Object.entries(STATUS_LABELS).map(([v, l]) => [v, l] as [string, string]),
          ]}
        />
        <FacetSelect
          label="License"
          value={facets.license}
          onChange={(v) => set({ license: v })}
          disabled={applied !== null && draft === null}
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
          disabled={applied !== null && draft === null}
          options={[["all", "Every tag"], ...allTags.map((t) => [t, t] as [string, string])]}
        />
        <FacetSelect
          label="Rating"
          value={String(facets.minRating)}
          onChange={(v) => set({ minRating: Number(v) })}
          disabled={applied !== null && draft === null}
          options={[
            ["0", "Any rating"],
            ["3", "3+ stars"],
            ["4", "4+ stars"],
            ["5", "5 stars"],
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[0.68rem] text-muted">
          <span className="small-caps font-semibold">Collection</span>
          <select
            value={applied?.id ?? ""}
            onChange={(e) => {
              setAppliedId(e.target.value || null);
              setDraft(null);
            }}
            aria-label="Apply a saved collection"
            className="border border-rule bg-paper px-1 py-1 text-xs text-ink focus:border-sapphire focus:outline-none"
          >
            <option value="">No collection</option>
            {savedCollections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {applied && (
          <>
            <button
              type="button"
              onClick={() => {
                setFacets(facetsFromRules(applied.rules));
                setDraft({ id: applied.id, name: applied.name });
                setAppliedId(null);
              }}
              title="Load this collection's rules into the facets to edit them"
              className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                deleteCollection(applied.id);
                setAppliedId(null);
              }}
              title="Delete this collection; a wall it scoped answers the whole shelf again"
              className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Delete
            </button>
            {activeId === applied.id ? (
              <button
                type="button"
                onClick={() => setActiveCollection(null)}
                title="Let the commentary wall answer from the whole shelf again"
                className="fx-press border border-sapphire bg-paper px-2 py-1 text-xs text-sapphire hover:border-ruby hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Scopes the commentary wall
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveCollection(applied.id)}
                title="The commentary wall and guides answer from this collection"
                className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Scope the commentary wall
              </button>
            )}
          </>
        )}
        {!applied && !draft && (
          <button
            type="button"
            onClick={() => setDraft({ id: null, name: "" })}
            title="Save the current facet filter as a named collection"
            className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Save filters as a collection
          </button>
        )}
        {draft && (
          <>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Collection name"
              aria-label="Collection name"
              autoFocus={draft.id === null}
              spellCheck={false}
              autoComplete="off"
              className="w-40 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
            />
            <button
              type="button"
              onClick={saveDraft}
              disabled={!draft.name.trim()}
              className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {draft.id ? "Save changes" : "Save collection"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-2 py-1 text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Cancel
            </button>
          </>
        )}
      </div>
      {applied && (
        <p className="text-[0.68rem] text-muted">
          Filtered by the {applied.name} collection, membership evaluated live; the facet row rests
          until you clear the collection, and Edit loads its rules back into the facets.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted">No catalog entry matches these filters.</p>
      ) : (
        <ul className="fx-stagger space-y-4">
          {rows.map((r, i) => (
            <CatalogEntry
              key={r.id}
              index={i}
              entry={r}
              meta={metaById.get(r.id)}
              priorityWork={COMMENTARY_WALL.find((w) => w.rightsId === r.id)?.workId ?? null}
              priorityIndex={order}
              canOpen={opensAsTab(r)}
              onOpen={() => open(r)}
            />
          ))}
        </ul>
      )}

      <PersonalBooksSection />

      <PrintBooksSection />

      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Facets follow what the registry genuinely carries: kind, status, and
        license class, plus your tags and ratings. Language and era wait on
        structured metadata. Commentary priority orders the wall in the dock.
        A saved collection filters this pane and can scope the commentary
        wall; membership evaluates live, so a new tag or rating moves a work
        the moment you set it.
      </p>
    </div>
  );
}

/**
 * The Personal Books shelf: the reader's own texts imported as read-only
 * resources, listed beside the catalog the way Logos shelves a compiled
 * personal book. Import is paste or a .md/.txt file read on the device; a
 * DOCX converts through Word or Google Docs first, the same road Logos
 * sends its PDFs down, and the form says so. Detected references link when
 * the book opens; the stored text is never rewritten.
 */
function PersonalBooksSection() {
  const { state, dispatch } = useWorkspace();
  const books = useCollection(personalbooks);
  const [importing, setImporting] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");

  /* A chosen file loads into the form for review; nothing imports until
   * Import is pressed, the paste path and the file path sharing one step. */
  const pickFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBody(typeof reader.result === "string" ? reader.result : "");
      setTitle((t) => t || file.name.replace(/\.(md|markdown|txt)$/i, ""));
    };
    reader.readAsText(file);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    const book = importBook({ title, author, body });
    setImporting(false);
    setTitle("");
    setAuthor("");
    setBody("");
    dispatch({
      type: "openPersonalBook",
      bookId: book.id,
      title: book.title,
      paneId: state.activePaneId,
    });
  };

  return (
    <section className="border-t border-rule pt-3">
      <div className="flex items-baseline gap-2">
        <p className="small-caps text-xs font-semibold text-muted">
          Personal books · {books.length}
        </p>
        {!importing && (
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="ml-auto border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Import a book
          </button>
        )}
      </div>

      {importing && (
        <form onSubmit={submit} className="glass mt-2 space-y-2 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              aria-label="Book title"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author"
              aria-label="Book author"
              spellCheck={false}
              autoComplete="off"
              className="w-44 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
            />
            <label className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire">
              Choose .md or .txt
              <input
                type="file"
                accept=".md,.markdown,.txt,text/plain,text/markdown"
                onChange={(e) => pickFile(e.target.files)}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Paste the text here, or choose a file above. Markdown headings and lists render in the reader."
            aria-label="Book text"
            spellCheck={false}
            className="h-36 w-full resize-y border border-rule bg-paper px-2 py-1.5 font-mono text-xs leading-relaxed text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!body.trim()}
              className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setImporting(false)}
              className="px-2 py-1 text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Cancel
            </button>
            <p className="text-[0.68rem] text-muted">
              Plain text or Markdown. A DOCX converts through Word or Google Docs first, the same
              road Logos sends its PDFs down. Scripture references link when the book opens.
            </p>
          </div>
        </form>
      )}

      {books.length > 0 && (
        <ul className="fx-stagger mt-2 space-y-1">
          {books.map((b, i) => (
            <li
              key={b.id}
              className="glass glass-hover flex items-center gap-2 px-3 py-2"
              style={{ "--i": Math.min(i, 6) } as CSSProperties}
            >
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: "openPersonalBook",
                    bookId: b.id,
                    title: b.title,
                    paneId: state.activePaneId,
                  })
                }
                title={`Open ${b.title}`}
                className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                <span className="block truncate text-sm font-medium text-ink">{b.title}</span>
                <span className="block text-[0.68rem] text-muted">
                  {b.author ? `${b.author} · ` : ""}imported{" "}
                  {new Date(b.importedAt).toLocaleDateString()}
                </span>
              </button>
              <button
                type="button"
                onClick={() => personalbooks.remove(b.id)}
                title={`Delete ${b.title}`}
                aria-label={`Delete ${b.title}`}
                className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ruby hover:border-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The Print Books shelf: the physical library, registered so Docs Search
 * can name a paper copy and where it sits. A record is cataloguing only
 * (title, author, ISBN, a shelf note, notes); no body is stored, so a book
 * opens nothing and page-number citation does not ship. One form serves
 * add and edit, the way the personal books import does.
 */
function PrintBooksSection() {
  const books = useCollection(printbooks);
  /** The book open in the form: its id, or "new" for a fresh record. */
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const begin = (b?: PrintBook) => {
    setEditing(b ? b.id : "new");
    setTitle(b?.title ?? "");
    setAuthor(b?.author ?? "");
    setIsbn(b?.isbn ?? "");
    setLocation(b?.location ?? "");
    setNotes(b?.notes ?? "");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || editing === null) return;
    /* Cleared fields write undefined, which JSON drops: the form can empty
     * what it once set. */
    const fields = {
      title: trimmed,
      author: author.trim() || undefined,
      isbn: isbn.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (editing === "new") printbooks.create(fields);
    else printbooks.update(editing, fields);
    setEditing(null);
  };

  return (
    <section className="border-t border-rule pt-3">
      <div className="flex items-baseline gap-2">
        <p className="small-caps text-xs font-semibold text-muted">
          Print books · {books.length}
        </p>
        {editing === null && (
          <button
            type="button"
            onClick={() => begin()}
            className="ml-auto border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Register a book
          </button>
        )}
      </div>

      {editing !== null && (
        <form onSubmit={submit} className="glass mt-2 space-y-2 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              aria-label="Book title"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author"
              aria-label="Book author"
              spellCheck={false}
              autoComplete="off"
              className="w-44 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
            />
            <input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="ISBN"
              aria-label="ISBN"
              spellCheck={false}
              autoComplete="off"
              className="w-36 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where it sits (shelf, room, box)"
              aria-label="Where the copy sits"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes on the edition or the copy…"
            aria-label="Notes"
            spellCheck={false}
            rows={2}
            className="w-full resize-y border border-rule bg-paper px-2 py-1.5 text-xs leading-relaxed text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!title.trim()}
              className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {editing === "new" ? "Register" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-2 py-1 text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Cancel
            </button>
            <p className="text-[0.68rem] text-muted">
              Cataloguing only: Docs Search names the book and where it sits. No body is stored,
              so nothing opens and page numbers are not tracked.
            </p>
          </div>
        </form>
      )}

      {books.length > 0 && (
        <ul className="fx-stagger mt-2 space-y-1">
          {books.map((b, i) => (
            <li
              key={b.id}
              className="glass glass-hover flex items-center gap-2 px-3 py-2"
              style={{ "--i": Math.min(i, 6) } as CSSProperties}
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{b.title}</span>
                <span className="block text-[0.68rem] text-muted">
                  {[b.author, b.isbn ? `ISBN ${b.isbn}` : undefined, b.location]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => begin(b)}
                title={`Edit ${b.title}`}
                className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => printbooks.remove(b.id)}
                title={`Delete ${b.title}`}
                aria-label={`Delete ${b.title}`}
                className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ruby hover:border-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FacetSelect({  label,  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1 text-[0.68rem] text-muted">
      <span className="small-caps font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="border border-rule bg-paper px-1 py-1 text-xs text-ink focus:border-sapphire focus:outline-none disabled:opacity-50"
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
  canOpen,
  onOpen,
  index,
}: {
  entry: RightsEntry;
  meta: LibraryMeta | undefined;
  priorityWork: string | null;
  priorityIndex: string[];
  canOpen: boolean;
  onOpen: () => void;
  /** Its order in the filtered list, for the cascade's --i clock. */
  index: number;
}) {
  const rating = meta?.rating ?? null;
  const tags = meta?.tags ?? [];
  const position = priorityWork ? priorityIndex.indexOf(priorityWork) : -1;

  return (
    <li
      className="glass glass-hover p-3"
      style={{ "--i": Math.min(index, 8) } as CSSProperties}
    >
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
            className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Open
          </button>
        )}
        {r.status === "shipped" && <CiteButton resourceId={r.id} />}
        {priorityWork && position >= 0 && (
          <span className="flex items-center gap-1 text-[0.68rem] text-muted">
            <span className="small-caps font-semibold">Wall priority {position + 1}</span>
            <button
              type="button"
              disabled={position === 0}
              onClick={() => moveCommentaryWork(priorityWork, -1)}
              title="Move up the commentary wall"
              aria-label={`Move ${r.title} up the commentary wall`}
              className="fx-press border border-rule bg-paper px-1 leading-none text-ink hover:border-sapphire disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={position === priorityIndex.length - 1}
              onClick={() => moveCommentaryWork(priorityWork, 1)}
              title="Move down the commentary wall"
              aria-label={`Move ${r.title} down the commentary wall`}
              className="fx-press border border-rule bg-paper px-1 leading-none text-ink hover:border-sapphire disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              ▼
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * The bibliography handoff a shipped work earns, mirroring the clippings
 * chooser: the device's bibliography documents, then the row that starts a
 * new one around the work. Picking a target writes the citation and closes,
 * a quiet "Added" standing in its place for a moment.
 */
function CiteButton({ resourceId }: { resourceId: string }) {
  const docs = useCollection(listDocuments, (d) => d.kind === "bibliography");
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState(false);

  const pick = (docId: string | null) => {
    citeWork(docId, resourceId, "Bibliography");
    setPicking(false);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  if (added) {
    return <span className="px-2 py-1 text-xs text-muted">Added to the bibliography</span>;
  }

  return (
    <span className="relative">
      <button
        type="button"
        aria-expanded={picking}
        onClick={() => setPicking((v) => !v)}
        className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Add to bibliography
      </button>
      {picking && (
        <span
          className="glass fx-scale absolute left-0 top-full z-10 mt-1 block w-56"
          style={{ "--fx-origin": "0 0" } as CSSProperties}
        >
          <span className="small-caps block px-3 pt-2 pb-1 text-[0.62rem] text-muted">
            Cite this work in
          </span>
          {docs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => pick(doc.id)}
              className="flex w-full items-center gap-2 px-3 py-1 text-left text-[0.72rem] text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {doc.title || "Untitled bibliography"}
              <span className="ml-auto pl-3 text-[0.62rem] text-muted">{doc.items.length}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex w-full items-center gap-2 px-3 py-1 pb-2 text-left text-[0.72rem] text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            New bibliography document
          </button>
        </span>
      )}
    </span>
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
