import { notFound, permanentRedirect } from "next/navigation";
import { getLexiconEntry } from "@/lib/lexicon";

/**
 * /lexicon/[id] retired into the workspace: the entry renders in the
 * workspace's lexicon tab. The id still resolves and normalizes exactly as
 * the old page did — padded (G0025) and extended (H7225G) forms land on the
 * base entry, unknown ids 404 — then the workspace opens that entry.
 */
export default async function LexiconRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hit = await getLexiconEntry(id);
  if (!hit) notFound();
  permanentRedirect(`/workspace?tab=lexicon:${hit.id}`);
}
