import { permanentRedirect } from "next/navigation";

/**
 * /journal retired into the workspace: the diary renders in the
 * workspace's journal tab.
 */
export default function JournalRedirect() {
  permanentRedirect("/workspace?tab=journal");
}
