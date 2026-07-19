import { permanentRedirect } from "next/navigation";

/**
 * /lexicon retired into the workspace: whole-dictionary search and entries
 * live in the workspace's lexicon tab.
 */
export default function LexiconIndexRedirect() {
  permanentRedirect("/workspace?tab=lexicon");
}
