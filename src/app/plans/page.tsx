import { permanentRedirect } from "next/navigation";

/**
 * /plans retired into the workspace: the plans render in the
 * workspace's plans tab.
 */
export default function PlansRedirect() {
  permanentRedirect("/workspace?tab=plans");
}
