import { permanentRedirect } from "next/navigation";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /pulpit/[id] retired into the workspace: the project renders in the
 * workspace's project tab. Any well-formed id redirects, known or not;
 * the old page answered an unknown id with a not-found notice rather than
 * a 404, and the pane renders the same notice now. A malformed id drops to
 * the list, the way a bad manuscript id drops to the desk.
 */
export default async function SermonRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!ID_PATTERN.test(id.trim())) permanentRedirect("/workspace?tab=pulpit");
  permanentRedirect(`/workspace?tab=project:${id.trim()}`);
}
