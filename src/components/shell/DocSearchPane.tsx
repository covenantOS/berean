"use client";

import { useMemo } from "react";
import { getBook } from "@/lib/canon";
import { documents, listDocuments, listKindLabel } from "@/lib/documents";
import { resultCount, searchDocs, type HighlightRow } from "@/lib/docsearch";
import {
  highlights as highlightCollection,
  highlightStyles,
  listStyles,
  resolveStyle,
} from "@/lib/highlights";
import { useCollection } from "@/lib/hooks";
import {
  isAnchored,
  notes as marginNotes,
  type AnchoredNote,
} from "@/lib/marginalia";
import { personalbooks } from "@/lib/personalbooks";
import { prayerLists } from "@/lib/prayers";
import { printbooks } from "@/lib/printbooks";
import PrintButton from "./PrintButton";
import { useWorkspace } from "./WorkspaceContext";

/**
 * The Docs Search pane: the concordance turned on the user's own writing.
 * Where the Search pane fetches verses from the server, this one reads the
 * device-local collections live (src/lib/docsearch.ts does the matching),
 * so a note written while the pane stands open answers on its own. Each hit
 * opens its target: a note carries the workspace to its verse, a highlight
 * to its passage, a manuscript to its own tab, a list to its pane tab, a
 * personal book to its reader, a prayer to the prayers pane. A print book
 * hit names the work and where the paper copy sits; there is no digital
 * target to open. The header handoff runs the same query against the canon.
 */
