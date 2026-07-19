import { permanentRedirect } from "next/navigation";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /desk/[id]/preach retired into the workspace: Preaching Mode is the
 * manuscript pane's overlay now, launched from the editor header. The
 * overlay carries no URL state of its own, so the link lands on the
 * manuscript itself; one click on Preach rises the pulpit view.
 */
export default async function PreachRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!ID_PATTERN.test(id.trim())) permanentRedirect("/workspace?tab=desk");
  permanentRedirect(`/workspace?tab=manuscript:${id.trim()}`);
}
