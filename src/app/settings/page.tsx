import { permanentRedirect } from "next/navigation";

/**
 * /settings retired into the workspace: the Scribe's profile and the
 * whole-graph export, import, and delete live in the workspace's settings
 * tab.
 */
export default function SettingsRedirect() {
  permanentRedirect("/workspace?tab=settings");
}
