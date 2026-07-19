import { notFound, permanentRedirect } from "next/navigation";
import { getEntity } from "@/lib/entities";

/**
 * /library/entity/[id] retired into the workspace: the entity renders in the
 * workspace's factbook tab. The URL keeps resolving exactly as the old page
 * did — unknown ids 404 — then the workspace opens that entity.
 */
export default async function EntityRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entity = await getEntity(id);
  if (!entity) notFound();
  permanentRedirect(`/workspace?tab=factbook:${entity.id}`);
}
