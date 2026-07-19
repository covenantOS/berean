import { permanentRedirect } from "next/navigation";

/**
 * /chapel retired into the workspace: the orders of worship render in the
 * workspace's chapel tab.
 */
export default function ChapelRedirect() {
  permanentRedirect("/workspace?tab=chapel");
}
