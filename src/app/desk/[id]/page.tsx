import { permanentRedirect } from "next/navigation";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /desk/[id] retired into the workspace: the manuscript renders in the
 * workspace's manuscript tab. Any well-formed id redirects, known or not;
 * the old page answered an unknown id with a not-found notice rather than
 * a 404, and the pane renders the same notice now. A malformed id drops to
 * the desk, the way a bad drill id drops to the memory list.
 */
export default async function ManuscriptRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!ID_PATTERN.test(id.trim())) permanentRedirect("/workspace?tab=desk");
  permanentRedirect(`/workspace?tab=manuscript:${id.trim()}`);
}
