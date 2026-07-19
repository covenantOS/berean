import { permanentRedirect } from "next/navigation";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /study/[id] retired into the workspace: studies and sermons are one
 * project model, so a study project opens in the same project tab a sermon
 * does. Any well-formed id redirects, known or not; the old page answered
 * an unknown id with a not-found notice rather than a 404, and the pane
 * renders the same notice now. A malformed id drops to the list.
 */
export default async function ProjectRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!ID_PATTERN.test(id.trim())) permanentRedirect("/workspace?tab=pulpit");
  permanentRedirect(`/workspace?tab=project:${id.trim()}`);
}
