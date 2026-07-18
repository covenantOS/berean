import { findRefs } from "./refs";
import { getVerses } from "./bible";

/**
 * Verification for the semantic concordance. The Scribe's candidate
 * references are untrusted suggestions: each is parsed against the canonical
 * book names, the chapter and verse range must stand in the actual canon,
 * and the displayed text is pulled from data/kjv, never from the model.
 * Anything that fails is withheld and reported, never shown.
 */

export interface SemanticHit {
  ref: string;
  book: string;
  chapter: number;
  from: number;
  to: number;
  text: string;
  reason: string;
}

export interface SemanticWithheld {
  ref: string;
  reason: string;
}

export async function verifyCandidates(
  candidates: { ref: string; reason: string }[],
  scope: "all" | "ot" | "nt" = "all"
): Promise<{ hits: SemanticHit[]; withheld: SemanticWithheld[] }> {
  const hits: SemanticHit[] = [];
  const withheld: SemanticWithheld[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const rawRef = String(c.ref ?? "");
    const parsed = findRefs(rawRef)[0];
    if (!parsed || parsed.from === undefined) {
      withheld.push({ ref: rawRef, reason: "No such verse in the canon." });
      continue;
    }
    if (scope !== "all" && parsed.book.testament !== scope.toUpperCase()) {
      withheld.push({ ref: rawRef, reason: "Outside the requested testament." });
      continue;
    }
    const from = parsed.from;
    const to = parsed.to ?? from;
    const verses = await getVerses(parsed.book.slug, parsed.chapter, from, to);
    if (!verses || verses.length !== to - from + 1) {
      withheld.push({ ref: rawRef, reason: "No such verse in the canon." });
      continue;
    }
    const key = `${parsed.book.slug}-${parsed.chapter}-${from}-${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      ref: `${parsed.book.name} ${parsed.chapter}:${from}${to !== from ? `-${to}` : ""}`,
      book: parsed.book.slug,
      chapter: parsed.chapter,
      from,
      to,
      text: verses.map((v) => v.text).join(" "),
      reason: String(c.reason ?? "").slice(0, 200),
    });
  }

  return { hits, withheld };
}
