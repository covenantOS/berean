import { permanentRedirect } from "next/navigation";

/**
 * /almanac/timeline retired into the workspace: the chronology renders in
 * the workspace's timeline tab. An event the old page would have focused
 * rides along as the tab's payload; a malformed one drops and the timeline
 * still opens, because the old page never 404'd a bad event either.
 */
export default async function TimelineRedirect({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const id = event?.trim().toLowerCase() ?? "";
  const focus = /^[a-z0-9-]+$/.test(id) ? `:${id}` : "";
  permanentRedirect(`/workspace?tab=timeline${focus}`);
}
