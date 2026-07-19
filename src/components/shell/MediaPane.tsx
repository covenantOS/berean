"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPassageRef, parsePassageRef } from "@/lib/documents";
import { getBook } from "@/lib/canon";
import {
  cardReference,
  recordCard,
  useCardHistory,
  type CardEntry,
} from "@/lib/cardHistory";
import { canShareCard, shareCard } from "@/lib/shareCard";
import {
  verseCardSvg,
  type VerseCardSize,
  type VerseCardTheme,
} from "@/lib/verseCard";

/**
 * The Media studio: a verse card composed from any reference, styled within
 * the letterpress renderer's honest reach, previewed live, and taken away as
 * SVG: downloaded, or handed to the device's share sheet where one exists
 * (src/lib/shareCard.ts). The card travels as the SVG it is; there is no PNG
 * conversion, and a sheet that refuses SVG falls back to the download.
 * Berean's media is generated, not stocked: there is no collection to
 * browse by tag or type, so the studio says so and keeps the recent cards
 * for re-download instead (src/lib/cardHistory.ts).
 *
 * A passage pin opens the studio on that reference (the context menu's
 * "Verse card", the guide's Media section); a chapter without a verse opens
 * the chapter's verses to choose from. The text always comes from the
 * shipped KJV data, fetched, never typed from memory.
 */

interface Composed {
  book: string;
  bookName: string;
  chapter: number;
  from: number;
  to: number;
  text: string;
}

interface ChapterPick {
  book: string;
  bookName: string;
  chapter: number;
  verses: { verse: number; text: string }[];
}

type ComposeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; card: Composed };

const SIZES: { id: VerseCardSize; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "The verse sets the height" },
  { id: "square", label: "Square", hint: "1080 × 1080" },
  { id: "landscape", label: "Landscape", hint: "1600 × 900" },
  { id: "story", label: "Story", hint: "1080 × 1920" },
];

const THEMES: { id: VerseCardTheme; label: string }[] = [
  { id: "paper", label: "Paper" },
  { id: "candlelight", label: "Candlelight" },
];

/** The download's filename: "john-3-16-card.svg", the context strip's scheme. */
function cardFilename(c: { book: string; chapter: number; from: number; to: number }): string {
  return `${c.book}-${c.chapter}-${c.from}${c.to !== c.from ? `-${c.to}` : ""}-card.svg`;
}