export default function DocSearchPane({ q }: { q: string }) {
  const { dispatch } = useWorkspace();
  const notes = useCollection(marginNotes);
  const marks = useCollection(highlightCollection);
  const customStyles = useCollection(highlightStyles);
  const docs = useCollection(documents);
  const lists = useCollection(listDocuments);
  const books = useCollection(personalbooks);
  const printShelf = useCollection(printbooks);
  const prayers = useCollection(prayerLists);

  /* A highlight answers by its verse's reference and its style's name. */
  const highlightRows = useMemo(() => {
    const styles = listStyles(customStyles);
    const rows: HighlightRow[] = [];
    for (const h of marks) {
      const style = resolveStyle(h, styles);
      if (!style) continue;
      rows.push({
        highlight: h,
        reference: `${getBook(h.book)?.name ?? h.book} ${h.chapter}:${h.verse}`,
        style: style.name,
      });
    }
    return rows;
  }, [marks, customStyles]);

  const results = useMemo(
    () =>
      searchDocs(q, {
        notes,
        highlights: highlightRows,
        documents: docs,
        lists,
        personalBooks: books,
        printBooks: printShelf,
        prayers,
      }),
    [q, notes, highlightRows, docs, lists, books, printShelf, prayers]
  );
  const total = resultCount(results);
  const empty =
    notes.length +
      marks.length +
      docs.length +
      lists.length +
      books.length +
      printShelf.length +
      prayers.length ===
    0;

  /* A note opens its anchor passage and selects the verse, so the context
   * strip rises with the note, the same ride the Documents rail gives. */
  const openNote = (n: AnchoredNote) => {
    dispatch({ type: "openRef", book: n.book, chapter: n.chapter });
    dispatch({ type: "selectVerse", book: n.book, chapter: n.chapter, verse: n.verse });
  };

  /* A highlighted verse takes the same ride a note's anchor does. */
  const openHighlight = (h: HighlightRow["highlight"]) => {
    dispatch({ type: "openRef", book: h.book, chapter: h.chapter });
    dispatch({ type: "selectVerse", book: h.book, chapter: h.chapter, verse: h.verse });
  };

  return (
    <div className="reader-surface flex h-full min-h-0 flex-col" data-print-root>
      <header className="flex h-9 shrink-0 items-center border-b border-rule px-4">
        <h2 className="font-editorial text-[0.95rem] font-semibold tracking-wide">
          “{q}”
          <span className="small-caps ml-2 text-[0.6rem] font-normal text-muted">
            Your documents
          </span>
        </h2>
        <button
          type="button"
          title="Search the canon for the same words"
          onClick={() => dispatch({ type: "openSearch", q })}
          className="no-print ml-auto text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Search the Bible
        </button>
        <PrintButton className="ml-3" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <p className="mx-auto max-w-prose px-6 py-8 text-center text-xs text-muted">
            Nothing of yours is gathered yet. Notes on verses, highlighted verses, manuscripts
            from the Writing Desk, saved lists, personal books, print books, and prayer requests
            all answer here once they exist.
          </p>
        ) : total === 0 ? (
          <p className="mx-auto max-w-prose px-6 py-8 text-center text-xs text-muted">
            Nothing of yours answers to “{q}”.
          </p>
        ) : (
          <div className="mx-auto max-w-prose px-6 py-4">
            <p className="mb-3 text-xs text-muted">
              {total.toLocaleString()} {total === 1 ? "record answers" : "records answer"} across
              your notes, highlights, manuscripts, lists, personal books, print books, and
              prayers.
            </p>
            {results.notes.length > 0 && (
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Notes · {results.notes.length}
                </p>
                <ul>
                  {results.notes.map((h) => {
                    /* An unanchored hit is a journal entry; it opens the
                     * journal, the anchored kind opens its passage. */
                    const n = h.note;
                    if (!isAnchored(n)) {
                      return (
                        <li key={n.id} className="border-b border-rule/60">
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "openJournal" })}
                            title="Open this entry in the journal"
                            className="block w-full py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                          >
                            <span className="small-caps text-sm font-medium text-sapphire">
                              Journal
                              {n.date ? (
                                <span className="ml-2 text-[0.62rem] font-normal text-muted">
                                  {new Date(`${n.date}T00:00:00`).toLocaleDateString()}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                              {h.snippet}
                            </span>
                          </button>
                        </li>
                      );
                    }
                    const reference = `${getBook(n.book)?.name ?? n.book} ${n.chapter}:${n.verse}`;
                    return (
                      <li key={n.id} className="border-b border-rule/60">
                        <button
                          type="button"
                          onClick={() => openNote(n)}
                          title={`Open ${reference}`}
                          className="block w-full py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                        >
                          <span className="small-caps text-sm font-medium text-sapphire">
                            {reference}
                          </span>
                          <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed">
                            {h.snippet}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {results.highlights.length > 0 && (
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Highlights · {results.highlights.length}
                </p>
                <ul>
                  {results.highlights.map((h) => (
                    <li key={h.row.highlight.id} className="border-b border-rule/60">
                      <button
                        type="button"
                        onClick={() => openHighlight(h.row.highlight)}
                        title={`Open ${h.row.reference}`}
                        className="block w-full py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        <span className="small-caps text-sm font-medium text-sapphire">
                          {h.row.reference}
                          <span className="ml-2 text-[0.62rem] font-normal text-muted">
                            {h.row.style}
                          </span>
                        </span>
                        <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed">
                          {h.snippet}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.manuscripts.length > 0 && (
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Manuscripts · {results.manuscripts.length}
                </p>
                <ul>
                  {results.manuscripts.map((h) => (
                    <li key={h.doc.id} className="border-b border-rule/60">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "openManuscript",
                            docId: h.doc.id,
                            title: h.doc.title,
                          })
                        }
                        title={`Open ${h.doc.title || "Untitled"} for editing`}
                        className="block w-full py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        <span className="small-caps text-sm font-medium text-sapphire">
                          {h.doc.title || "Untitled"}
                          <span className="ml-2 text-[0.62rem] font-normal text-muted">
                            {h.doc.kind}
                          </span>
                        </span>
                        <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                          {h.snippet}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.lists.length > 0 && (
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Lists · {results.lists.length}
                </p>
                <ul>
                  {results.lists.map((h) => (
                    <li key={h.doc.id} className="border-b border-rule/60">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: "openListDoc", docId: h.doc.id, title: h.doc.title })
                        }
                        title={`Open ${h.doc.title || "Untitled list"}`}
                        className="block w-full py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        <span className="small-caps text-sm font-medium text-sapphire">
                          {h.doc.title || "Untitled list"}
                          <span className="ml-2 text-[0.62rem] font-normal text-muted">
                            {listKindLabel(h.doc.kind)} · {h.doc.items.length}
                          </span>
                        </span>
                        <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed">
                          {h.snippet}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.personalBooks.length > 0 && (
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Personal books · {results.personalBooks.length}
                </p>
                <ul>
                  {results.personalBooks.map((h) => (
                    <li key={h.book.id} className="border-b border-rule/60">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "openPersonalBook",
                            bookId: h.book.id,
                            title: h.book.title,
                          })
                        }
                        title={`Open ${h.book.title}`}
                        className="block w-full py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        <span className="small-caps text-sm font-medium text-sapphire">
                          {h.book.title}
                          {h.book.author && (
                            <span className="ml-2 text-[0.62rem] font-normal text-muted">
                              {h.book.author}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                          {h.snippet}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.printBooks.length > 0 && (
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Print books · {results.printBooks.length}
                </p>
                <ul>
                  {results.printBooks.map((h) => (
                    /* No digital target: the copy is paper, so the hit names
                     * the book and where it sits instead of opening anything. */
                    <li key={h.book.id} className="border-b border-rule/60 py-3">
                      <span className="small-caps text-sm font-medium text-sapphire">
                        {h.book.title}
                        <span className="ml-2 text-[0.62rem] font-normal text-muted">
                          {[h.book.author, h.book.location].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                        {h.snippet}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.prayers.length > 0 && (
              <section className="mb-5">
                <p className="small-caps border-b border-rule pb-1 text-xs font-semibold text-muted">
                  Prayers · {results.prayers.length}
                </p>                <ul>
                  {results.prayers.map((h) => (
                    <li key={h.request.id} className="border-b border-rule/60">
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "openPrayers" })}
                        title={`Open the ${h.list.title} list in the prayers pane`}
                        className="block w-full py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                      >
                        <span className="small-caps text-sm font-medium text-sapphire">
                          {h.request.title}
                          <span className="ml-2 text-[0.62rem] font-normal text-muted">
                            {h.list.title}
                            {h.request.answered ? " · answered" : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 block font-reader text-[0.9rem] leading-relaxed text-ink">
                          {h.snippet}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
