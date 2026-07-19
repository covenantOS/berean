import { permanentRedirect } from "next/navigation";

/**
 * /read retired into the workspace: the canon tree in the workspace launcher
 * covers picking a book. /read/[book]/[chapter] stays the citation scheme.
 */
export default function ReadRedirect() {
  permanentRedirect("/workspace");
}
