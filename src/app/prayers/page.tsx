import { permanentRedirect } from "next/navigation";

/**
 * /prayers retired into the workspace: the lists render in the
 * workspace's prayers tab.
 */
export default function PrayersRedirect() {
  permanentRedirect("/workspace?tab=prayers");
}
