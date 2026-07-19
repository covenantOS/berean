import { permanentRedirect } from "next/navigation";

/**
 * /library/atlas retired into the workspace: the map renders in the
 * workspace's atlas tab. A place the old page would have focused rides along
 * as the tab's payload; a malformed one drops and the map still opens,
 * because the old page never 404'd a bad place either.
 */
export default async function AtlasRedirect({
  searchParams,
}: {
  searchParams: Promise<{ place?: string }>;
}) {
  const { place } = await searchParams;
  const id = place?.trim() ?? "";
  const focus = /^[A-Za-z0-9]{5,6}$/.test(id) ? `:${id}` : "";
  permanentRedirect(`/workspace?tab=atlas${focus}`);
}
