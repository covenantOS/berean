"use client";

/**
 * Word Find puzzles, hand-rolled over a word list's glosses and
 * transliterations. Words are placed on a square grid in any of the eight
 * directions, crossing where letters agree; the empty cells fill with
 * noise. No dependency, no two puzzles alike — the list stays the source,
 * and a puzzle is regenerated, never stored.
 */

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  /** Direction as a row/column step, one of the eight compass points. */
  dr: number;
  dc: number;
}

export interface WordFind {
  size: number;
  /** The grid, one string of letters per row. */
  grid: string[];
  placed: PlacedWord[];
  /** Words that found no seat on the grid and were left out. */
  omitted: string[];
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

const MAX_WORDS = 16;
const MAX_SIZE = 18;

/**
 * Normalizes loose entries (glosses like "to love", transliterations like
 * "agapē") into grid words: diacritics stripped, uppercased, A–Z only, at
 * least three letters, each word once.
 */
export function puzzleWords(entries: string[]): string[] {
  const out: string[] = [];
  for (const entry of entries) {
    const plain = entry.normalize("NFD").replace(/\p{M}/gu, "");
    for (const part of plain.toUpperCase().split(/[^A-Z]+/)) {
      if (part.length >= 3 && !out.includes(part)) out.push(part);
    }
  }
  return out.slice(0, MAX_WORDS);
}

/**
 * Builds a puzzle from normalized words, longest first so the hard seats
 * are taken early. Returns null when fewer than two words qualify.
 */
export function buildWordFind(words: string[], rand: () => number = Math.random): WordFind | null {
  if (words.length < 2) return null;
  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.min(MAX_SIZE, Math.max(12, longest + 2));
  const cells: (string | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null)
  );
  const placed: PlacedWord[] = [];
  const omitted: string[] = [];

  const fits = (word: string, row: number, col: number, dr: number, dc: number): boolean => {
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      const cell = cells[r][c];
      if (cell !== null && cell !== word[i]) return false;
    }
    return true;
  };

  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    let seated = false;
    for (let attempt = 0; attempt < 200 && !seated; attempt++) {
      const [dr, dc] = DIRECTIONS[Math.floor(rand() * DIRECTIONS.length)];
      const row = Math.floor(rand() * size);
      const col = Math.floor(rand() * size);
      if (!fits(word, row, col, dr, dc)) continue;
      for (let i = 0; i < word.length; i++) cells[row + dr * i][col + dc * i] = word[i];
      placed.push({ word, row, col, dr, dc });
      seated = true;
    }
    if (!seated) omitted.push(word);
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const grid = cells.map((r) =>
    r.map((cell) => cell ?? alphabet[Math.floor(rand() * alphabet.length)]).join("")
  );
  return { size, grid, placed, omitted };
}
