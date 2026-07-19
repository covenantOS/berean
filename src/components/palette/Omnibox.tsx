"use client";

/**
 * README: Command omnibox (the workspace command palette)
 * =======================================================
 *
 * Mount
 * -----
 * Self-contained client component. The workspace shell mounts it once,
 * anywhere in its tree, and needs no props:
 *
 *   import Omnibox from "@/components/palette/Omnibox";
 *
 *   <Omnibox />
 *
 * It renders nothing until opened. Open it two ways:
 *   1. The user presses Ctrl/Cmd+K anywhere (it listens on window).
 *   2. The shell dispatches `window.dispatchEvent(new CustomEvent("berean:omnibox-toggle"))`,
 *      so a visible button can open it without keyboard-only power.
 * It closes on Esc, on outside click, and after any selection.
 *
 * Event contract (dispatched on window, payload in `detail`)
 * ----------------------------------------------------------
 *   "berean:open-ref"          { book, chapter, verse?, verseEnd? }
 *                              Bible reference input, a text hit, a daily
 *                              verse, or a recent. `book` is the canon slug.
 *   "berean:open-lexicon"      { id }            Strong's id, e.g. "G25".
 *   "berean:open-guide"        { book?, chapter? }  Passage Guide; absent ref
 *                              means the passage in focus.
 *   "berean:open-customguide"  { guideId, name, book?, chapter? }  A custom
 *                              guide; absent ref means the passage in focus.
 *   "berean:open-guideeditor"  { guideId? }        The Guide Editor; absent id
 *                              opens the guide list.
 *   "berean:open-wordstudy"    { id }            Word study for a Strong's id.
 *   "berean:open-exegetical"   { book?, chapter? }  Exegetical Guide; absent
 *                              ref means the passage in focus.
 *   "berean:open-topicguide"   { work, id, title }  Topic Guide for a Nave's
 *                              or Torrey's entry.
 *   "berean:open-factbook"     { id, name }         Factbook for a TIPNR
 *                              entity.
 *   "berean:open-textcompare"  { book?, chapter? }  Text Comparison; absent
 *                              ref means the passage in focus.
 *   "berean:open-concordance"  { book? }         Concordance; absent book
 *                              means the book in focus.
 *   "berean:search"            { q }             Plain text submitted.
 *   "berean:apply-preset"      { preset }        A built-in layout preset id
 *                              (LAYOUT_PRESETS in shell/workspace-state.ts).
 *   "berean:restore-layout"    { id }            A saved layout's record id in
 *                              berean.layouts.v1 (shell/layouts.ts).
 *   "berean:toggle-right-dock" {}                Ask the shell to flip the dock.
 * Topic rows open the Topic Guide as a pane tab; entity rows open the
 * Factbook as a pane tab (the old /library/entity/[id] pages stay
 * reachable for deep links).
 *
 * Data
 * ----
 * References and Strong's numbers parse client-side as you type (./parse.ts).
 * Text queries call GET /api/omnibox?q=, which returns grouped JSON:
 * { q, entities, topics, hits, total } (five of each group at most).
 * The last 10 selections are kept in localStorage under "berean.recents.v1"
 * and are shown when the input is empty.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dailyRef } from "@/lib/daily-verse";
import { guides } from "@/lib/guides";
import { useCollection } from "@/lib/hooks";
import { layouts } from "@/components/shell/layouts";
import { LAYOUT_PRESETS } from "@/components/shell/workspace-state";
import { parseInput, type ParsedInput } from "./parse";

/* --------------------------------- types --------------------------------- */

interface ApiEntity {
  id: string;
  name: string;
  kind: string;
  type: string;
  brief: string;
  refs: number;
}

interface ApiTopic {
  work: string;
  id: string;
  title: string;
  refs: number;
}

