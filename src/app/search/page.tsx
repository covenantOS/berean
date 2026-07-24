import { permanentRedirect } from "next/navigation";

/**
 * /search retired into the workspace: the precise concordance, the
 * original-language morph search with its parsing filters, and search by
 * meaning all run as search tabs there. Old query strings keep their
 * meaning through the deep-link contract:
 *
 *   /search?q=grace              → /workspace?tab=search:grace
 *   /search?mode=original&q=G26  → /workspace?tab=search:original:G26
 *   /search?mode=semantic&q=love → /workspace?tab=search:semantic:love
 *
 * A bare /search lands on the workspace itself.
 */
export default async function SearchRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const mode = typeof sp.mode === "string" ? sp.mode : "";
  if (q) {
    if (mode === "original") permanentRedirect(`/workspace?tab=search:original:${encodeURIComponent(q)}`);
    if (mode === "semantic") permanentRedirect(`/workspace?tab=search:semantic:${encodeURIComponent(q)}`);
    permanentRedirect(`/workspace?tab=search:${encodeURIComponent(q)}`);
  }
  permanentRedirect("/workspace");
}
