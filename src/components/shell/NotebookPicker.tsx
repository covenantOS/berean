"use client";

import { useState } from "react";
import { listNotebooks } from "@/lib/marginalia";

/**
 * The notebook chooser the note editors share, mirroring the bookmark
 * folder chooser: file under an existing notebook, start a new one inline,
 * or leave the note unfiled. The value is the notebook name; "" is unfiled.
 */
export default function NotebookPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  /** True once "New notebook" swaps the select for its name input. */
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const known = listNotebooks();
  /* A value the list does not know yet (a name typed this sitting) still
   * shows as selected. */
  const options = value && !known.includes(value) ? [value, ...known] : known;

  const commit = () => {
    const name = draft.trim();
    if (name) onChange(name);
    setDraft("");
    setNaming(false);
  };

  if (naming) {
    return (
      <input
        autoFocus
        value={draft}
        aria-label="New notebook name"
        placeholder="Notebook name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          // Reset before closing so the blur commit finds nothing to write.
          if (e.key === "Escape") {
            setDraft("");
            setNaming(false);
          }
        }}
        className="w-32 border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink placeholder:text-muted focus:outline focus:outline-2 focus:outline-sapphire"
      />
    );
  }

  return (
    <select
      value={value}
      aria-label="Notebook"
      title="File this note under a notebook"
      onChange={(e) => {
        if (e.target.value === "__new__") setNaming(true);
        else onChange(e.target.value);
      }}
      className="border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink focus:outline focus:outline-2 focus:outline-sapphire"
    >
      <option value="">Unfiled</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      <option value="__new__">New notebook…</option>
    </select>
  );
}