interface ApiHit {
  book: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ApiResponse {
  q: string;
  entities: ApiEntity[];
  topics: ApiTopic[];
  hits: ApiHit[];
  total: number;
}

interface OpenRefDetail {
  book: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
}

type Recent =
  | { kind: "ref"; label: string; detail: OpenRefDetail }
  | { kind: "lexicon"; label: string; detail: { id: string } }
  | { kind: "search"; label: string; detail: { q: string } }
  | { kind: "entity"; label: string; detail: { id: string; name: string } }
  | { kind: "topic"; label: string; href: string };

type GroupName =
  | "References"
  | "Commands"
  | "Layouts"
  | "People and places"
  | "Topics"
  | "Text hits"
  | "Recent";

interface Item {
  key: string;
  group: GroupName;
  label: string;
  /** Reference rows read like the concordance: small caps in sapphire. */
  refStyle?: boolean;
  sub?: string;
  /** Scripture text rows render in the reader face. */
  scripture?: boolean;
  meta?: string;
  run: () => void;
}

/* -------------------------------- recents -------------------------------- */

const RECENTS_KEY = "berean.recents.v1";
const RECENTS_MAX = 10;

function loadRecents(): Recent[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Recent[]).slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(entry: Recent) {
  try {
    const rest = loadRecents().filter((r) => !(r.kind === entry.kind && r.label === entry.label));
    localStorage.setItem(RECENTS_KEY, JSON.stringify([entry, ...rest].slice(0, RECENTS_MAX)));
  } catch {
    // Storage unavailable; recents are a convenience, never a requirement.
  }
}

function recentKindLabel(kind: Recent["kind"]): string {
  switch (kind) {
    case "ref":
      return "Passage";
    case "lexicon":
      return "Lexicon";
    case "search":
      return "Concordance";
    case "entity":
      return "Person or place";
    case "topic":
      return "Topic";
  }
}

/* -------------------------------- commands -------------------------------- */

interface Command {
  id: string;
  label: string;
  /** Shown at the right edge of the row. */
  meta?: string;
}

const COMMANDS: Command[] = [
  ...LAYOUT_PRESETS.map((p) => ({
    id: `preset-${p.id}`,
    label: `Open the ${p.name} layout`,
    meta: "Preset",
  })),
  { id: "guide", label: "Passage guide for this passage", meta: "Guide" },
  { id: "exegetical", label: "Exegetical guide for this passage", meta: "Guide" },
  { id: "guideeditor", label: "Open the guide editor", meta: "Guide" },
  { id: "concordance", label: "Concordance for this book", meta: "Tool" },
  { id: "toggle-dock", label: "Toggle right dock" },
  { id: "daily", label: "Go to daily verse" },
  { id: "settings", label: "Open settings" },
];

/* -------------------------------- component ------------------------------- */

export default function Omnibox() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [searching, setSearching] = useState(false);
  /** -1 means nothing highlighted; Enter then submits the parsed input. */
  const [active, setActive] = useState(-1);
  const [recents, setRecents] = useState<Recent[]>([]);
  /** The user's named layouts, listed as action rows beside the presets. */
  const savedLayouts = useCollection(layouts);
  /** The user's custom guides, listed as guide rows on a parsed reference. */
  const customGuides = useCollection(guides);

  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((o) => !o), []);

  /* Global open/close: Ctrl/Cmd+K and the shell's toggle event. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("berean:omnibox-toggle", togglePalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("berean:omnibox-toggle", togglePalette);
    };
  }, [togglePalette]);

  /* Reset state and focus each time the palette opens. */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(null);
    setActive(-1);
    setRecents(loadRecents());
    inputRef.current?.focus();
  }, [open]);

  /* Esc closes even when focus has left the input. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePalette();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePalette]);

  const parsed = parseInput(query);

  /* Text queries ask the omnibox API; references and Strong's never do. */
  useEffect(() => {
    if (!open || parsed.kind !== "search" || parsed.q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/omnibox?q=${encodeURIComponent(parsed.q)}`, { signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: ApiResponse | null) => {
          if (data) setResults(data);
          setSearching(false);
        })
        .catch(() => {
          // Aborted on the next keystroke, or the request failed quietly.
        });
    }, 160);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  /* New input or new results drop any highlight back to submit mode. */
  useEffect(() => setActive(-1), [query, results]);

  function emit(name: string, detail: unknown) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function openRef(detail: OpenRefDetail, label: string) {
    pushRecent({ kind: "ref", label, detail });
    emit("berean:open-ref", detail);
    closePalette();
  }

  function openStrongs(id: string) {
    pushRecent({ kind: "lexicon", label: id, detail: { id } });
    emit("berean:open-lexicon", { id });
    closePalette();
  }

  function runSearch(q: string) {
    pushRecent({ kind: "search", label: q, detail: { q } });
    emit("berean:search", { q });
    closePalette();
  }

  function runCommand(id: string) {
    if (id.startsWith("preset-")) {
      emit("berean:apply-preset", { preset: id.slice("preset-".length) });
    } else if (id === "guide") {
      emit("berean:open-guide", {});
    } else if (id === "exegetical") {
      emit("berean:open-exegetical", {});
    } else if (id === "guideeditor") {
      emit("berean:open-guideeditor", {});
    } else if (id === "concordance") {
      emit("berean:open-concordance", {});
    } else if (id === "toggle-dock") {
      emit("berean:toggle-right-dock", {});
    } else if (id === "daily") {
      const d = dailyRef(new Date());
      openRef({ book: d.slug, chapter: d.chapter, verse: d.verse }, d.label);
      return;
    } else if (id === "settings") {
      router.push("/settings");
    }
    closePalette();
  }

  function runRecent(r: Recent) {
    if (r.kind === "ref") emit("berean:open-ref", r.detail);
    else if (r.kind === "lexicon") emit("berean:open-lexicon", r.detail);
    else if (r.kind === "search") emit("berean:search", r.detail);
    else if (r.kind === "entity") {
      // Recents written before the Factbook tab carried an href, not a
      // detail; those rows fall through to the router like a topic.
      if ("detail" in r && r.detail) emit("berean:open-factbook", r.detail);
      else if ("href" in r && typeof r.href === "string") router.push(r.href);
    } else router.push(r.href);
    pushRecent(r);
    closePalette();
  }

  /* ------------------------------ item list ------------------------------ */

  const items: Item[] = [];
  const q = query.trim();

  if (!q) {
    for (const r of recents) {
      items.push({
        key: `recent-${r.kind}-${r.label}`,
        group: "Recent",
        label: r.label,
        refStyle: r.kind === "ref",
        sub: recentKindLabel(r.kind),
        run: () => runRecent(r),
      });
    }
    for (const c of COMMANDS) {
      items.push({
        key: `command-${c.id}`,
        group: "Commands",
        label: c.label,
        meta: c.meta ?? commandMeta(c.id),
        run: () => runCommand(c.id),
      });
    }
    for (const l of savedLayouts) {
      items.push({
        key: `layout-${l.id}`,
        group: "Layouts",
        label: l.name,
        meta: "Saved layout",
        run: () => {
          emit("berean:restore-layout", { id: l.id });
          closePalette();
        },
      });
    }
  } else {
    if (parsed.kind === "ref") {
      items.push({
        key: "ref",
        group: "References",
        label: parsed.label,
        refStyle: true,
        sub: "Open passage",
        run: () =>
          openRef(
            { book: parsed.book, chapter: parsed.chapter, verse: parsed.verse, verseEnd: parsed.verseEnd },
            parsed.label
          ),
      });
      items.push({
        key: "ref-guide",
        group: "References",
        label: `Passage guide: ${parsed.label}`,
        sub: "Commentaries, cross-references, people, topics",
        run: () => {
          emit("berean:open-guide", { book: parsed.book, chapter: parsed.chapter });
          closePalette();
        },
      });
      items.push({
        key: "ref-exegetical",
        group: "References",
        label: `Exegetical guide: ${parsed.label}`,
        sub: "Word by word, important words, lemmas, variants",
        run: () => {
          emit("berean:open-exegetical", { book: parsed.book, chapter: parsed.chapter });
          closePalette();
        },
      });
      for (const g of customGuides) {
        items.push({
          key: `ref-customguide-${g.id}`,
          group: "References",
          label: `${g.name}: ${parsed.label}`,
          sub: "Your custom guide",
          run: () => {
            emit("berean:open-customguide", {
              guideId: g.id,
              name: g.name,
              book: parsed.book,
              chapter: parsed.chapter,
            });
            closePalette();
          },
        });
      }
      items.push({
        key: "ref-textcompare",
        group: "References",
        label: `Compare texts: ${parsed.label}`,
        sub: "Every translation against a base, word by word",
        run: () => {
          emit("berean:open-textcompare", { book: parsed.book, chapter: parsed.chapter });
          closePalette();
        },
      });
      items.push({
        key: "ref-concordance",
        group: "References",
        label: `Concordance: ${parsed.bookName}`,
        sub: "Every word and lemma in the book, counted, with its verses",
        run: () => {
          emit("berean:open-concordance", { book: parsed.book });
          closePalette();
        },
      });
    } else if (parsed.kind === "strongs") {
      items.push({
        key: "strongs",
        group: "References",
        label: parsed.id,
        refStyle: true,
        sub: `Strong's number · ${parsed.id.startsWith("H") ? "Hebrew" : "Greek"} lexicon`,
        run: () => openStrongs(parsed.id),
      });
      items.push({
        key: "strongs-wordstudy",
        group: "References",
        label: `Word study: ${parsed.id}`,
        sub: "Lexicon, occurrences, forms, topics",
        run: () => {
          emit("berean:open-wordstudy", { id: parsed.id });
          closePalette();
        },
      });
    }

    const needle = q.toLowerCase();
    for (const c of COMMANDS) {
      if (c.label.toLowerCase().includes(needle)) {
        items.push({
          key: `command-${c.id}`,
          group: "Commands",
          label: c.label,
          meta: c.meta ?? commandMeta(c.id),
          run: () => runCommand(c.id),
        });
      }
    }
    for (const l of savedLayouts) {
      if (l.name.toLowerCase().includes(needle)) {
        items.push({
          key: `layout-${l.id}`,
          group: "Layouts",
          label: l.name,
          meta: "Saved layout",
          run: () => {
            emit("berean:restore-layout", { id: l.id });
            closePalette();
          },
        });
      }
    }

    if (parsed.kind === "search" && parsed.q.length >= 2 && results) {
      for (const e of results.entities) {
        items.push({
          key: `entity-${e.id}`,
          group: "People and places",
          label: e.name,
          sub: `${e.kind === "place" ? "place" : e.type.toLowerCase() || e.kind}${
            e.brief ? ` · ${e.brief}` : ""
          } · ${e.refs.toLocaleString()} ${e.refs === 1 ? "reference" : "references"}`,
          run: () => {
            pushRecent({ kind: "entity", label: e.name, detail: { id: e.id, name: e.name } });
            emit("berean:open-factbook", { id: e.id, name: e.name });
            closePalette();
          },
        });
      }
      for (const t of results.topics) {
        items.push({
          key: `topic-${t.work}-${t.id}`,
          group: "Topics",
          label: t.title,
          sub: `${t.work === "naves" ? "Nave's" : "Torrey's"} · ${t.refs.toLocaleString()} ${
            t.refs === 1 ? "reference" : "references"}`,
          run: () => {
            const href = `/topics/${t.work}/${t.id}`;
            pushRecent({ kind: "topic", label: t.title, href });
            emit("berean:open-topicguide", { work: t.work, id: t.id, title: t.title });
            closePalette();
          },
        });
      }
      items.push({
        key: "search-all",
        group: "Text hits",
        label: `Search the canon for “${parsed.q}”`,
        sub: `${results.total.toLocaleString()} ${results.total === 1 ? "verse" : "verses"}${
          results.total > results.hits.length ? " · first hits below" : ""
        }`,
        run: () => runSearch(parsed.q),
      });
      for (const h of results.hits) {
        const label = `${h.bookName} ${h.chapter}:${h.verse}`;
        items.push({
          key: `hit-${h.book}-${h.chapter}-${h.verse}`,
          group: "Text hits",
          label,
          refStyle: true,
          sub: h.text,
          scripture: true,
          run: () => openRef({ book: h.book, chapter: h.chapter, verse: h.verse }, label),
        });
      }
    }
  }

  function commandMeta(id: string): string | undefined {
    if (id === "daily") return dailyRef(new Date()).label;
    return undefined;
  }

  const emptyResult =
    parsed.kind === "search" &&
    parsed.q.length >= 2 &&
    results !== null &&
    results.total === 0 &&
    results.entities.length === 0 &&
    results.topics.length === 0 &&
    !items.some((i) => i.group === "Commands");

  const GROUP_ORDER: GroupName[] = q
    ? ["References", "Commands", "Layouts", "People and places", "Topics", "Text hits"]
    : ["Recent", "Commands", "Layouts"];
  const groups = GROUP_ORDER.map((name) => ({
    name,
    rows: items.filter((i) => i.group === name),
  })).filter((g) => g.rows.length > 0);

  const contextHint =
    parsed.kind === "ref"
      ? `Open ${parsed.label}`
      : parsed.kind === "strongs"
        ? "Open the lexicon"
        : parsed.q.length >= 2
          ? "Search the canon"
          : "";

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (items.length === 0 ? -1 : (a + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (items.length === 0 ? -1 : a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = active >= 0 ? items[active] : undefined;
      if (item) item.run();
      else submitParsed(parsed);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  }

  function submitParsed(p: ParsedInput) {
    if (p.kind === "ref") {
      openRef({ book: p.book, chapter: p.chapter, verse: p.verse, verseEnd: p.verseEnd }, p.label);
    } else if (p.kind === "strongs") {
      openStrongs(p.id);
    } else if (p.q) {
      runSearch(p.q);
    }
  }

  if (!open) return null;

  let flat = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command omnibox"
        className="w-full max-w-xl rounded-[4px] border border-rule bg-surface shadow-lg"
      >
        <div className="flex items-center gap-3 border-b border-rule px-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Reference, Strong's number, or search text"
            aria-label="Command omnibox"
            autoFocus
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted"
          />
          <span className="shrink-0 text-xs text-muted">{searching ? "Searching…" : contextHint}</span>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-2 py-2" role="listbox" aria-label="Results">
          {emptyResult ? (
            <div className="px-4 py-10 text-center">
              <p className="font-editorial text-lg">Nothing answers to “{parsed.q}”.</p>
              <p className="mt-2 text-sm text-muted">
                Try a reference such as jn 3:16, a Strong's number such as G25, or another word.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.name} aria-label={g.name}>
                <p className="small-caps px-3 pb-1 pt-3 text-xs text-muted">{g.name}</p>
                {g.rows.map((item) => {
                  flat += 1;
                  const index = flat;
                  const isActive = index === active;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      role="option"
                      aria-selected={isActive}
                      ref={isActive ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                      onMouseEnter={() => setActive(index)}
                      onClick={item.run}
                      className={`flex w-full items-baseline gap-3 rounded-[3px] px-3 py-2 text-left text-sm ${
                        isActive ? "bg-amber/15" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate ${
                            item.refStyle ? "small-caps font-medium text-sapphire" : "font-medium text-ink"
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.sub ? (
                          <span
                            className={`mt-0.5 block ${
                              item.scripture
                                ? "line-clamp-2 font-reader text-[13px] leading-snug"
                                : "truncate text-xs text-muted"
                            }`}
                          >
                            {item.sub}
                          </span>
                        ) : null}
                      </span>
                      {item.meta ? <span className="shrink-0 text-xs text-muted">{item.meta}</span> : null}
                    </button>
                  );
                })}
              </section>
            ))
          )}
          {!emptyResult && groups.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {searching ? "Searching the canon…" : "Type a reference, a Strong's number, or a word."}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-rule px-4 py-2 text-[11px] text-muted">
          <span>
            <kbd className="rounded-[3px] border border-rule bg-paper px-1.5 py-px">↑</kbd>{" "}
            <kbd className="rounded-[3px] border border-rule bg-paper px-1.5 py-px">↓</kbd> move
          </span>
          <span>
            <kbd className="rounded-[3px] border border-rule bg-paper px-1.5 py-px">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded-[3px] border border-rule bg-paper px-1.5 py-px">esc</kbd> close
          </span>
          <span className="ml-auto hidden sm:inline">berean:open-ref · berean:open-lexicon · berean:search</span>
        </div>
      </div>
    </div>
  );
}
