import { permanentRedirect } from "next/navigation";

/**
 * /pulpit retired into the workspace: the project list renders in the
 * workspace's pulpit tab.
 */
export default function PulpitRedirect() {
  permanentRedirect("/workspace?tab=pulpit");
}
