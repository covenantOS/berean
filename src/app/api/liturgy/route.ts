import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SCRIBE_MODEL, scribeClient, ENGINE_UNFURNISHED, JSON_ONLY, parseJsonObject, listField } from "@/lib/engine";
import { CANON, getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";

export const maxDuration = 300;

const MODEL = SCRIBE_MODEL;

const ELEMENT_KEYS = [
  "call",
  "invocation",
  "confession",
  "assurance",
  "law",
  "creed",
  "psalm",
  "hymn",
  "reading",
  "prayer",
  "sermon",
  "table",
  "offering",
  "benediction",
];

const LITURGY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["elements"],
  properties: {
    elements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "rationale"],
        properties: {
          type: { type: "string", enum: ELEMENT_KEYS },
          title: { type: "string", description: "Optional short title for the element" },
          ref: {
            type: "object",
            additionalProperties: false,
            required: ["book", "chapter"],
            properties: {
              book: { type: "string", description: "Canon slug, e.g. 'psalms', '1-peter'" },
              chapter: { type: "integer" },
              from: { type: "integer" },
              to: { type: "integer" },
            },
          },
          rationale: {
            type: "string",
            description: "One or two sentences: why this element and this passage serve this service",
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the Scribe of Berean serving as a liturgist's apprentice. Given the sermon's appointed chapter (text provided), draft a complete Lord's Day order of worship whose readings answer the sermon's theme.

Absolute rules:
1. Scripture selections use only canon slugs from this list: ${CANON.map((b) => b.slug).join(", ")}. Verse ranges must be plausible for the chapter; the application will load and verify the actual text — you never supply Scripture wording yourself.
2. Do not supply hymn texts, psalter versifications, prayers, or creed texts — name elements and passages only. Licensed texts arrive through the rights registry, not through you.
3. Every element carries a rationale: why it serves this service, stated plainly.
4. Follow the historic shape: call to worship, invocation, confession of sin, assurance of pardon, the reading of the Law where fitting, psalms, Scripture reading, prayer, sermon, benediction. The minister will review, amend, and rule on all of it.
5. The sermon element must reference the appointed chapter.`;

export async function POST(req: NextRequest) {
  let body: { book?: string; chapter?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const book = getBook(body.book ?? "");
  const chapter = Number(body.chapter);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }


  const verses = await getChapter(book.slug, chapter);
  if (!verses) return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  const chapterText = verses.map((v) => `[${v.verse}] ${v.text}`).join("\n");

  const client = scribeClient();
  if (!client) {
    return NextResponse.json({ error: ENGINE_UNFURNISHED }, { status: 503 });
  }
  let parsed: {
    elements: {
      type: string;
      title?: string;
      ref?: { book: string; chapter: number; from?: number; to?: number };
      rationale: string;
    }[];
  };
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM + JSON_ONLY + `

Answer in exactly this shape: {"elements": [{"type": string, "title": string, "ref": {"book": string, "chapter": integer, "from": integer, "to": integer}, "rationale": string}]}. No other fields.`,
      output_config: { format: { type: "json_schema", schema: LITURGY_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Draft the Lord's Day order of worship for a sermon on ${book.name} ${chapter} (KJV). The chapter text:\n\n${chapterText}`,
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "The Scribe declined this request." }, { status: 502 });
    }
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Empty response");
    parsed = parseJsonObject(textBlock.text);
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? err.message : "Upstream error";
    return NextResponse.json(
      { error: `The Scribe could not complete the draft: ${detail}` },
      { status: 502 }
    );
  }

  // Verify every proposed reference points at a real passage; drop any that do not.
  const elements = [];
  const parsedElements = listField<{
      type: string;
      title?: string;
      ref?: { book: string; chapter: number; from?: number; to?: number };
      rationale: string;
    }>(parsed, "elements");
  for (const el of parsedElements) {
    let ref = el.ref;
    if (ref) {
      const b = getBook(ref.book);
      if (!b || !Number.isInteger(ref.chapter) || ref.chapter < 1 || ref.chapter > b.chapters) {
        ref = undefined;
      } else {
        const vs = await getChapter(b.slug, ref.chapter);
        const maxVerse = vs?.[vs.length - 1]?.verse ?? 0;
        const from = ref.from && ref.from >= 1 && ref.from <= maxVerse ? ref.from : undefined;
        const to = ref.to && ref.to >= (from ?? 1) && ref.to <= maxVerse ? ref.to : from;
        ref = { book: b.slug, chapter: ref.chapter, from, to };
      }
    }
    elements.push({
      id: crypto.randomUUID(),
      type: el.type,
      title: el.title,
      ref,
      rationale: el.rationale,
    });
  }

  return NextResponse.json({ elements });
}
