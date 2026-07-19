import { permanentRedirect } from "next/navigation";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /chapel/[id] retired into the workspace: the order of service renders in
 * the workspace's service tab. Any well-formed id redirects, known or not;
 * the old page answered an unknown id with a not-found notice rather than
 * a 404, and the pane renders the same notice now. A malformed id drops to
 * the list, the way a bad project id drops to the pulpit.
 */
export default async function ServiceRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!ID_PATTERN.test(id.trim())) permanentRedirect("/workspace?tab=chapel");
  permanentRedirect(`/workspace?tab=service:${id.trim()}`);
}