/** The established export: the SVG as a blob, a temporary link, a click. */
function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function MediaPane({
  book,
  chapter,
  verse,
}: {
  book?: string;
  chapter?: number;
  verse?: number;
}) {
  const [refInput, setRefInput] = useState("");
  const [compose, setCompose] = useState<ComposeState>({ status: "idle" });
  /** A chapter named without a verse: its verses wait to be chosen. */
  const [picker, setPicker] = useState<ChapterPick | null>(null);
  const [size, setSize] = useState<VerseCardSize>("auto");
  const [theme, setTheme] = useState<VerseCardTheme>("paper");
  const [showRef, setShowRef] = useState(true);
  const [showTag, setShowTag] = useState(true);
  /** Set after mount: the share sheet and its file support are client facts. */
  const [shareable, setShareable] = useState(false);
  const history = useCardHistory();

  useEffect(() => {
    setShareable(canShareCard("card.svg"));
  }, []);

  /** Fetches the passage's KJV text and sets it in the composer. */
  const composeRef = useCallback(
    async (ref: { book: string; bookName: string; chapter: number; from: number; to: number }) => {
      setCompose({ status: "loading" });
      setPicker(null);
      try {
        const res = await fetch(
          `/api/passages?refs=${encodeURIComponent(`${ref.book}.${ref.chapter}.${ref.from}-${ref.to}`)}`
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          passages: { verses: { verse: number; text: string }[] }[];
        };
        const verses = data.passages[0]?.verses ?? [];
        if (verses.length === 0) {
          setCompose({ status: "error", message: "That verse is not in this text." });
          return;
        }
        setCompose({
          status: "ready",
          card: { ...ref, text: verses.map((v) => v.text).join(" ") },
        });
      } catch {
        setCompose({ status: "error", message: "The passage could not be read." });
      }
    },
    []
  );

  /** A chapter named bare: fetch its verses and offer them to choose from. */
  const openPicker = useCallback(async (slug: string, bookName: string, ch: number) => {
    setCompose({ status: "idle" });
    try {
      const res = await fetch(`/api/passage?book=${encodeURIComponent(slug)}&chapter=${ch}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { verses: { verse: number; text: string }[] };
      setPicker({ book: slug, bookName, chapter: ch, verses: data.verses });
    } catch {
      setCompose({ status: "error", message: "The chapter could not be read." });
    }
  }, []);

  /* The tab's pin composes once on arrival; a chapter pin opens its verses. */
  useEffect(() => {
    if (!book || chapter === undefined) return;
    const b = getBook(book);
    if (!b) return;
    if (verse !== undefined) {
      setRefInput(`${b.name} ${chapter}:${verse}`);
      void composeRef({ book: b.slug, bookName: b.name, chapter, from: verse, to: verse });
    } else {
      setRefInput(`${b.name} ${chapter}`);
      void openPicker(b.slug, b.name, chapter);
    }
  }, [book, chapter, verse, composeRef, openPicker]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePassageRef(refInput);
    if (!parsed) {
      setCompose({
        status: "error",
        message: "Type a reference the canon knows, like John 3:16 or Psalm 23:1-3.",
      });
      return;
    }
    setRefInput(formatPassageRef(parsed));
    if (parsed.from === undefined) {
      void openPicker(parsed.book, parsed.bookName, parsed.chapter);
      return;
    }
    void composeRef({
      book: parsed.book,
      bookName: parsed.bookName,
      chapter: parsed.chapter,
      from: parsed.from,
      to: parsed.to ?? parsed.from,
    });
  };

  const pickVerse = (v: number) => {
    if (!picker) return;
    setRefInput(`${picker.bookName} ${picker.chapter}:${v}`);
    void composeRef({
      book: picker.book,
      bookName: picker.bookName,
      chapter: picker.chapter,
      from: v,
      to: v,
    });
  };

  const ready = compose.status === "ready" ? compose.card : null;
  const reference = ready ? formatPassageRef(ready) : "";
  const svg = useMemo(
    () =>
      ready
        ? verseCardSvg(ready.text, reference, "KJV", {
            size,
            theme,
            reference: showRef,
            translation: showTag,
          })
        : null,
    [ready, reference, size, theme, showRef, showTag]
  );

  /** Downloads the composed card and remembers it in the recent list. */
  const download = () => {
    if (!ready || !svg) return;
    downloadSvg(svg, cardFilename(ready));
    recordCard({ ...ready, size, theme, reference: showRef, translation: showTag });
  };

  /** The device's share sheet takes the card as an SVG file; a sheet that
   *  refuses it falls back to the download, which always works. */
  const share = async () => {
    if (!ready || !svg) return;
    const outcome = await shareCard(svg, cardFilename(ready), reference);
    if (outcome === "shared") {
      recordCard({ ...ready, size, theme, reference: showRef, translation: showTag });
    } else if (outcome === "failed") {
      download();
    }
  };

  /** A history row back in the composer, text and style, without a refetch. */
  const restore = (e: CardEntry) => {
    setRefInput(cardReference(e));
    setSize(e.size);
    setTheme(e.theme);
    setShowRef(e.reference);
    setShowTag(e.translation);
    setPicker(null);
    setCompose({
      status: "ready",
      card: {
        book: e.book,
        bookName: e.bookName,
        chapter: e.chapter,
        from: e.from,
        to: e.to,
        text: e.text,
      },
    });
  };

  /** A history row downloaded again, exactly as it was composed. */
  const redownload = (e: CardEntry) => {
    const again = verseCardSvg(e.text, cardReference(e), "KJV", {
      size: e.size,
      theme: e.theme,
      reference: e.reference,
      translation: e.translation,
    });
    downloadSvg(again, cardFilename(e));
  };

  const toggle = (on: boolean) =>
    `border px-2 py-0.5 text-[0.68rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
      on ? "border-sapphire text-sapphire" : "border-rule text-muted hover:text-ink"
    }`;

  return (
    <div className="mx-auto max-w-prose space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Media</p>
        <p className="mt-1 text-xs text-muted">
          Verse cards composed on this device, in the letterpress idiom. No stock collection
          ships, so there is nothing to browse by tag or type; the cards you download collect
          below for composing again.
        </p>
      </header>

      <form onSubmit={submit} className="flex items-center gap-1.5">
        <input
          type="text"
          value={refInput}
          aria-label="Passage reference"
          placeholder="John 3:16"
          onChange={(e) => setRefInput(e.target.value)}
          className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1 text-[0.8rem] text-ink placeholder:text-muted focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <button
          type="submit"
          disabled={!refInput.trim()}
          className="shrink-0 border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Compose
        </button>
      </form>

      {picker && (
        <section>
          <p className="small-caps text-[0.68rem] text-muted">
            {picker.bookName} {picker.chapter} · choose a verse
          </p>
          <p className="mt-1.5 flex flex-wrap gap-1">
            {picker.verses.map((v) => (
              <button
                key={v.verse}
                type="button"
                title={v.text}
                onClick={() => pickVerse(v.verse)}
                className="border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {v.verse}
              </button>
            ))}
          </p>
        </section>
      )}

      {compose.status === "loading" && <p className="text-xs text-muted">Reading the text…</p>}
      {compose.status === "error" && <p className="text-xs text-muted">{compose.message}</p>}

      {ready && svg && (
        <section className="space-y-3">
          <div className="space-y-1.5">
            <p className="small-caps text-[0.68rem] text-muted">Frame</p>
            <p className="flex flex-wrap items-center gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.hint}
                  aria-pressed={size === s.id}
                  onClick={() => setSize(s.id)}
                  className={toggle(size === s.id)}
                >
                  {s.label}
                </button>
              ))}
            </p>
            <p className="small-caps text-[0.68rem] text-muted">Light</p>
            <p className="flex flex-wrap items-center gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={theme === t.id}
                  onClick={() => setTheme(t.id)}
                  className={toggle(theme === t.id)}
                >
                  {t.label}
                </button>
              ))}
            </p>
            <p className="small-caps text-[0.68rem] text-muted">Furniture</p>
            <p className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={showRef}
                onClick={() => setShowRef(!showRef)}
                className={toggle(showRef)}
              >
                Reference
              </button>
              <button
                type="button"
                aria-pressed={showTag}
                onClick={() => setShowTag(!showTag)}
                className={toggle(showTag)}
              >
                Translation tag
              </button>
            </p>
          </div>

          {/* The renderer's own output, scaled to the pane by the viewBox. */}
          <div
            className="border border-rule bg-paper p-2 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          <p className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={download}
              className="border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Download SVG
            </button>
            {shareable && (
              <button
                type="button"
                title="Send this card through your device's share sheet, as an SVG file"
                onClick={() => void share()}
                className="border border-rule bg-paper px-2 py-1 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Share
              </button>
            )}
          </p>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
            Recent cards
          </p>
          <ul className="mt-2 space-y-1.5">
            {history.map((e) => (
              <li key={`${e.book}-${e.chapter}-${e.from}-${e.to}-${e.size}-${e.theme}-${e.at}`} className="flex items-baseline gap-2">
                <button
                  type="button"
                  title="Restore this card in the composer"
                  onClick={() => restore(e)}
                  className="shrink-0 text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {cardReference(e)}
                </button>
                <span className="min-w-0 flex-1 truncate text-[0.68rem] text-muted">
                  {e.size === "auto" ? "auto frame" : e.size} · {e.theme}
                  {!e.reference || !e.translation
                    ? ` · no ${[!e.reference ? "reference" : "", !e.translation ? "tag" : ""]
                        .filter(Boolean)
                        .join(" or ")}`
                    : ""}
                </span>
                <button
                  type="button"
                  title="Download this card again, exactly as composed"
                  onClick={() => redownload(e)}
                  className="shrink-0 text-[0.72rem] text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
