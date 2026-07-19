/**
 * Word-level diff for the Text Comparison tool.
 *
 * A hand-rolled longest-common-subsequence alignment over whitespace tokens,
 * small enough to read in one sitting and fast enough for a verse (no verse
 * runs past a few dozen words). Comparison folds case and edge punctuation,
 * so "God," and "God" align while "God's" stays distinct from "God"; the
 * rendered text is always the compared translation's own words.
 *
 * The merged walk interleaves both streams: "same" words stand in the
 * translation's sentence, "added" words are the translation's own with no
 * base counterpart, and "omitted" words are the base's, shown in their base
 * position so the reader sees exactly what the translation leaves out.
 */

export type DiffMark = "same" | "added" | "omitted";

export interface DiffSegment {
  text: string;
  mark: DiffMark;
}

interface Token {
  raw: string;
  norm: string;
}

/** Splits on whitespace and normalizes for alignment, keeping the raw form. */
function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({
      raw,
      norm: raw.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
    }));
}

/** Diffs one verse of a translation against the base text, word by word. */
export function diffWords(base: string, other: string): DiffSegment[] {
  const a = tokenize(base);
  const b = tokenize(other);

  // LCS table over the normalized forms; punctuation-only tokens (an empty
  // norm) never match each other.
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] =
        a[i].norm !== "" && a[i].norm === b[j].norm
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Backtrack into the merged token walk.
  const walk: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].norm !== "" && a[i].norm === b[j].norm) {
      walk.push({ text: b[j].raw, mark: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      walk.push({ text: a[i].raw, mark: "omitted" });
      i++;
    } else {
      walk.push({ text: b[j].raw, mark: "added" });
      j++;
    }
  }
  while (i < a.length) walk.push({ text: a[i++].raw, mark: "omitted" });
  while (j < b.length) walk.push({ text: b[j++].raw, mark: "added" });

  // Adjacent tokens of one mark collapse into a single segment.
  const segments: DiffSegment[] = [];
  for (const token of walk) {
    const last = segments[segments.length - 1];
    if (last && last.mark === token.mark) last.text += ` ${token.text}`;
    else segments.push({ ...token });
  }
  return segments;
}

/** True when the alignment found nothing to mark. */
export function diffIsClean(segments: DiffSegment[]): boolean {
  return segments.every((s) => s.mark === "same");
}
