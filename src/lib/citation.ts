"use client";

/**
 * Citation style: how a copied verse arranges its reference. Text-first is
 * the established form, the text and then its reference in parentheses;
 * citation-first leads with the reference the way a footnote does. Every
 * copy path (the verse menus, the context strip, Power Lookup) formats
 * through here so the choice holds app-wide. A device-local scalar like the
 * display prefs, written by the workspace's Settings rail.
 */

export const CITATION_STYLE_KEY = "berean.citationStyle.v1";

export type CitationStyle = "text-first" | "citation-first";

export function citationStyle(): CitationStyle {
  if (typeof window === "undefined") return "text-first";
  return window.localStorage.getItem(CITATION_STYLE_KEY) === "citation-first"
    ? "citation-first"
    : "text-first";
}

export function formatCitation(text: string, reference: string, translation?: string): string {
  if (citationStyle() === "citation-first") {
    return `${translation ? `${reference} (${translation})` : reference}: ${text}`;
  }
  return translation ? `${text} (${reference}, ${translation})` : `${text} (${reference})`;
}
