"use client";

import { useState } from "react";
import { useCollection, useRecord } from "@/lib/hooks";
import {
  captureNote,
  completeStep,
  deleteRun,
  goToStep,
  isComplete,
  runNotebook,
  runPassage,
  runs,
  startRun,
  validateSubject,
  WORKFLOWS,
  workflowFor,
  type WorkflowActionKind,
  type WorkflowRun,
} from "@/lib/workflows";
import { useWorkspace } from "./WorkspaceContext";

/**
 * The workflow runner: one run standing on one step of its definition
 * (src/lib/workflows.ts). The pane reads the run collection live, so
 * progress and notes apply to the open tab, and a deleted run degrades the
 * way a deleted list document does. A step shows its guidance, hands off to
 * its tool through the shell's open* events (the tool opens as a tab beside
 * this one, which stays open), and invites a note into the run's notebook
 * when the step captures. Progress is the honest fraction of steps done, a
 * quiet bar; there are no streaks and no badges.
 */

const ACTION_LABELS: Record<WorkflowActionKind, string> = {
  reader: "Open the reader",
  guide: "Open the Passage Guide",
  exegetical: "Open the Exegetical Guide",
  textcompare: "Open Text Compare",
  wordstudy: "Open the Word Study",
  lexicon: "Open the lexicon",
  search: "Search the canon",
};

/** A step's handoff speaks the shell's event contract (WorkspaceContext). */
function handoff(run: WorkflowRun, action: WorkflowActionKind) {
  const emit = (name: string, detail: unknown) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));
  const ref = runPassage(run);
  if (action === "reader" && ref) emit("berean:open-ref", { book: ref.book, chapter: ref.chapter });
  if (action === "guide" && ref) emit("berean:open-guide", { book: ref.book, chapter: ref.chapter });
  if (action === "exegetical" && ref)
    emit("berean:open-exegetical", { book: ref.book, chapter: ref.chapter });
  if (action === "textcompare" && ref)
    emit("berean:open-textcompare", { book: ref.book, chapter: ref.chapter });
  if (action === "wordstudy") emit("berean:open-wordstudy", { id: run.subject });
  if (action === "lexicon") emit("berean:open-lexicon", { id: run.subject });
  if (action === "search") emit("berean:search", { q: run.subject });
}

const BUTTON =
  "border border-rule bg-paper px-3 py-1.5 text-xs text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

