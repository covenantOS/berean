"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookExplorerEntry, BookGenre } from "@/lib/bookmeta";
import { useWorkspace } from "./WorkspaceContext";

type View = "order" | "author" | "genre" | "size" | "date";

const VIEWS: { id: View; label: string }[] = [
  { id: "order", label: "Canon order" },
  { id: "author", label: "Author" },
  { id: "genre", label: "Genre" },
  { id: "size", label: "Size" },
  { id: "date", label: "Date" },
];

/* The genre palette, stained glass: the four house colors and their pair
 * mixes give the nine genres nine readable hues that follow the theme. */
const GENRE_COLORS: Record<BookGenre, string> = {
  law: "var(--stained-amber)",
  history: "var(--stained-emerald)",
  wisdom: "color-mix(in srgb, var(--stained-emerald) 50%, var(--stained-amber))",
  poetry: "color-mix(in srgb, var(--stained-ruby) 55%, var(--stained-amber))",
  prophecy: "var(--stained-sapphire)",
  gospel: "var(--stained-ruby)",
  acts: "color-mix(in srgb, var(--stained-ruby) 50%, var(--stained-sapphire))",
  epistle: "color-mix(in srgb, var(--stained-sapphire) 50%, var(--stained-emerald))",
  apocalypse: "color-mix(in srgb, var(--stained-amber) 50%, var(--stained-sapphire))",
};

const GENRE_LABELS: Record<BookGenre, string> = {
  law: "Law",
  history: "History",
  wisdom: "Wisdom",
  poetry: "Poetry",
  prophecy: "Prophecy",
  gospel: "Gospel",
  acts: "Acts",
  epistle: "Epistle",
  apocalypse: "Apocalypse",
};

const GENRE_ORDER: BookGenre[] = [
  "law",
  "history",
  "wisdom",
  "poetry",
  "prophecy",
  "gospel",
  "acts",
  "epistle",
  "apocalypse",
];

function fmtYear(y: number): string {
  return y < 0 ? `${-y} BC` : `AD ${y}`;
}

/** The approximate composition range, e.g. "c. 740–680 BC" or "c. AD 56–57". */
function fmtRange(from: number, to: number): string {
  if (from === to) return `c. ${fmtYear(from)}`;
  if (from < 0 && to < 0) return `c. ${-from}–${-to} BC`;
  if (from > 0 && to > 0) return `c. AD ${from}–${to}`;
  return `c. ${fmtYear(from)} – ${fmtYear(to)}`;
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; books: BookExplorerEntry[] };

/**
 * The Bible Books Explorer: the whole canon on one grid, color-coded by
 * genre and arranged five ways. Canon order reads the books as bound;
 * Author and Genre group them; Size ranks them by word count; Date lays
 * them along their approximate composition ranges. A card expands into its
 * record and hands off to the reader and the concordance.
 */
