"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCollection } from "@/lib/hooks";
import {
  activeCopyStyle,
  BUILTIN_COPY_STYLES,
  copyStyles,
  createCopyStyle,
  deleteCopyStyle,
  formatVerses,
  formatVersesHtml,
  listCopyStyles,
  REFERENCE_POSITIONS,
  setActiveCopyStyle,
  type CopyStyle,
  type CopyStyleRecord,
  type CopyVerse,
  type ReferencePosition,
} from "@/lib/copystyles";
import {
  BUILTIN_STYLES,
  createStyle,
  deleteStyle,
  highlights,
  highlightStyles,
  HIGHLIGHT_EFFECTS,
  STYLE_PALETTE,
  styleSwatch,
  type HighlightEffect,
  type HighlightStyle,
} from "@/lib/highlights";
import { CONFESSIONS, deleteProfile, profiles, saveProfile } from "@/lib/settings";
import { deleteGraph, exportGraph, importGraph } from "@/lib/store";
import { STORAGE_KEY } from "./workspace-state";

/**
 * The Settings pane: the retired /settings page in the workspace. The
 * Scribe's governed profile, the highlight style palette, and the
 * whole-graph export, import, and delete, behavior unchanged from the page.
 */
export default function SettingsPane() {
  const profileRows = useCollection(profiles);
  const profile = profileRows[0];
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");

  function download() {
    const blob = new Blob([exportGraph()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `berean-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(file: File) {
    const result = importGraph(await file.text());
    setMessage(result.ok ? "Import complete — your study is restored on this device." : result.error ?? "Import failed.");
  }

  function destroyAll() {
    if (
      window.confirm(
        "Delete every note, project, sermon, liturgy, plan, and setting stored on this device? Export first if you want a copy. This cannot be undone."
      )
    ) {
      deleteGraph();
      setMessage("Everything on this device has been deleted.");
    }
  }

  /* The workspace session is one key apart from the knowledge graph, so a
   * reset drops the open panes and tabs and nothing else; the reload boots
   * into the default state. */
  function resetWorkspace() {
    if (
      window.confirm(
        "Reset this device's workspace to the default layout? Your notes, books, layouts, and collections stay; the open panes and tabs go."
      )
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  }

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Settings</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">Your work belongs to you</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          Everything Berean knows is written here or visible in your rooms:
          inspectable, exportable, and deletable, with nothing inferred behind
          your back.
        </p>
      </header>

      <section className="rounded-[4px] border border-rule bg-surface p-5">
        <h3 className="small-caps mb-3 text-sm text-muted">Your standards — what the Scribe may know</h3>
        <div className="grid gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Confession</span>
            <select
              value={profile?.confession ?? "None declared"}
              onChange={(e) => saveProfile({ confession: e.target.value })}
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            >
              {CONFESSIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Doctrinal notes</span>
            <textarea
              value={profile?.confessionNote ?? ""}
              onChange={(e) => saveProfile({ confessionNote: e.target.value })}
              rows={2}
              placeholder="Convictions on the disputed questions, translation preferences…"
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Standing charge to the Scribe</span>
            <textarea
              value={profile?.scribeCharge ?? ""}
              onChange={(e) => saveProfile({ scribeCharge: e.target.value })}
              rows={3}
              placeholder="How you want briefs arranged, sources weighted, questions framed…"
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile?.scribeMayReadNotes ?? false}
              onChange={(e) => saveProfile({ scribeMayReadNotes: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              The Scribe may read my working notes on a passage when preparing its brief for that
              passage. <span className="text-muted">Off by default; briefs then use only the chapter text and this tab.</span>
            </span>
          </label>
          {profile && (
            <button
              onClick={() => deleteProfile()}
              className="justify-self-start rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
            >
              Forget all of this
            </button>
          )}
        </div>
        <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
          These are the only memory scopes the Scribe has. Nothing is learned by inference, and
          nothing here is sent anywhere except inside your own brief requests.
        </p>
      </section>

      <HighlightStylesSection />

      <CopyStylesSection />

      <ShortcutsSection />

      <section className="rounded-[4px] border border-rule bg-surface p-5">
        <h3 className="small-caps mb-3 text-sm text-muted">Your study — export, restore, delete</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={download}
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Export everything (.json)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-[4px] border border-rule px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Import an export
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={destroyAll}
            className="rounded-[4px] border border-ruby/50 px-4 py-2 text-sm font-medium text-ruby hover:bg-paper"
          >
            Delete everything on this device
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-emerald">{message}</p>}
        <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
          The export contains your whole knowledge graph — marginalia, projects, sermons,
          manuscripts, liturgies, plans, memory work, calendar, rule of life, and these settings.
          It is also the bridge between devices until cloud sync arrives (see the architecture
          notes in the repository); no account is required and no telemetry exists.
        </p>
      </section>
      <section className="rounded-[4px] border border-rule bg-surface p-5">
        <h3 className="small-caps mb-3 text-sm text-muted">Workspace</h3>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            Return this device&apos;s panes, tabs, and arrangement to the default workspace. Your
            notes, books, saved layouts, and collections stay; only the open arrangement goes.
          </p>
          <button
            onClick={resetWorkspace}
            className="shrink-0 rounded-[4px] border border-rule px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Reset workspace
          </button>
        </div>
        <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
          Display settings are per device by construction: text scale, candlelight, and citation
          style are each a device-local key, so every device keeps its own.
        </p>
      </section>
      <section className="rounded-[4px] border border-rule bg-surface p-5">
        <h3 className="small-caps mb-3 text-sm text-muted">Welcome</h3>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            The first-run walkthrough: translation choice, a task layout, and the starter
            documents. Your existing work is left alone.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("berean:welcome"))}
            className="shrink-0 rounded-[4px] border border-rule px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Open the welcome again
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * The keyboard map: every chord the workspace actually answers, listed
 * plainly. A customizable toolbar, draggable shortcut targets, and full
 * remapping do not ship.
 */
function ShortcutsSection() {
  const rows: { keys: string; does: string }[] = [
    { keys: "Ctrl or ⌘ K", does: "Opens the omnibox: references, searches, and commands" },
    {
      keys: "Escape",
      does: "Closes the omnibox, open menus, the find box, the reading view, and the pulpit view; lets a selected verse go",
    },
    { keys: "Left and Right arrows", does: "Previous and next chapter in the reader pane in focus" },
    {
      keys: "Enter, Shift+Enter",
      does: "Next and previous match while the chapter's find box is open",
    },
    {
      keys: "Arrows, Space, PageUp, PageDown",
      does: "Scroll the pulpit view; Home and End jump to the ends; + and − size the text",
    },
  ];
  return (
    <section className="rounded-[4px] border border-rule bg-surface p-5">
      <h3 className="small-caps mb-3 text-sm text-muted">Keyboard: the chords the workspace answers</h3>
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li key={row.keys} className="flex items-baseline gap-3 text-sm">
            <kbd className="shrink-0 rounded-[4px] border border-rule bg-paper px-1.5 py-0.5 text-xs">
              {row.keys}
            </kbd>
            <span>{row.does}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
        Fields, menus, and selections keep their own keys: no chord fires while you are typing,
        and the arrow keys leave a text selection alone. A customizable toolbar and full remapping
        do not ship.
      </p>
    </section>
  );
}

/**
 * The highlight style editor: the built-in tints read-only, the customs
 * listed with rename and delete, and one form for creating and editing. A
 * style is a name, a color (the stained-glass palette or a custom hex), and
 * an effect; deleting a style says plainly what happens to its verses, then
 * unmaps them.
 */
function HighlightStylesSection() {
  const customs = useCollection(highlightStyles);
  const marks = useCollection(highlights);
  /** The style open in the form: its id, or "new" for a fresh one. */
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("amber");
  const [effect, setEffect] = useState<HighlightEffect>("background");

  const begin = (s?: HighlightStyle) => {
    setEditing(s ? s.id : "new");
    setName(s?.name ?? "");
    setColor(s?.color ?? "amber");
    setEffect(s?.effect ?? "background");
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || editing === null) return;
    if (editing === "new") createStyle(trimmed, color, effect);
    else highlightStyles.update(editing, { name: trimmed, color, effect });
    setEditing(null);
  };

  const remove = (s: HighlightStyle) => {
    const count = marks.filter((m) => m.styleId === s.id).length;
    const message =
      count > 0
        ? `Delete "${s.name}"? The ${count} ${count === 1 ? "verse" : "verses"} wearing it lose their highlight.`
        : `Delete "${s.name}"? No verse wears it.`;
    if (window.confirm(message)) deleteStyle(s.id);
  };

  return (
    <section className="rounded-[4px] border border-rule bg-surface p-5">
      <h3 className="small-caps mb-3 text-sm text-muted">
        Highlight styles: the palette the reader offers
      </h3>
      <ul className="grid gap-2">
        {BUILTIN_STYLES.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 border border-rule"
              style={styleSwatch(s) as CSSProperties}
            />
            <span>{s.name}</span>
            <span className="text-xs text-muted">built in</span>
          </li>
        ))}
        {customs.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="flex h-3.5 w-3.5 items-center justify-center border border-rule text-[0.62rem] font-bold leading-none"
              style={styleSwatch(s) as CSSProperties}
            >
              {s.effect === "bold" ? "A" : ""}
            </span>
            <button
              onClick={() => begin(s)}
              title={`Edit ${s.name}`}
              className="hover:text-sapphire"
            >
              {s.name}
            </button>
            <span className="text-xs text-muted">{s.effect}</span>
            <button
              onClick={() => remove(s)}
              title={`Delete ${s.name}`}
              aria-label={`Delete ${s.name}`}
              className="ml-auto px-1 leading-none text-muted hover:text-ruby"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {editing === null ? (
        <button
          onClick={() => begin()}
          className="mt-3 rounded-[4px] border border-rule px-3 py-1.5 text-xs font-medium hover:bg-paper"
        >
          New style
        </button>
      ) : (
        <div className="mt-3 grid gap-3 border-t border-rule pt-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="What this mark means…"
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block font-medium">Color</span>
            <div className="flex items-center gap-2">
              {STYLE_PALETTE.map((c) => (
                <button
                  key={c}
                  title={c}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={`h-4 w-4 border ${color === c ? "border-ink" : "border-rule"}`}
                  style={{ background: `var(--stained-${c})` }}
                />
              ))}
              <input
                type="color"
                value={color.startsWith("#") ? color : "#a97a1f"}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Custom color"
                title="Custom color"
                className="h-6 w-9 border border-rule bg-paper"
              />
            </div>
          </div>
          <div className="text-sm">
            <span className="mb-1 block font-medium">Effect</span>
            <div className="flex flex-wrap gap-2">
              {HIGHLIGHT_EFFECTS.map((e) => (
                <button
                  key={e.key}
                  aria-pressed={effect === e.key}
                  onClick={() => setEffect(e.key)}
                  className={`rounded-[4px] border px-2 py-1 text-xs ${
                    effect === e.key
                      ? "border-sapphire text-sapphire"
                      : "border-rule text-ink hover:border-sapphire"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!name.trim()}
              className="rounded-[4px] bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {editing === "new" ? "Create style" : "Save style"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-[4px] border border-rule px-3 py-1.5 text-xs hover:bg-paper"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
        Every style here appears in the reader&apos;s highlight palette beside the built-in tints;
        editing one restyles every verse wearing it.
      </p>
    </section>
  );
}

/* The sample the copy style preview formats: John 3:16-17 in the KJV, so
 * the translation tag and verse numbers have something to show. */
const COPY_SAMPLE: CopyVerse[] = [
  {
    number: 16,
    text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
  },
  {
    number: 17,
    text: "For God sent not his Son into the world to condemn the world; but that the world through him might be saved.",
  },
];
const COPY_SAMPLE_REFERENCE = "John 3:16-17";
const COPY_SAMPLE_TRANSLATION = "KJV";

/** A one-line summary of a style's choices, for the list rows. */
function copyStyleSummary(s: CopyStyle): string {
  return [
    s.referencePosition === "none" ? "no reference" : `reference ${s.referencePosition}`,
    ...(s.translationTag ? ["translation tag"] : []),
    ...(s.verseNumbers ? ["verse numbers"] : []),
    ...(s.versePerLine ? ["verse per line"] : ["flowing"]),
    ...(s.quotationMarks ? ["quoted"] : []),
  ].join(", ");
}

/** The sample formatted two ways: the styled form Word and email paste, then the plain text. */
function CopyStylePreview({ style }: { style: CopyStyle }) {
  const html = formatVersesHtml(COPY_SAMPLE, COPY_SAMPLE_REFERENCE, COPY_SAMPLE_TRANSLATION, style);
  const text = formatVerses(COPY_SAMPLE, COPY_SAMPLE_REFERENCE, COPY_SAMPLE_TRANSLATION, style);
  return (
    <div className="rounded-[4px] border border-rule bg-paper p-3">
      <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
      <pre className="mt-2 whitespace-pre-wrap border-t border-rule pt-2 font-sans text-[0.7rem] text-muted">
        {text}
      </pre>
    </div>
  );
}

/**
 * The copy style editor: the two built-ins (the retired binary citation
 * choice, byte-identical) read-only, the customs listed with edit and
 * delete, one form for creating and editing with a live sample preview, and
 * the picker naming the one active style every copy path honors. Deleting
 * the active style says plainly that copies fall back to the built-in
 * choice.
 */
function CopyStylesSection() {
  const customs = useCollection(copyStyles);
  const styles = listCopyStyles(customs);
  const [activeId, setActiveId] = useState("builtin-text-first");
  /** The style open in the form: its id, or "new" for a fresh one. */
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [referencePosition, setReferencePosition] = useState<ReferencePosition>("after");
  const [translationTag, setTranslationTag] = useState(true);
  const [verseNumbers, setVerseNumbers] = useState(false);
  const [versePerLine, setVersePerLine] = useState(false);
  const [quotationMarks, setQuotationMarks] = useState(false);

  useEffect(() => {
    setActiveId(activeCopyStyle(styles).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customs]);

  /** The style the form is drafting, previewed live below. */
  const draft: CopyStyle = {
    name,
    referencePosition,
    translationTag,
    verseNumbers,
    versePerLine,
    quotationMarks,
  };

  const begin = (s?: CopyStyleRecord) => {
    setEditing(s ? s.id : "new");
    setName(s?.name ?? "");
    setReferencePosition(s?.referencePosition ?? "after");
    setTranslationTag(s?.translationTag ?? true);
    setVerseNumbers(s?.verseNumbers ?? false);
    setVersePerLine(s?.versePerLine ?? false);
    setQuotationMarks(s?.quotationMarks ?? false);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || editing === null) return;
    const fields = { ...draft, name: trimmed };
    if (editing === "new") createCopyStyle(fields);
    else copyStyles.update(editing, fields);
    setEditing(null);
  };

  const remove = (s: CopyStyleRecord) => {
    const message =
      activeId === s.id
        ? `Delete "${s.name}"? It is the active style; copies fall back to the built-in choice.`
        : `Delete "${s.name}"?`;
    if (window.confirm(message)) deleteCopyStyle(s.id);
  };

  const active = styles.find((s) => s.id === activeId) ?? styles[0];

  return (
    <section className="rounded-[4px] border border-rule bg-surface p-5">
      <h3 className="small-caps mb-3 text-sm text-muted">
        Copy styles: how copied verses arrange themselves
      </h3>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Active style</span>
        <select
          value={activeId}
          onChange={(e) => {
            setActiveCopyStyle(e.target.value);
            setActiveId(e.target.value);
          }}
          className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3">
        <CopyStylePreview style={active} />
      </div>
      <ul className="mt-3 grid gap-2">
        {BUILTIN_COPY_STYLES.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span>{s.name}</span>
            <span className="text-xs text-muted">built in</span>
          </li>
        ))}
        {customs.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <button onClick={() => begin(s)} title={`Edit ${s.name}`} className="hover:text-sapphire">
              {s.name}
            </button>
            <span className="text-xs text-muted">{copyStyleSummary(s)}</span>
            <button
              onClick={() => remove(s)}
              title={`Delete ${s.name}`}
              aria-label={`Delete ${s.name}`}
              className="ml-auto px-1 leading-none text-muted hover:text-ruby"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {editing === null ? (
        <button
          onClick={() => begin()}
          className="mt-3 rounded-[4px] border border-rule px-3 py-1.5 text-xs font-medium hover:bg-paper"
        >
          New style
        </button>
      ) : (
        <div className="mt-3 grid gap-3 border-t border-rule pt-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="What this copy is for…"
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block font-medium">Reference</span>
            <div className="flex flex-wrap gap-2">
              {REFERENCE_POSITIONS.map((p) => (
                <button
                  key={p.key}
                  aria-pressed={referencePosition === p.key}
                  onClick={() => setReferencePosition(p.key)}
                  className={`rounded-[4px] border px-2 py-1 text-xs ${
                    referencePosition === p.key
                      ? "border-sapphire text-sapphire"
                      : "border-rule text-ink hover:border-sapphire"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={translationTag}
                onChange={(e) => setTranslationTag(e.target.checked)}
              />
              Tag the translation when the copy knows it
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={verseNumbers}
                onChange={(e) => setVerseNumbers(e.target.checked)}
              />
              Number the verses
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={versePerLine}
                onChange={(e) => setVersePerLine(e.target.checked)}
              />
              One verse per line
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={quotationMarks}
                onChange={(e) => setQuotationMarks(e.target.checked)}
              />
              Quote the text
            </label>
          </div>
          <CopyStylePreview style={draft} />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!name.trim()}
              className="rounded-[4px] bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {editing === "new" ? "Create style" : "Save style"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-[4px] border border-rule px-3 py-1.5 text-xs hover:bg-paper"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
        Every copy path honors the active style: the verse menus, the context strip, a list&apos;s
        copy-all, and Power Lookup. Where the browser allows, a copy also carries the styled form
        shown above, so Word and email paste the formatting; the plain text travels with it.
      </p>
    </section>
  );
}
