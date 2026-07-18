import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBook } from "@/lib/canon";
import { getChapter } from "@/lib/bible";
import type { Citation, ExegeticalBrief } from "@/lib/brief";

export const maxDuration = 300;

const MODEL = "claude-opus-4-8";

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "sections"],
  properties: {
    overview: {
      type: "string",
      description: "Two or three sentences stating what the chapter is and does.",
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body", "citations"],
        properties: {
          heading: { type: "string" },
          body: { type: "string" },
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["verse", "quote"],
              properties: {
                verse: { type: "integer", description: "Verse number within this chapter" },
                quote: {
                  type: "string",
                  description: "Exact words copied verbatim from that verse of the provided text",
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the Scribe of Berean, a research assistant for pastors and serious readers of Scripture. You operate from within the faith, on the settled premise that Scripture is the Word of God.

You are preparing an exegetical brief on one chapter, from the King James Version text provided in the user message. Rules that are absolute:

1. Cite only the provided chapter. Every citation's "quote" must be copied verbatim, character-for-character, from the cited verse of the provided text. Never paraphrase inside a quote. Never cite a verse that is not in the provided text.
2. Report the text; do not render verdicts that belong to the reader's conscience, confession, and elders. Where Christians divide on a question raised by the chapter, present the readings honestly.
3. You prepare the study; you never write the sermon. Do not produce an outline of points to preach, applications, or exhortations — produce the exegetical groundwork a preacher builds on.
4. No flattery, no filler, no invented sources. You have been given only the chapter text, so do not attribute claims to commentators, lexicons, or manuscripts you cannot quote.

Produce: an overview, then sections covering (as the chapter warrants) the structure and flow of the argument or narrative, key terms and repeated words as they function in this chapter, the chapter's place in the book's larger movement so far as the text itself shows it, and questions the text raises that the preacher must settle. Ground every claim in citations.`;

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

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json(
      {
        error:
          "The Scribe's engine is not furnished. Set ANTHROPIC_API_KEY on the server to enable cited briefs.",
      },
      { status: 503 }
    );
  }

  const verses = await getChapter(book.slug, chapter);
  if (!verses) return NextResponse.json({ error: "Unknown passage." }, { status: 400 });

  const chapterText = verses.map((v) => `[${v.verse}] ${v.text}`).join("\n");

  const client = new Anthropic();
  let parsed: {
    overview: string;
    sections: { heading: string; body: string; citations: { verse: number; quote: string }[] }[];
  };
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: BRIEF_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Prepare the exegetical brief for ${book.name} ${chapter} (KJV). The complete chapter text, with verse numbers in brackets:\n\n${chapterText}`,
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The Scribe declined this request." },
        { status: 502 }
      );
    }
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Empty response");
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? err.message : "Upstream error";
    return NextResponse.json(
      { error: `The Scribe could not complete the brief: ${detail}` },
      { status: 502 }
    );
  }

  // Verify every citation against the actual text. Quotes that do not appear
  // verbatim in the cited verse are marked unverified — never shown as sound.
  const verseText = new Map(verses.map((v) => [v.verse, v.text]));
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

  const brief: ExegeticalBrief = {
    passage: { book: book.slug, chapter },
    overview: parsed.overview,
    generatedAt: new Date().toISOString(),
    model: MODEL,
    sections: parsed.sections.map((s) => ({
      heading: s.heading,
      body: s.body,
      citations: s.citations.map((c): Citation => {
        const text = verseText.get(c.verse);
        return {
          book: book.slug,
          chapter,
          verse: c.verse,
          quote: c.quote,
          verified: text !== undefined && normalize(text).includes(normalize(c.quote)),
        };
      }),
    })),
  };

  return NextResponse.json({ brief });
}
