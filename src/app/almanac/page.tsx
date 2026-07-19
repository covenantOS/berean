import { permanentRedirect } from "next/navigation";

/**
 * /almanac retired into the workspace: the preaching calendar renders in
 * the workspace's almanac tab.
 */
export default function AlmanacRedirect() {
  permanentRedirect("/workspace?tab=almanac");
}
