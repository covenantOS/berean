"use client";

import { COMMENTARY_WALL, metaFor } from "./librarymeta";
import { RIGHTS_REGISTRY, type RightsEntry } from "./rights";
import { collection, type Record_ } from "./store";

/**
 * Collections: named rule sets over the catalog, the Logos mechanic rebuilt
 * honestly over the rights registry. A rule set names values on the facets
 * the registry and the reader's librarymeta genuinely carry: kind, status,
 * license class, tag, and a minimum rating. Values within one facet disjoin
 * (any listed value admits the entry); the facets themselves conjoin (every
 * facet the rules name must admit it); a facet the rules leave out
 * constrains nothing, so an empty rule set matches the whole catalog.
 * Membership is never stored: evaluating the rules against the registry and
 * librarymeta yields the set live, so tagging a work "favorite" instantly
 * updates every collection that names the tag. One workspace-wide pointer
 * (berean.active-collection.v1) names the collection that scopes the
 * commentary wall; the sync envelope rides along from day one as
 * everywhere.
 */

export interface CollectionRules {
  kinds?: RightsEntry["kind"][];
  statuses?: RightsEntry["status"][];
  licenseClasses?: string[];
  tags?: string[];
  minRating?: number;
}

export interface NamedCollection extends Record_ {
  name: string;
  rules: CollectionRules;
}

const collections = collection<NamedCollection>("berean.collections.v1");
export { collections };

/** The license facet: the registry's license strings grouped into classes. */
export function licenseClass(license: string): string {
  if (license.startsWith("Public domain")) return "Public domain";
  if (license.startsWith("CC BY")) return "CC BY 4.0";
  return "Other";
}

/** One entry against a rule set: OR within a facet, AND across facets, and
 * a facet the rules leave out admits every entry. */
export function matchesRules(
  entry: RightsEntry,
  rules: CollectionRules,
  meta?: { tags: string[]; rating: number | null }
): boolean {
  if (rules.kinds?.length && !rules.kinds.includes(entry.kind)) return false;
  if (rules.statuses?.length && !rules.statuses.includes(entry.status)) return false;
  if (rules.licenseClasses?.length && !rules.licenseClasses.includes(licenseClass(entry.license)))
    return false;
  if (rules.tags?.length && !rules.tags.some((t) => meta?.tags.includes(t))) return false;
  if (rules.minRating && (meta?.rating ?? 0) < rules.minRating) return false;
  return true;
}

/** The set a rule set names, evaluated live against the registry and
 * librarymeta; membership is this evaluation, never a stored list. */
export function collectionMembers(rules: CollectionRules): RightsEntry[] {
  return RIGHTS_REGISTRY.filter((r) => matchesRules(r, rules, metaFor(r.id)));
}

/** The registry ids a rule set names. */
export function memberIds(rules: CollectionRules): Set<string> {
  return new Set(collectionMembers(rules).map((r) => r.id));
}

/** The commentary wall's work ids a rule set admits, mapped through the
 * wall's registry ids; null when no collection scopes the wall, which is
 * the unscoped answer. */
export function scopedWallWorkIds(rules: CollectionRules | null): Set<string> | null {
  if (!rules) return null;
  const ids = memberIds(rules);
  return new Set(COMMENTARY_WALL.filter((w) => ids.has(w.rightsId)).map((w) => w.workId));
}

/** Saves a named rule set; null when the name trims to nothing. */
export function saveCollection(
  id: string | null,
  name: string,
  rules: CollectionRules
): NamedCollection | null {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return null;
  if (id) return collections.update(id, { name: trimmed, rules }) ?? null;
  return collections.create({ name: trimmed, rules });
}

/** Removes a rule set; the workspace pointer lets it go with it. */
export function deleteCollection(id: string) {
  collections.remove(id);
  if (getActiveCollectionId() === id) setActiveCollection(null);
}

interface ActiveCollection extends Record_ {
  /** The collection scoping the commentary wall; null scopes nothing. */
  collectionId: string | null;
}

const activeCollection = collection<ActiveCollection>("berean.active-collection.v1");
export { activeCollection };

export function getActiveCollectionId(): string | null {
  return activeCollection.list()[0]?.collectionId ?? null;
}

export function setActiveCollection(collectionId: string | null) {
  const row = activeCollection.list()[0];
  if (row) activeCollection.update(row.id, { collectionId });
  else activeCollection.create({ collectionId });
}
