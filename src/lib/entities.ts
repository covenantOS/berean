import { promises as fs } from "fs";
import path from "path";
import { Book, getBook } from "./canon";
import { getRights } from "./rights";

/**
 * The people/places knowledge layer, built from STEPBible's TIPNR dataset
 * (CC BY 4.0) by scripts/build-entities.mjs. The index loads once; full
 * records lazy-load per letter shard; the reader's verse mentions lazy-load
 * per book, the same shape as the cross-reference engine.
 */

export type EntityKind = "person" | "place" | "other";

export interface EntityIndexEntry {
  id: string;
  name: string;
  kind: EntityKind;
  type: string;
  /** Disambiguating first-reference tag, e.g. "Gen.11.26-1Pe". */
  tag: string;
  brief: string;
  aliases: string[];
  refs: number;
}

export interface EntityRelation {
  name: string;
  id: string | null;
}

export interface EntityRef {
  slug: string;
  chapter: number;
  verse: number;
}

export interface Entity {
  id: string;
  name: string;
  kind: EntityKind;
  type: string;
  tag: string;
  brief: string;
  aliases: string[];
  description: string;
  short: string;
  article: string;
  relations: {
    parents: EntityRelation[];
    siblings: EntityRelation[];
    partners: EntityRelation[];
    offspring: EntityRelation[];
  };
  tribe: string;
  area: string;
  geo: { lat: number; lng: number } | null;
  refs: EntityRef[];
}

/** The mention the reader apparatus needs, nothing more. */
export interface EntityMention {
  id: string;
  name: string;
  kind: EntityKind;
  type: string;
  brief: string;
}

interface EntityIndex {
  generated: string;
  entities: EntityIndexEntry[];
}

let indexPromise: Promise<EntityIndex | null> | null = null;

function indexAvailable(): boolean {
  return getRights("tipnr")?.status === "shipped";
}

async function loadIndex(): Promise<EntityIndex | null> {
  if (!indexAvailable()) return null;
  if (!indexPromise) {
    indexPromise = fs
      .readFile(path.join(process.cwd(), "data", "entities", "index.json"), "utf8")
      .then((raw) => JSON.parse(raw) as EntityIndex)
      .catch(() => null);
  }
  return indexPromise;
}

/** Every entity, in index (alphabetical) order; null when not furnished. */
export async function listEntities(): Promise<EntityIndexEntry[] | null> {
  const index = await loadIndex();
  return index ? index.entities : null;
}

/** Name and alias matches for the concordance's entity group. */
export async function searchEntities(
  query: string,
  limit = 8
): Promise<EntityIndexEntry[]> {
  const index = await loadIndex();
  if (!index) return [];
  const q = query.toLowerCase();
  const starts: EntityIndexEntry[] = [];
  const contains: EntityIndexEntry[] = [];
  for (const e of index.entities) {
    const names = [e.name, ...e.aliases];
    if (names.some((n) => n.toLowerCase().startsWith(q))) starts.push(e);
    else if (names.some((n) => n.toLowerCase().includes(q))) contains.push(e);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

const shardCache = new Map<string, Record<string, Entity> | null>();

/** One full entity record, from its first-letter shard. */
export async function getEntity(id: string): Promise<Entity | null> {
  const index = await loadIndex();
  if (!index) return null;
  const summary = index.entities.find((e) => e.id === id);
  if (!summary) return null;
  const first = (summary.name[0] ?? "_").toUpperCase();
  const letter = /[A-Z]/.test(first) ? first : "_";
  let shard = shardCache.get(letter);
  if (shard === undefined) {
    try {
      const file = path.join(process.cwd(), "data", "entities", "detail", `${letter}.json`);
      shard = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, Entity>;
    } catch {
      shard = null;
    }
    shardCache.set(letter, shard);
  }
  return shard?.[id] ?? null;
}

const verseCache = new Map<string, Record<string, string[]> | null>();

async function loadVerseMap(book: Book): Promise<Record<string, string[]> | null> {
  const hit = verseCache.get(book.file);
  if (hit !== undefined) return hit;
  try {
    const file = path.join(process.cwd(), "data", "entities", "verses", `${book.file}.json`);
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, string[]>;
    verseCache.set(book.file, raw);
    return raw;
  } catch {
    verseCache.set(book.file, null);
    return null;
  }
}

/** People and places mentioned in each verse of a chapter:
 * { 26: [mention, ...] }. Null when TIPNR is not furnished. */
export async function getChapterEntities(
  slug: string,
  chapter: number
): Promise<Record<number, EntityMention[]> | null> {
  const book = getBook(slug);
  const index = await loadIndex();
  if (!book || !index) return null;
  const map = await loadVerseMap(book);
  if (!map) return null;
  const byId = new Map(index.entities.map((e) => [e.id, e]));
  const prefix = `${chapter}:`;
  const out: Record<number, EntityMention[]> = {};
  for (const [key, ids] of Object.entries(map)) {
    if (!key.startsWith(prefix)) continue;
    const verse = Number(key.slice(prefix.length));
    if (!Number.isFinite(verse)) continue;
    const mentions = ids
      .map((id) => byId.get(id))
      .filter((e): e is EntityIndexEntry => !!e)
      .map((e) => ({ id: e.id, name: e.name, kind: e.kind, type: e.type, brief: e.brief }));
    if (mentions.length > 0) out[verse] = mentions;
  }
  return out;
}
