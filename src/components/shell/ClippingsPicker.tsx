"use client";

import { clipExcerpt, listDocuments, type ClipItem } from "@/lib/documents";
import { useCollection } from "@/lib/hooks";

/**
 * The chooser every clip path shares, mirroring the passage-list chooser:
 * the device's clippings documents, then the row that starts a new one
 * around the excerpt. The item arrives complete from the capture surface;
 * picking a target writes it and calls back so the host menu can close.
 */
export default function ClippingsPicker({
  item,
  newTitle,
  heading,
  onDone,
}: {
  item: Omit<ClipItem, "note">;
  /** Title for the document the "New" row starts. */
  newTitle: string;
  heading: string;
  onDone: () => void;
}) {
  const docs = useCollection(listDocuments, (d) => d.kind === "clippings");

  const pick = (docId: string | null) => {
    clipExcerpt(docId, item, newTitle);
    onDone();
  };

  return (
    <div className="mt-1 border-t border-rule pt-1">
      <p className="small-caps px-3 pb-1 text-[0.62rem] text-muted">{heading}</p>
      {docs.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => pick(doc.id)}
          className="flex w-full items-center gap-2 px-3 py-1 text-left text-[0.72rem] text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {doc.title || "Untitled clippings"}
          <span className="ml-auto pl-3 text-[0.62rem] text-muted">{doc.items.length}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => pick(null)}
        className="flex w-full items-center gap-2 px-3 py-1 text-left text-[0.72rem] text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        New clippings document
      </button>
    </div>
  );
}
