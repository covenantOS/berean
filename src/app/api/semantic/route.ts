import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyCandidates } from "@/lib/semantic";

export const maxDuration = 300;

const MODEL = "claude-opus-4-8";
const MAX_CANDIDATES = 30;

const SEMANTIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "reason"],
        properties: {
          ref: {
            type: "string",
            description:
              'A single Scripture reference, e.g. "Genesis 15:6" or "Romans 4:3-5". Must name a real book of the 66-book canon.',
          },
          reason: {
            type: "string",
            description: "A few words on why this passage bears on the concept. No quotation.",
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the Scribe of Berean, a research assistant for pastors and serious readers of Scripture. You operate from within the faith, on the settled premise that Scripture is the Word of God.

The reader gives you a concept. You name the passages in the 66-book Protestant canon that most bear on it, whether or not they use the reader's exact words. Rules that are absolute:

1. References only from the 66-book canon, with real chapters and verses. Never invent a book, a chapter, or a verse. If you are not sure a verse exists, leave it out.
2. No quotation. Name the passage and give a reason of a few words; the text is supplied separately.
3. Report the text's range; do not render verdicts on disputed doctrine. Where a concept divides Christians, name passages on more than one side.
4. No padding. Fewer sound references outrank many loose ones. At most ${MAX_CANDIDATES} candidates.`;

export async function POST(req: NextRequest) {
  let body: { concept?: string; scope?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const concept = (body.concept ?? "").trim().slice(0, 300);
  if (concept.length < 3) {
    return NextResponse.json({ error: "Name a concept to search by." }, { status: 400 });
  }
  const scope = body.scope === "ot" || body.scope === "nt" ? body.scope : "all";

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json(
      {
        error:
          "The Scribe's engine is not furnished. Set ANTHROPIC_API_KEY on the server to enable search by meaning.",
      },
      { status: 503 }
    );
  }

  const client = new Anthropic();
  let candidates: { ref: string; reason: string }[];
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SEMANTIC_SCHEMA } },
      messages: [
        {
          role: "user",
          content:
            `Concept: ${concept}` +
            (scope === "all"
              ? ""
              : `\nRestrict your references to the ${scope === "ot" ? "Old" : "New"} Testament.`),
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "The Scribe declined this request." }, { status: 502 });
    }
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Empty response");
    candidates = (JSON.parse(textBlock.text) as { candidates: typeof candidates }).candidates.slice(
      0,
      MAX_CANDIDATES
    );
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? err.message : "Upstream error";
    return NextResponse.json(
      { error: `The Scribe could not complete the search: ${detail}` },
      { status: 502 }
    );
  }

  // The model's suggestions are untrusted. Every reference is verified
  // against the actual canon; anything that fails is withheld and reported.
  const { hits, withheld } = await verifyCandidates(candidates, scope);

  return NextResponse.json({ concept, scope, hits, withheld, engine: MODEL });
}
