import { permanentRedirect } from "next/navigation";

/**
 * /desk retired into the workspace: the Writing Desk renders in the
 * workspace's desk tab.
 */
export default function DeskRedirect() {
  permanentRedirect("/workspace?tab=desk");
}
