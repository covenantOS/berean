import Anthropic from "@anthropic-ai/sdk";

/**
 * The Scribe's engine: MiniMax's hosted model over its Anthropic-compatible
 * endpoint (the MiniMax-M2 line, which returns thinking blocks; every
 * consumer filters for the text block). One client factory and one model
 * name for all four routes (semantic, brief, critique, liturgy). Set
 * MINIMAX_API_KEY to furnish the engine; unset, the routes answer an honest
 * 503 and the rest of the app is unaffected. The direction is open models
 * on hosted APIs, per the project's technical plan.
 */
export const SCRIBE_MODEL = "MiniMax-M2";

/** The engine's display name for payloads and UI copy. */
export const SCRIBE_ENGINE = "MiniMax-M2";

/** A configured client, or null when the engine is not furnished. */
export function scribeClient(): Anthropic | null {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({
    apiKey,
    baseURL: process.env.MINIMAX_BASE_URL ?? "https://api.minimax.io/anthropic",
  });
}

/** The 503 body every route shares when the engine is unfurnished. */
export const ENGINE_UNFURNISHED =
  "The Scribe's engine is not furnished. Set MINIMAX_API_KEY on the server to enable it.";

/** The first text block of a message, skipping thinking blocks; null when none. */
export function textBlockOf(message: Anthropic.Message): string | null {
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : null;
}

/**
 * The engine answers prose when json_schema is unavailable (MiniMax-M2
 * honors the contract only as an instruction), so routes state the contract
 * in the prompt and parse tolerantly here: a clean parse first, then the
 * first brace span when the answer arrives with a preface or fences.
 */
export const JSON_ONLY =
  "\n\nYour entire answer is one JSON object and nothing else. No prose, no code fences, no preamble.";

export function parseJsonObject<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error("The engine answered no JSON object.");
  }
}

/**
 * The semantic search's answer, normalized. MiniMax-M2 varies its shape
 * (sometimes the object, sometimes a bare array, sometimes book/chapters
 * fields instead of a ref), so this accepts all three and yields one
 * {ref, reason} list the verifier can trust against the canon.
 */
export function parseCandidates(text: string): { ref: string; reason: string }[] {
  const value = parseJsonObject<unknown>(text);
  const list = Array.isArray(value)
    ? value
    : (value as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(list)) throw new Error("The engine's answer carried no candidates.");
  const out: { ref: string; reason: string }[] = [];
  for (const item of list) {
    const it = item as Record<string, unknown>;
    const direct =
      (typeof it.ref === "string" && it.ref.trim()) ||
      (typeof it.reference === "string" && (it.reference as string).trim()) ||
      (typeof it.passage === "string" && (it.passage as string).trim());
    const ref =
      direct ||
      [it.book, it.chapters ?? it.chapter ?? it.verses ?? it.verse]
        .filter((p) => typeof p === "string" && p)
        .join(" ");
    if (!ref) continue;
    out.push({ ref, reason: typeof it.reason === "string" ? it.reason : "" });
    if (out.length >= 30) break;
  }
  return out;
}

/**
 * A list field from an engine answer, tolerant of shape drift: the key's
 * array when the object carries it, the value itself when it IS the list,
 * or the first array-valued property the object holds (engines re-label).
 */
export function listField<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    for (const v of Object.values(obj)) if (Array.isArray(v)) return v as T[];
  }
  throw new Error(`The engine's answer carried no ${key} list.`);
}

/**
 * The critique route's counsel, normalized: engines answer the list under
 * assorted keys with items named point/type/kind and ground/text/assessment.
 */
export function parseCounsel(text: string): { point: string; ground: string }[] {
  const value = parseJsonObject<unknown>(text);
  const items = listField<Record<string, unknown>>(value, "counsel");
  const out: { point: string; ground: string }[] = [];
  for (const it of items) {
    const point =
      (typeof it.point === "string" && it.point) ||
      (typeof it.type === "string" && it.type) ||
      (typeof it.kind === "string" && it.kind) ||
      "Counsel";
    const ground =
      (typeof it.ground === "string" && it.ground) ||
      (typeof it.text === "string" && it.text) ||
      (typeof it.assessment === "string" && it.assessment) ||
      (typeof it.recommendation === "string" && it.recommendation) ||
      "";
    if (!ground && point === "Counsel") continue;
    out.push({ point, ground });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * The exegetical brief's sections, normalized: engines sometimes nest under
 * exegetical_brief, or hand a structure map keyed by verse instead of a
 * sections list; every form lands as {heading, body, citations}.
 */
export function parseBriefSections(
  value: unknown
): { heading: string; body: string; citations: { verse: number; quote: string }[] }[] {
  const obj = (value ?? {}) as Record<string, unknown>;
  const container =
    obj.exegetical_brief && typeof obj.exegetical_brief === "object"
      ? (obj.exegetical_brief as Record<string, unknown>)
      : obj;
  if (Array.isArray(container.sections)) {
    return (container.sections as Record<string, unknown>[]).map((s) => ({
      heading: String(s.heading ?? s.point ?? s.title ?? "Section"),
      body: String(s.body ?? s.explanation ?? s.text ?? ""),
      citations: Array.isArray(s.citations)
        ? (s.citations as Record<string, unknown>[]).map((c) => ({
            verse: Number(c.verse) || 0,
            quote: String(c.quote ?? ""),
          }))
        : [],
    }));
  }
  const structure = container.structure;
  if (structure && typeof structure === "object") {
    return Object.entries(structure as Record<string, Record<string, unknown>>).map(
      ([key, s]) => ({
        heading: String(s.point ?? s.heading ?? key),
        body: String(s.explanation ?? s.body ?? s.text ?? ""),
        citations: [] as { verse: number; quote: string }[],
      })
    );
  }
  return listField(value, "sections");
}

/** The brief's overview line, from whichever field the engine offered. */
export function briefOverview(value: unknown): string {
  const obj = (value ?? {}) as Record<string, unknown>;
  const container =
    obj.exegetical_brief && typeof obj.exegetical_brief === "object"
      ? (obj.exegetical_brief as Record<string, unknown>)
      : obj;
  for (const key of ["overview", "theme", "summary", "thesis"]) {
    if (typeof container[key] === "string" && container[key]) return container[key] as string;
  }
  return "";
}
