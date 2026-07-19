"use client";

import { guides } from "@/lib/guides";
import { useRecord } from "@/lib/hooks";
import PassageGuide from "./PassageGuide";

/**
 * A custom guide run on its pinned chapter: the Passage Guide's report with
 * the sections filtered and ordered to the guide's composition. The pane
 * reads the collection live, so an edit or a rename in the Guide Editor
 * applies here without reopening; a deleted guide degrades the way a
 * deleted list document does, with the missing notice.
 */
export default function CustomGuidePane({
  guideId,
  book,
  chapter,
}: {
  guideId: string;
  book: string;
  chapter: number;
}) {
  const guide = useRecord(guides, guideId);

  if (!guide) {
    return <p className="text-xs text-muted">This guide is no longer on this device.</p>;
  }

  return <PassageGuide book={book} chapter={chapter} sections={guide.sections} guideName={guide.name} />;
}
