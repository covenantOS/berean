import { permanentRedirect } from "next/navigation";

/**
 * /memory retired into the workspace: the trainer renders in the
 * workspace's memory tab. A drill the old page would have opened rides
 * along as the tab's payload; a malformed one drops and the list still
 * opens, because the old page ignored a bad drill id too.
 */
export default async function MemoryRedirect({
  searchParams,
}: {
  searchParams: Promise<{ drill?: string }>;
}) {
  const { drill } = await searchParams;
  const id = drill?.trim() ?? "";
  const focus = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? `:${id}`
    : "";
  permanentRedirect(`/workspace?tab=memory${focus}`);
}
