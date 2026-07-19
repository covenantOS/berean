"use client";

import { documents } from "./documents";
import { scanRefs, formatScannedRef } from "./refscan";

/**
 * Sermon import: .md and .txt files become sermon-kind manuscripts with the
 * metadata detected rather than typed. A DOCX converts through Word or
 * Google Docs first, the same road the personal-books import sends its
 * files down (src/lib/personalbooks.ts). Three conventions, each surfaced
 * in the desk's import report so nothing detected stays hidden:
 *
 * Title: the first Markdown heading (# through ######). A file without one
 * takes its filename minus the extension.
 *
 * Series: a first line reading `Series: Name` fills the series field and
 * leaves the body; any other first line is the sermon's own words.
 *
 * Passage: the reference scanner (src/lib/refscan.ts) reads the body and
 * the chapter the sermon cites most often wins, a sermon keeping to its
 * appointed text. A tie goes to the chapter cited first, and the passage is
 * that chapter's first reference as written, so "John 3:16-18" fills the
 * field rather than a bare chapter. A file with no references imports with
 * no passage, and the report says so.
 */

export interface SermonDetection {
  title: string;
  /** Where the title came from: the first heading, or the filename. */
  titleFrom: "heading" | "filename";
  series?: string;
  passage?: string;
  /** The body as stored: the Series line lifted out when one was read. */
  body: string;
}

const SERIES_RE = /^Series:\s*(.+?)\s*$/i;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/m;

/** The metadata one file's body yields, before anything is stored. */
export function detectSermon(body: string, filename: string): SermonDetection {
  let text = body.replace(/\r\n/g, "\n");

  let series: string | undefined;
  const seriesLine = SERIES_RE.exec(text.split("\n", 1)[0] ?? "");
  if (seriesLine) {
    series = seriesLine[1];
    text = text.includes("\n") ? text.slice(text.indexOf("\n") + 1) : "";
  }

  const heading = HEADING_RE.exec(text);
  const fallback = filename.replace(/\.(md|markdown|txt)$/i, "").trim();
  const title = heading ? heading[1] : fallback || "Untitled manuscript";

  /* The most-cited chapter; a tie stands with the chapter cited first. */
  const refs = scanRefs(text);
  const counts = new Map<string, number>();
  for (const r of refs) {
    const key = `${r.book.slug}:${r.chapter}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [key, n] of counts) {
    if (best === undefined || n > counts.get(best)!) best = key;
  }
  const first = best ? refs.find((r) => `${r.book.slug}:${r.chapter}` === best) : undefined;

  return {
    title,
    titleFrom: heading ? "heading" : "filename",
    ...(series ? { series } : {}),
    ...(first ? { passage: formatScannedRef(first).replace("–", "-") } : {}),
    body: text,
  };
}

export interface SermonImportRow extends SermonDetection {
  /** The file the row reports on. */
  file: string;
  /** The manuscript the file became, so the report can open it. */
  docId: string;
}

/** Imports the files as sermon manuscripts; the rows are the desk's report. */
export function importSermons(files: { name: string; body: string }[]): SermonImportRow[] {
  return files.map((f) => {
    const d = detectSermon(f.body, f.name);
    const doc = documents.create({
      title: d.title,
      kind: "sermon",
      body: d.body,
      ...(d.series ? { series: d.series } : {}),
      ...(d.passage ? { passage: d.passage } : {}),
    });
    return { file: f.name, docId: doc.id, ...d };
  });
}
