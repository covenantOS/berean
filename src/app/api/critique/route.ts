import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkManuscriptQuotes, findRefs } from "@/lib/refs";
import { getChapter } from "@/lib/bible";

export const maxDuration = 300;

const MODEL = "claude-opus-4-8";

const CRITIQUE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["counsel"],
  properties: {
    counsel: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["point", "ground"],
        properties: {
          point: { type: "string", description: "One piece of honest editorial counsel" },
          ground: {
            type: "string",
            description:
              "What it stands on: the cited passage text provided, or the manuscript's own words",
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the Scribe of Berean serving as amanuensis and honest critic at the Writing Desk. You read a draft the way a sharp friend reads it — with the text open and no interest in flattery.

Absolute rules:
1. You have been given the manuscript and the actual KJV text of every passage it cites. Ground every criticism in one or the other; quote nothing else and attribute nothing to sources you were not given.
2. Test the argument against the grammar and sense of the cited passages. If the manuscript's claim runs against its own cited text, say so and show where.
3. Note contradictions within the manuscript itself.
4. Do not rewrite the work, supply substitute prose, or render verdicts on disputed doctrine — counsel, plainly stated, at most eight points. The words on the page remain the writer's own.`;

export async function POST(req: NextRequest) {
  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const text = (body.body ?? "").slice(0, 120_000);
  if (text.trim().length < 40) {
    return NextResponse.json({ error: "Give the Scribe more than a fragment to read." }, { status: 400 });
  }

  // Deterministic first: every quotation near a reference is checked verbatim
  // against the actual verse text. This runs with or without an AI engine.
  const quoteChecks = await checkManuscriptQuotes(text);

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({
      quoteChecks,
      note: "Quotations were checked against the text mechanically. The Scribe's editorial reading requires ANTHROPIC_API_KEY on the server.",
    });
  }

  // Gather the actual text of every cited passage for the critic to read.
  const refs = findRefs(text).slice(0, 30);
  const passages: string[] = [];
  const seen = new Set<string>();
  for (const r of refs) {
    const key = `${r.book.slug}-${r.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const verses = await getChapter(r.book.slug, r.chapter);
    if (!verses) continue;
    const from = r.from ?? 1;
    const to = r.to ?? (r.from ? r.from : verses[verses.length - 1].verse);
    const range = verses.filter((v) => v.verse >= Math.max(1, from - 2) && v.verse <= to + 2);
    passages.push(
      `${r.book.name} ${r.chapter} (KJV, with context):\n` +
        range.map((v) => `[${v.verse}] ${v.text}`).join("\n")
    );
  }

  const client = new Anthropic();
  let counsel: { point: string; ground: string }[];
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: CRITIQUE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `The manuscript:\n\n${text}\n\n---\n\nThe actual text of the passages it cites:\n\n${
            passages.length > 0 ? passages.join("\n\n") : "(No recognizable Scripture references found.)"
          }`,
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "The Scribe declined this request." }, { status: 502 });
    }
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Empty response");
    counsel = (JSON.parse(textBlock.text) as { counsel: typeof counsel }).counsel.slice(0, 8);
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? err.message : "Upstream error";
    return NextResponse.json(
      {
        quoteChecks,
        error: `Quotations were checked, but the editorial reading failed: ${detail}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ quoteChecks, counsel, engine: MODEL });
}
