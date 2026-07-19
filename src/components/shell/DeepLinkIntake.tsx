"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "./WorkspaceContext";
import { lexiconTab } from "./workspace-state";
import { parseDeepLinkRef, parseDeepLinkTab } from "./deep-link";

/**
 * URL deep-link intake for /workspace (the param contract lives in
 * ./deep-link.ts). Runs once, after the persisted session has restored, and
 * dispatches into it exactly as if the user had typed the omnibox command:
 * the deep link opens alongside the session rather than replacing it, and
 * the session's own persistence keeps the result. The URL then strips to
 * plain /workspace, because every load restores the persisted tree; a kept
 * link would re-fire on refresh and fight the session it already produced.
 * useSearchParams needs a Suspense boundary under Next 15 prerendering, so
 * the inner component mounts inside one and the shell prerenders untouched.
 */
export default function DeepLinkIntake() {
  return (
    <Suspense fallback={null}>
      <Intake />
    </Suspense>
  );
}

function Intake() {
  const params = useSearchParams();
  const { state, dispatch, hydrated } = useWorkspace();
  const done = useRef(false);

  useEffect(() => {
    if (!hydrated || done.current) return;
    const refParam = params.get("ref");
    const tabParam = params.get("tab");
    if (!refParam && !tabParam) return;
    done.current = true;
    const ref = refParam ? parseDeepLinkRef(refParam) : null;
    const tab = tabParam ? parseDeepLinkTab(tabParam) : null;
    const paneId = state.activePaneId;
    // The reference lands first; the tool tab then opens in the same pane and
    // takes the focus, with the reader retargeted behind it.
    if (ref) {
      dispatch({ type: "openRef", book: ref.book, chapter: ref.chapter, paneId });
      if (ref.verse !== undefined) {
        dispatch({ type: "selectVerse", book: ref.book, chapter: ref.chapter, verse: ref.verse });
      }
    }
    if (tab) {
      switch (tab.kind) {
        case "lexicon":
          dispatch({
            type: "openTab",
            tab: lexiconTab(tab.entryId),
            target: { kind: "strip", paneId },
          });
          break;
        case "wordstudy":
          dispatch({ type: "openWordStudy", strongsId: tab.strongsId, paneId });
          break;
        case "guide":
          dispatch({ type: "openGuide", book: tab.book, chapter: tab.chapter, paneId });
          break;
        case "exegetical":
          dispatch({ type: "openExegetical", book: tab.book, chapter: tab.chapter, paneId });
          break;
        case "compare":
          dispatch({ type: "openTextCompare", book: tab.book, chapter: tab.chapter, paneId });
          break;
        case "concordance":
          dispatch({ type: "openConcordance", book: tab.book, paneId });
          break;
        case "factbook":
          dispatch({ type: "openFactbook", entityId: tab.entityId, title: tab.entityId, paneId });
          break;
        case "topicguide":
          dispatch({
            type: "openTopicGuide",
            work: tab.work,
            topicId: tab.topicId,
            title: tab.topicId,
            paneId,
          });
          break;
      }
    }
    window.history.replaceState(null, "", "/workspace");
  }, [hydrated, params, dispatch, state.activePaneId]);

  return null;
}
