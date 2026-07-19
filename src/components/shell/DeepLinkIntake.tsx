"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { documents } from "@/lib/documents";
import { liturgies } from "@/lib/liturgy";
import { getProject } from "@/lib/projects";
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
        case "library":
          dispatch({ type: "openLibrary", paneId });
          break;
        case "atlas":
          dispatch({ type: "openAtlas", place: tab.place, paneId });
          break;
        case "timeline":
          dispatch({ type: "openTimeline", event: tab.event, paneId });
          break;
        case "memory":
          dispatch({ type: "openMemory", passageId: tab.passageId, paneId });
          break;
        case "journal":
          dispatch({ type: "openJournal", paneId });
          break;
        case "prayers":
          dispatch({ type: "openPrayers", paneId });
          break;
        case "plans":
          dispatch({ type: "openPlans", paneId });
          break;
        case "dashboard":
          dispatch({ type: "openDashboard", paneId });
          break;
        case "desk":
          dispatch({ type: "openDesk", paneId });
          break;
        case "manuscript": {
          // The title resolves at open when the document answers; a missing
          // one opens anyway and the pane renders the gone notice.
          const doc = documents.get(tab.docId);
          dispatch({
            type: "openManuscript",
            docId: tab.docId,
            title: doc?.title ?? "Untitled manuscript",
            paneId,
          });
          break;
        }
        case "pulpit":
          dispatch({ type: "openPulpit", paneId });
          break;
        case "project": {
          // The manuscript's rule: the title resolves when the record
          // answers; a missing one opens anyway and the pane degrades.
          const project = getProject(tab.projectId);
          dispatch({
            type: "openProject",
            projectId: tab.projectId,
            title: project?.title ?? "Untitled project",
            paneId,
          });
          break;
        }
        case "chapel":
          dispatch({ type: "openChapel", paneId });
          break;
        case "service": {
          // The project's rule: the title resolves when the record answers;
          // a missing one opens anyway and the pane degrades.
          const service = liturgies.get(tab.serviceId);
          dispatch({
            type: "openService",
            serviceId: tab.serviceId,
            title: service?.title ?? "Order of Worship",
            paneId,
          });
          break;
        }
        case "almanac":
          dispatch({ type: "openAlmanac", paneId });
          break;
        case "topics":
          dispatch({ type: "openTopics", paneId });
          break;
        case "settings":
          dispatch({ type: "openSettings", paneId });
          break;
      }
    }
    window.history.replaceState(null, "", "/workspace");
  }, [hydrated, params, dispatch, state.activePaneId]);

  return null;
}
