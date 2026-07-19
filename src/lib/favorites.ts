"use client";

import { collection, type Record_ } from "./store";

/**
 * Favorites: bookmarked passages, filed under optional folders and kept on
 * the device like the rest of the knowledge graph (see docs/adr/0001 §3).
 * The verse context menu captures a bookmark (pick an existing folder or
 * start a new one); the Read rail surfaces them grouped by folder, each
 * opening its passage. The nine keyboard bookmarks of the matrix row stay
 * out: number chords belong to the browser's own tab strip.
 */

export interface Favorite extends Record_ {
  book: string; // canon slug
  chapter: number;
  verse: number;
  /** Folder the bookmark files under; "" files it at the top, unfiled. */
  folder: string;
}

const favorites = collection<Favorite>("berean.favorites.v1");
export { favorites };

/** Every folder name in use, unfiled ("") excluded, alphabetized. */
export function listFolders(): string[] {
  const names = new Set(
    favorites.list().map((f) => f.folder.trim()).filter((f) => f !== "")
  );
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Files a bookmark. A verse already filed in the same folder bookmarks
 * nothing twice; the same verse in another folder gets its own row.
 */
export function addFavorite(
  book: string,
  chapter: number,
  verse: number,
  folder: string
): Favorite | undefined {
  const name = folder.trim();
  const dupe = favorites
    .list()
    .some((f) => f.book === book && f.chapter === chapter && f.verse === verse && f.folder === name);
  if (dupe) return undefined;
  return favorites.create({ book, chapter, verse, folder: name });
}

export function removeFavorite(id: string) {
  favorites.remove(id);
}

/** Renames a folder across every bookmark filed in it. */
export function renameFolder(from: string, to: string) {
  const name = to.trim();
  if (!name || name === from) return;
  for (const f of favorites.list((f) => f.folder === from)) {
    favorites.update(f.id, { folder: name });
  }
}