export default function BookExplorerPane() {
  const { dispatch } = useWorkspace();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [view, setView] = useState<View>("order");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pane/books", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setLoad({ status: "missing" });
          return;
        }
        const payload = (await res.json()) as { books: BookExplorerEntry[] };
        setLoad({ status: "ready", books: payload.books });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, []);

  const groups = useMemo((): { label: string; books: BookExplorerEntry[] }[] => {
    if (load.status !== "ready") return [];
    const books = load.books;
    if (view === "order") {
      return [
        { label: "Old Testament", books: books.filter((b) => b.testament === "OT") },
        { label: "New Testament", books: books.filter((b) => b.testament === "NT") },
      ];
    }
    if (view === "author") {
      /* Groups in the order the canon first earns each author. */
      const byAuthor = new Map<string, BookExplorerEntry[]>();
      for (const b of books) {
        const rows = byAuthor.get(b.author) ?? [];
        rows.push(b);
        byAuthor.set(b.author, rows);
      }
      return [...byAuthor.entries()].map(([label, rows]) => ({ label, books: rows }));
    }
    if (view === "genre") {
      return GENRE_ORDER.map((genre) => ({
        label: GENRE_LABELS[genre],
        books: books.filter((b) => b.genre === genre),
      })).filter((g) => g.books.length > 0);
    }
    if (view === "size") {
      return [{ label: "", books: [...books].sort((a, b) => b.words - a.words) }];
    }
    return [
      {
        label: "",
        books: [...books].sort(
          (a, b) => a.writtenFrom - b.writtenFrom || a.writtenTo - b.writtenTo
        ),
      },
    ];
  }, [load, view]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Laying out the canon…</p>;
  }
  if (load.status === "missing") {
    return (
      <p className="text-xs text-muted">
        The canon explorer is not furnished in this build; it ships with the
        KJV text and the book metadata.
      </p>
    );
  }
  const totalWords = load.books.reduce((n, b) => n + b.words, 0);
  const totalVerses = load.books.reduce((n, b) => n + b.verses, 0);

  const toggle = (on: boolean) =>
    `border px-2 py-0.5 text-[0.68rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
      on ? "border-sapphire text-sapphire" : "border-rule text-muted hover:text-ink"
    }`;

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">The Canon</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">The sixty-six books</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {totalVerses.toLocaleString()} verses · {totalWords.toLocaleString()} words (KJV) ·
          authorship as traditionally received · composition dates approximate
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={toggle(view === v.id)}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {GENRE_ORDER.map((genre) => (
            <span key={genre} className="flex items-center gap-1 text-[0.62rem] text-muted">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2"
                style={{ background: GENRE_COLORS[genre] }}
              />
              {GENRE_LABELS[genre]}
            </span>
          ))}
        </p>
      </header>

      {groups.map((group) => (
        <section key={group.label || "all"}>
          {group.label && (
            <div className="small-caps pb-1 text-[0.62rem] font-semibold text-muted">
              {group.label} · {group.books.length} {group.books.length === 1 ? "book" : "books"}
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
            {group.books.map((b) => (
              <BookCard
                key={b.slug}
                book={b}
                showDate={view === "date"}
                open={openSlug === b.slug}
                onToggle={() => setOpenSlug(openSlug === b.slug ? null : b.slug)}
                onRead={() => dispatch({ type: "openRef", book: b.slug, chapter: 1 })}
                onConcordance={() => dispatch({ type: "openConcordance", book: b.slug })}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BookCard({
  book,
  showDate,
  open,
  onToggle,
  onRead,
  onConcordance,
}: {
  book: BookExplorerEntry;
  /** The date view leads with the composition range; the rest lead with size. */
  showDate: boolean;
  open: boolean;
  onToggle: () => void;
  onRead: () => void;
  onConcordance: () => void;
}) {
  return (
    <div className="border border-rule bg-surface">
      <span
        aria-hidden="true"
        className="block h-[3px]"
        style={{ background: GENRE_COLORS[book.genre] }}
      />
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        title={`${book.name}: ${GENRE_LABELS[book.genre]} · ${book.author} · ${fmtRange(book.writtenFrom, book.writtenTo)}`}
        className="block w-full px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        <span className="block text-[0.8rem] font-semibold text-ink">{book.name}</span>
        <span className="mt-0.5 block text-[0.62rem] text-muted">
          {showDate
            ? fmtRange(book.writtenFrom, book.writtenTo)
            : `${book.chapters} ch · ${book.verses.toLocaleString()} vv`}
        </span>
      </button>
      {open && (
        <div className="border-t border-rule px-2 py-1.5">
          <p className="text-[0.68rem] leading-relaxed text-ink">{book.about}</p>
          <dl className="mt-1 space-y-0.5 text-[0.62rem] text-muted">
            <div className="flex justify-between gap-2">
              <dt>Author</dt>
              <dd className="text-right text-ink">{book.author}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Written</dt>
              <dd className="text-right text-ink">{fmtRange(book.writtenFrom, book.writtenTo)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Genre</dt>
              <dd className="text-right text-ink">{GENRE_LABELS[book.genre]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Size</dt>
              <dd className="text-right text-ink">
                {book.chapters} ch · {book.verses.toLocaleString()} vv · {book.words.toLocaleString()}{" "}
                words
              </dd>
            </div>
          </dl>
          <p className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={onRead}
              className="border border-rule bg-paper px-2 py-0.5 text-[0.68rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Read
            </button>
            <button
              type="button"
              onClick={onConcordance}
              className="border border-rule bg-paper px-2 py-0.5 text-[0.68rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Concordance
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
