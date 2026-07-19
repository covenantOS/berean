import { permanentRedirect } from "next/navigation";

/**
 * /topics retired into the workspace: both topical works browse together in
 * the workspace's topics tab.
 */
export default function TopicsRedirect() {
  permanentRedirect("/workspace?tab=topics");
}
