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
  customWorkflows,
  type WorkflowActionKind,
  type WorkflowDefinition,
  type WorkflowRun,
} from "@/lib/workflows";
import { playSound } from "@/lib/sound";
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
  "fx-press border border-rule bg-paper px-3 py-1.5 text-xs text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire";

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
    playSound("complete");
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
            className="h-full transition-[width]"
            style={{
              width: `${(done / def.steps.length) * 100}%`,
              /* The honest fraction in the stained idiom: light filling the
               * bar sapphire to amber, the switch's own wash. */
              background:
                "linear-gradient(100deg, color-mix(in srgb, var(--stained-sapphire) 70%, transparent), color-mix(in srgb, var(--stained-amber) 70%, transparent))",
            }}
          />
        </div>
      </header>

      {/* The steps, with the finished ones marked; a step revisits freely. */}
      <ol className="fx-stagger space-y-0.5">
        {def.steps.map((s, i) => (
          <li key={i} style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => {
                goToStep(run.id, i);
                playSound("navigate");
              }}
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

      <section aria-label={`Step ${run.currentStep + 1}: ${step.title}`} className="glass space-y-3 rounded-[4px] p-4">
        <h3 className="font-editorial text-base font-semibold">
          Step {run.currentStep + 1}: {step.title}
        </h3>
        <p className="text-[0.85rem] leading-relaxed text-ink">{step.prompt}</p>
        {action && (
          <button
            type="button"
            onClick={() => handoff(run, action)}
            className={BUTTON}
          >
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
          onClick={() => {
            goToStep(run.id, run.currentStep - 1);
            playSound("navigate");
          }}
          disabled={run.currentStep === 0}
          className={BUTTON}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => {
            completeStep(run.id, run.currentStep);
            playSound("complete");
          }}
          disabled={complete}
          className={BUTTON}
        >
          {run.currentStep === def.steps.length - 1 ? "Mark done" : "Mark done and continue"}
        </button>
        <button
          type="button"
          onClick={() => {
            goToStep(run.id, run.currentStep + 1);
            playSound("navigate");
          }}
          disabled={run.currentStep >= def.steps.length - 1}
          className={BUTTON}
        >
          Next
        </button>
      </div>

      {complete && (
        <p className="fx-fade border-t border-rule pt-3 text-[0.8rem] leading-relaxed text-muted">
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
 * One workflow's start row: the name, the subject field validating against
 * the workflow's kind, and the quiet error when the subject is not what the
 * workflow studies. Starting opens the run as a tab; a run on the same
 * workflow and subject resumes the one already open (src/lib/workflows.ts).
 * A custom workflow carries the extra affordances its row is handed.
 */
function StartRow({
  def,
  custom,
  onEdit,
  onDelete,
}: {
  def: WorkflowDefinition;
  custom?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { dispatch } = useWorkspace();
  const [subject, setSubject] = useState("");
  const [rejected, setRejected] = useState(false);

  const start = () => {
    const raw = subject.trim();
    if (!validateSubject(def.subject, raw)) {
      setRejected(true);
      playSound("error");
      return;
    }
    const run = startRun(def.id, raw);
    if (!run) return;
    setRejected(false);
    setSubject("");
    dispatch({ type: "openWorkflow", runId: run.id, title: `${def.name}: ${run.subject}` });
  };

  return (
    <li className="px-3 py-1">
      <p className="text-[0.8rem] text-ink" title={def.description}>
        {def.name}
        {custom && <span className="small-caps ml-1.5 text-[0.62rem] text-amber">Custom</span>}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${def.name}`}
            className="ml-1.5 text-[0.68rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete this workflow; runs on it say the library no longer knows it"
            aria-label={`Delete ${def.name}`}
            className="ml-1 px-0.5 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            ×
          </button>
        )}
      </p>
      <form
        className="mt-0.5 flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <input
          value={subject}
          aria-label={`Subject for ${def.name}`}
          placeholder={SUBJECT_HINTS[def.subject]}
          onChange={(e) => setSubject(e.target.value)}
          className="min-w-0 flex-1 border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink placeholder:text-muted focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <button
          type="submit"
          className="shrink-0 border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Start
        </button>
      </form>
      {rejected && (
        <p className="mt-0.5 text-[0.68rem] text-ruby">
          {def.subject === "passage"
            ? "Name a passage, such as John 3:16-18."
            : def.subject === "word"
              ? "Name a Strong's number, such as G26."
              : "Name the topic the study is about."}
        </p>
      )}
    </li>
  );
}

/**
 * The workflows list for the Documents rail: the prebuilt library with the
 * reader's own compositions beside it, each with a subject field, and the
 * runs already started with their progress. A custom workflow starts and
 * resumes exactly like a built-in (workflowFor resolves both), carries Edit
 * into the Workflow Editor tab and a delete, and wears a Custom mark so the
 * two libraries never blur. The compose affordance opens the editor on its
 * list.
 */
export function WorkflowsSection() {
  const { dispatch } = useWorkspace();
  const inProgress = useCollection(runs);
  const customs = useCollection(customWorkflows);

  const openRun = (run: WorkflowRun) => {
    const def = workflowFor(run.workflowId);
    dispatch({
      type: "openWorkflow",
      runId: run.id,
      title: def ? `${def.name}: ${run.subject}` : "Workflow",
    });
  };

  return (
    <div className="border-b border-rule py-1">
      <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
        Guided studies
      </div>
      <ul>
        {WORKFLOWS.map((w) => (
          <StartRow key={w.id} def={w} />
        ))}
        {customs.map((w) => (
          <StartRow
            key={w.id}
            def={w}
            custom
            onEdit={() => {
              dispatch({ type: "openWorkflowEditor", workflowId: w.id });
            }}
            onDelete={() => customWorkflows.remove(w.id)}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: "openWorkflowEditor" });
        }}
        className="fx-press mx-3 mt-1 border border-rule bg-paper px-1.5 py-0.5 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
      >
        Compose a workflow
      </button>
      {inProgress.length > 0 && (
        <>
          <div className="small-caps px-3 pt-2 pb-1 text-[0.62rem] font-semibold text-muted">
            In progress
          </div>
          <ul>
            {inProgress.map((run) => {
              const def = workflowFor(run.workflowId);
              /* A run whose workflow left the library (a deleted custom
               * composition) stays listed so it can be thrown away. */
              if (!def)
                return (
                  <li key={run.id} className="flex items-center gap-1 px-3 py-[3px] hover:bg-paper">
                    <span className="min-w-0 flex-1 truncate text-[0.8rem] text-muted">
                      A workflow the library no longer knows{" "}
                      <span className="text-muted">{run.subject}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteRun(run.id)}
                      title="Delete this run; its notes stay in the notebook"
                      aria-label={`Delete the run on ${run.subject}`}
                      className="shrink-0 px-1 text-[0.7rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      ×
                    </button>
                  </li>
                );
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