export default function WorkflowPane({ runId }: { runId: string }) {
  const run = useRecord(runs, runId);
  const [note, setNote] = useState("");
  /** The step a note was last saved from; shows the quiet confirmation. */
  const [savedAt, setSavedAt] = useState<number | null>(null);

  if (!run) {
    return <p className="text-xs text-muted">This workflow run is no longer on this device.</p>;
  }
  const def = workflowFor(run.workflowId);
  if (!def) {
    return <p className="text-xs text-muted">This workflow is not in the library.</p>;
  }

  const step = def.steps[run.currentStep] ?? def.steps[0];
  const action = step.action;
  const done = run.completedSteps.length;
  const complete = isComplete(run);

  const saveCapture = () => {
    if (!captureNote(run, note)) return;
    setNote("");
    setSavedAt(run.currentStep);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Guided study</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">{def.name}</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {run.subject} · {done} of {def.steps.length} steps complete
        </p>
        {/* The honest fraction, a quiet bar; no ring, no streak, no badge. */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={def.steps.length}
          aria-valuenow={done}
          aria-label="Study progress"
          className="mt-2 h-1 w-full bg-rule"
        >
          <div
            className="h-full bg-sapphire transition-[width]"
            style={{ width: `${(done / def.steps.length) * 100}%` }}
          />
        </div>
      </header>

      {/* The steps, with the finished ones marked; a step revisits freely. */}
      <ol className="space-y-0.5">
        {def.steps.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => goToStep(run.id, i)}
              aria-current={i === run.currentStep ? "step" : undefined}
              className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-[0.8rem] hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${
                i === run.currentStep ? "font-medium text-ink" : "text-muted"
              }`}
            >
              <span className="w-4 shrink-0 text-[0.68rem]">
                {run.completedSteps.includes(i) ? "✓" : `${i + 1}.`}
              </span>
              {s.title}
            </button>
          </li>
        ))}
      </ol>

      <section aria-label={`Step ${run.currentStep + 1}: ${step.title}`} className="space-y-3 border border-rule bg-paper p-4">
        <h3 className="font-editorial text-base font-semibold">
          Step {run.currentStep + 1}: {step.title}
        </h3>
        <p className="text-[0.85rem] leading-relaxed text-ink">{step.prompt}</p>
        {action && (
          <button type="button" onClick={() => handoff(run, action)} className={BUTTON}>
            {ACTION_LABELS[action]}
          </button>
        )}
        {step.capture && (
          <div className="space-y-1.5">
            <textarea
              value={note}
              rows={4}
              aria-label={`Notes for ${step.title}`}
              placeholder="Write what you find…"
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-rule bg-surface px-2 py-1.5 text-[0.8rem] text-ink placeholder:text-muted focus:outline focus:outline-2 focus:outline-sapphire"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveCapture}
                disabled={!note.trim()}
                className={BUTTON}
              >
                Save note
              </button>
              {savedAt === run.currentStep && !note.trim() && (
                <span className="text-[0.68rem] text-muted">Filed under {runNotebook(run)}</span>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goToStep(run.id, run.currentStep - 1)}
          disabled={run.currentStep === 0}
          className={BUTTON}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => completeStep(run.id, run.currentStep)}
          disabled={complete}
          className={BUTTON}
        >
          {run.currentStep === def.steps.length - 1 ? "Mark done" : "Mark done and continue"}
        </button>
        <button
          type="button"
          onClick={() => goToStep(run.id, run.currentStep + 1)}
          disabled={run.currentStep >= def.steps.length - 1}
          className={BUTTON}
        >
          Next
        </button>
      </div>

      {complete && (
        <p className="border-t border-rule pt-3 text-[0.8rem] leading-relaxed text-muted">
          The study is complete. Its notes remain filed under {runNotebook(run)} in the Documents
          rail.
        </p>
      )}
    </div>
  );
}

/* ---------- The library surface: start and resume ---------- */

/** The subject field's placeholder, in the workflow's own grammar. */
const SUBJECT_HINTS = { passage: "A passage, e.g. John 3:16-18", word: "A Strong's number, e.g. G26", topic: "A topic, e.g. grace" } as const;

/**
 * The workflows list for the Documents rail: the prebuilt library with a
 * subject field per workflow, and the runs already started with their
 * progress. Starting validates the subject against the workflow's kind and
 * opens the run as a tab; a run on the same workflow and subject resumes
 * the one already open (src/lib/workflows.ts).
 */
export function WorkflowsSection() {
  const { dispatch } = useWorkspace();
  const inProgress = useCollection(runs);
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  /** The workflow whose subject failed validation, for the quiet error. */
  const [rejected, setRejected] = useState<string | null>(null);

  const openRun = (run: WorkflowRun) => {
    const def = workflowFor(run.workflowId);
    dispatch({
      type: "openWorkflow",
      runId: run.id,
      title: def ? `${def.name}: ${run.subject}` : "Workflow",
    });
  };

  const start = (workflowId: string) => {
    const raw = (subjects[workflowId] ?? "").trim();
    const def = workflowFor(workflowId);
    if (!def || !validateSubject(def.subject, raw)) {
      setRejected(workflowId);
      return;
    }
    const run = startRun(workflowId, raw);
    if (!run) return;
    setRejected(null);
    setSubjects((s) => ({ ...s, [workflowId]: "" }));
    openRun(run);
  };

  return (
    <div className="border-b border-rule py-1">
      <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
        Guided studies
      </div>
      <ul>
        {WORKFLOWS.map((w) => (
          <li key={w.id} className="px-3 py-1">
            <p className="text-[0.8rem] text-ink" title={w.description}>
              {w.name}
            </p>
            <form
              className="mt-0.5 flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                start(w.id);
              }}
            >
              <input
                value={subjects[w.id] ?? ""}
                aria-label={`Subject for ${w.name}`}
                placeholder={SUBJECT_HINTS[w.subject]}
                onChange={(e) => setSubjects((s) => ({ ...s, [w.id]: e.target.value }))}
                className="min-w-0 flex-1 border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink placeholder:text-muted focus:outline focus:outline-2 focus:outline-sapphire"
              />
              <button
                type="submit"
                className="shrink-0 border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Start
              </button>
            </form>
            {rejected === w.id && (
              <p className="mt-0.5 text-[0.68rem] text-ruby">
                {w.subject === "passage"
                  ? "Name a passage, such as John 3:16-18."
                  : w.subject === "word"
                    ? "Name a Strong's number, such as G26."
                    : "Name the topic the study is about."}
              </p>
            )}
          </li>
        ))}
      </ul>
      {inProgress.length > 0 && (
        <>
          <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
            In progress
          </div>
          <ul>
            {inProgress.map((run) => {
              const def = workflowFor(run.workflowId);
              if (!def) return null;
              return (
                <li key={run.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
                  <button
                    type="button"
                    onClick={() => openRun(run)}
                    title={`Resume ${def.name} on ${run.subject}`}
                    className="min-w-0 flex-1 truncate text-left text-[0.8rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    {def.name} <span className="text-muted">{run.subject}</span>
                  </button>
                  <span className="shrink-0 text-[0.62rem] text-muted">
                    {run.completedSteps.length} of {def.steps.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteRun(run.id)}
                    title="Delete this run; its notes stay in the notebook"
                    aria-label={`Delete the ${def.name} run on ${run.subject}`}
                    className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
