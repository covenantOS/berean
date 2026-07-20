import { getEntity, type Entity } from "./entities";

/**
 * The family map: a TIPNR person's kin walked into a generational graph.
 * The root person stands at generation zero; parents walk upward, partners
 * sit beside their counterpart, and offspring walk downward, every step
 * over the dataset's own relationship lists (src/lib/entities.ts). Nothing
 * is invented: a relation without an id renders as a name only, and the
 * depth controls bound the walk, never the data.
 *
 * The data carries cycles and intermarriage (Sarah is Terah's daughter and
 * Abraham's wife; Jochebed is Levi's daughter and her nephew Amram's wife),
 * so a single visited set guards the whole build: the first claim on a
 * person wins, and every later appearance renders as a repeated stub that
 * never expands. Children are the union of a unit's members' offspring,
 * first claim winning, so a child named under both parents appears once.
 */

export interface FamilyMapNode {
  id: string | null;
  name: string;
  /** The visitation guard cut this appearance; it never expands. */
  repeated?: boolean;
}

export interface FamilyMapUnit {
  /** The blood-line member first, then the partners beside them. */
  members: FamilyMapNode[];
  /** The next generation down; empty at the depth bound. */
  children: FamilyMapUnit[];
  /** The next generation up; set only along the root's ancestor walk. */
  parents: FamilyMapUnit[];
}

export interface FamilyMapReport {
  rootId: string;
  rootName: string;
  up: number;
  down: number;
  unit: FamilyMapUnit;
}

export const FAMILY_MAP_MAX_DEPTH = 4;

/** A relation resolved to its record, or kept as a name-only node. */
async function memberNode(
  rel: { name: string; id: string | null },
  visited: Set<string>
): Promise<{ node: FamilyMapNode; record: Entity | null }> {
  if (!rel.id) return { node: { id: null, name: rel.name }, record: null };
  if (visited.has(rel.id)) {
    return { node: { id: rel.id, name: rel.name, repeated: true }, record: null };
  }
  const record = await getEntity(rel.id);
  if (!record) return { node: { id: null, name: rel.name }, record: null };
  visited.add(record.id);
  return { node: { id: record.id, name: record.name }, record };
}

/** The union of several records' offspring, first claim winning. */
function unionOffspring(records: Entity[]): { name: string; id: string | null }[] {
  const seen = new Set<string>();
  const kids: { name: string; id: string | null }[] = [];
  for (const rec of records) {
    for (const o of rec.relations.offspring) {
      const key = o.id ?? `name:${o.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      kids.push(o);
    }
  }
  return kids;
}

/** One person with their partners, then the children walking downward. */
async function descendUnit(
  person: Entity,
  depth: number,
  visited: Set<string>
): Promise<FamilyMapUnit> {
  visited.add(person.id);
  const members: FamilyMapNode[] = [{ id: person.id, name: person.name }];
  const records: Entity[] = [person];
  for (const p of person.relations.partners) {
    const { node, record } = await memberNode(p, visited);
    members.push(node);
    if (record) records.push(record);
  }
  const unit: FamilyMapUnit = { members, children: [], parents: [] };
  if (depth === 0) return unit;
  for (const kid of unionOffspring(records)) {
    if (kid.id && visited.has(kid.id)) {
      unit.children.push({
        members: [{ id: kid.id, name: kid.name, repeated: true }],
        children: [],
        parents: [],
      });
      continue;
    }
    if (!kid.id) {
      unit.children.push({ members: [{ id: null, name: kid.name }], children: [], parents: [] });
      continue;
    }
    const record = await getEntity(kid.id);
    if (!record) {
      unit.children.push({ members: [{ id: null, name: kid.name }], children: [], parents: [] });
      continue;
    }
    unit.children.push(await descendUnit(record, depth - 1, visited));
  }
  return unit;
}

/**
 * One level of ancestors for the walked line, parents partnered into units
 * when the records say they married, then the next level above them. Only
 * the line's own parents join a unit; a parent's other marriages stay in
 * the Factbook, off the map.
 */
async function ancestorUnits(
  line: Entity[],
  depth: number,
  visited: Set<string>
): Promise<FamilyMapUnit[]> {
  if (depth === 0) return [];
  const seen = new Set<string>();
  const rels: { name: string; id: string | null }[] = [];
  for (const person of line) {
    for (const p of person.relations.parents) {
      const key = p.id ?? `name:${p.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rels.push(p);
    }
  }
  const units: FamilyMapUnit[] = [];
  const grouped = new Set<string>();
  for (const rel of rels) {
    if (rel.id && grouped.has(rel.id)) continue;
    if (!rel.id) {
      units.push({ members: [{ id: null, name: rel.name }], children: [], parents: [] });
      continue;
    }
    if (visited.has(rel.id)) {
      grouped.add(rel.id);
      units.push({
        members: [{ id: rel.id, name: rel.name, repeated: true }],
        children: [],
        parents: [],
      });
      continue;
    }
    const record = await getEntity(rel.id);
    if (!record) {
      units.push({ members: [{ id: null, name: rel.name }], children: [], parents: [] });
      continue;
    }
    visited.add(record.id);
    grouped.add(record.id);
    const members: FamilyMapNode[] = [{ id: record.id, name: record.name }];
    const records: Entity[] = [record];
    // A partner who is also a parent of the line joins this unit; the
    // partnership reads either record, the data not always naming it both
    // ways.
    for (const other of rels) {
      if (!other.id || grouped.has(other.id)) continue;
      let partnered = record.relations.partners.some((pt) => pt.id === other.id);
      let orec: Entity | null = null;
      if (partnered) {
        orec = await getEntity(other.id);
      } else {
        const candidate = await getEntity(other.id);
        if (candidate && candidate.relations.partners.some((pt) => pt.id === record.id)) {
          partnered = true;
          orec = candidate;
        }
      }
      if (!partnered) continue;
      grouped.add(other.id);
      if (!orec) {
        members.push({ id: null, name: other.name });
        continue;
      }
      if (visited.has(orec.id)) {
        members.push({ id: orec.id, name: orec.name, repeated: true });
        continue;
      }
      visited.add(orec.id);
      members.push({ id: orec.id, name: orec.name });
      records.push(orec);
    }
    const unit: FamilyMapUnit = { members, children: [], parents: [] };
    unit.parents = await ancestorUnits(records, depth - 1, visited);
    units.push(unit);
  }
  return units;
}

/** The whole map: the root's descendants below, the ancestors above. */
export async function buildFamilyMap(
  rootId: string,
  up: number,
  down: number
): Promise<FamilyMapReport | null> {
  const root = await getEntity(rootId);
  if (!root) return null;
  const boundedUp = Math.min(Math.max(0, Math.floor(up)), FAMILY_MAP_MAX_DEPTH);
  const boundedDown = Math.min(Math.max(0, Math.floor(down)), FAMILY_MAP_MAX_DEPTH);
  const visited = new Set<string>();
  const unit = await descendUnit(root, boundedDown, visited);
  unit.parents = await ancestorUnits([root], boundedUp, visited);
  return { rootId: root.id, rootName: root.name, up: boundedUp, down: boundedDown, unit };
}
