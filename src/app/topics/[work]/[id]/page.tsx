import { notFound, permanentRedirect } from "next/navigation";
import { getTopic, isTopicWork } from "@/lib/topics";

/**
 * /topics/[work]/[id] retired into the workspace: the topic renders in the
 * workspace's topic guide tab. The URL keeps resolving exactly as the old
 * page did — unknown works and unknown topics 404 — then the workspace
 * opens that topic.
 */
export default async function TopicRedirect({
  params,
}: {
  params: Promise<{ work: string; id: string }>;
}) {
  const { work, id } = await params;
  if (!isTopicWork(work)) notFound();
  const topic = await getTopic(work, id);
  if (!topic) notFound();
  permanentRedirect(`/workspace?tab=topicguide:${work}:${topic.id}`);
}
