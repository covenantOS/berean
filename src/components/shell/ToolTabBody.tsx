"use client";

import { useState, type FormEvent } from "react";
import { useWorkspace } from "./WorkspaceContext";
import type { Tab } from "./workspace-state";
import CommentaryDock from "./CommentaryDock";
import CrossRefsDock from "./CrossRefsDock";
import LexiconDock from "./LexiconDock";

/**
 * A dock tool living as a pane tab: the same body the dock renders, set in
 * the grid. Commentary and cross-refs keep answering the passage in focus;
 * the lexicon pins its own entry, asked for in the tab itself.
 */
export default function ToolTabBody({ paneId, tab }: { paneId: string; tab: Tab }) {
  if (tab.type === "commentary") {
    return (
      <div className="h-full overflow-y-auto p-4">
        <CommentaryDock />
      </div>
    );
  }
  if (tab.type === "crossrefs") {
    return (
      <div className="h-full overflow-y-auto p-4">
        <CrossRefsDock />
      </div>
    );
  }
  if (tab.type === "lexicon") {
    return <LexiconTabBody paneId={paneId} tabId={tab.id} entryId={tab.entryId} />;
  }
  return null;
}

function LexiconTabBody({
  paneId,
  tabId,
  entryId,
}: {
  paneId: string;
  tabId: string;
  entryId: string | null;
}) {
  const { dispatch } = useWorkspace();
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = value.trim();
    if (!id) return;
    dispatch({ type: "setLexiconTabEntry", paneId, tabId, entryId: id });
    setValue("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        onSubmit={submit}
        className="flex h-9 shrink-0 items-center gap-2 border-b border-rule px-3"
      >
        <label
          htmlFor={`lexicon-entry-${tabId}`}
          className="small-caps text-[0.62rem] font-semibold text-muted"
        >
          Strong’s
        </label>
        <input
          id={`lexicon-entry-${tabId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={entryId ?? "G25, H7225"}
          spellCheck={false}
          autoComplete="off"
          className="w-28 border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
        />
        <button
          type="submit"
          className="border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Open
        </button>
        {entryId && <span className="ml-auto text-xs font-semibold text-sapphire">{entryId}</span>}
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <LexiconDock
          entryId={entryId}
          onOpenEntry={(id) => dispatch({ type: "setLexiconTabEntry", paneId, tabId, entryId: id })}
        />
      </div>
    </div>
  );
}
