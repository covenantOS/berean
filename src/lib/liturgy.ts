"use client";

import { collection, type Record_ } from "./store";

/**
 * The Chapel — liturgies composed from the full historic vocabulary.
 * A congregation's settled form is a template; each Lord's Day service is
 * composed from it. Psalm/hymn elements carry metadata (title, meter, tune,
 * key) only — no copyrighted hymn text ships without a rights entry.
 */

export const ELEMENT_TYPES = [
  { key: "call", label: "Call to Worship", scripture: true },
  { key: "invocation", label: "Invocation", scripture: false },
  { key: "confession", label: "Confession of Sin", scripture: true },
  { key: "assurance", label: "Assurance of Pardon", scripture: true },
  { key: "law", label: "Reading of the Law", scripture: true },
  { key: "creed", label: "Creed or Confession", scripture: false },
  { key: "psalm", label: "Psalm", scripture: true },
  { key: "hymn", label: "Hymn", scripture: false },
  { key: "reading", label: "Scripture Reading", scripture: true },
  { key: "prayer", label: "Prayer", scripture: false },
  { key: "sermon", label: "Sermon", scripture: true },
  { key: "table", label: "The Lord's Table", scripture: true },
  { key: "offering", label: "Offering", scripture: true },
  { key: "benediction", label: "Benediction", scripture: true },
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number]["key"];

export interface PassageRef {
  book: string; // canon slug
  chapter: number;
  from?: number;
  to?: number;
}

export interface LiturgyElement {
  id: string;
  type: ElementType;
  /** e.g. hymn title, creed name */
  title?: string;
  ref?: PassageRef;
  /** Meter / tune / key for sung elements (metadata only). */
  music?: string;
  /** Freely written text (a prayer, a rubric) — the minister's own words. */
  text?: string;
}

export interface Liturgy extends Record_ {
  title: string;
  /** ISO date of the service; empty for templates. */
  date?: string;
  /** The Scribe's rationale per element id, when drafted by the Scribe. */
  rationale?: Record<string, string>;
  elements: LiturgyElement[];
}

export interface LiturgyTemplate extends Record_ {
  name: string;
  elements: LiturgyElement[];
}

export const liturgies = collection<Liturgy>("berean.liturgies.v1");
export const liturgyTemplates = collection<LiturgyTemplate>("berean.liturgy-templates.v1");

export function elementLabel(type: ElementType): string {
  return ELEMENT_TYPES.find((t) => t.key === type)?.label ?? type;
}

export function newElement(type: ElementType): LiturgyElement {
  return { id: crypto.randomUUID(), type };
}

/** A plain historic starting order (editable, not prescriptive). */
export function defaultOrder(): LiturgyElement[] {
  const order: ElementType[] = [
    "call",
    "invocation",
    "psalm",
    "law",
    "confession",
    "assurance",
    "hymn",
    "reading",
    "prayer",
    "sermon",
    "psalm",
    "benediction",
  ];
  return order.map((t) => newElement(t));
}
