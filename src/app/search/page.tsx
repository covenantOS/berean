import { permanentRedirect } from "next/navigation";

/**
 * /search retired into the workspace: the precise concordance, the
 * original-language morph search with its parsing filters, and search by
 * meaning all run as search tabs there. The workspace's deep links open no
 * search tab kind, so an old query string maps to nothing addressable and
 * the link lands on the workspace itself.
 */
export default function SearchRedirect() {
  permanentRedirect("/workspace");
}
