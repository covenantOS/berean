import { NextResponse } from "next/server";
import { listTopics, TOPIC_WORKS } from "@/lib/topics";

/**
 * The whole topical index for the workspace's topics tab: both works, each
 * with its alphabetical topic list and reference counts. The lib caches the
 * files at module scope, so repeat asks read from memory.
 */
export async function GET() {
  const works = await Promise.all(
    TOPIC_WORKS.map(async (w) => {
      const topics = await listTopics(w.id);
      return { id: w.id, label: w.label, topics };
    })
  );
  return NextResponse.json({ works });
}
