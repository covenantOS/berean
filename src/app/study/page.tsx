import { permanentRedirect } from "next/navigation";

/**
 * /study retired into the workspace: studies and sermons are one project
 * model (src/lib/projects.ts), and the list renders in the workspace's
 * pulpit tab.
 */
export default function StudyRedirect() {
  permanentRedirect("/workspace?tab=pulpit");
}
