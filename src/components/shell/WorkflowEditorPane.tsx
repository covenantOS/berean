"use client";

import { useEffect, useState } from "react";
import {
  customWorkflows,
  saveWorkflow,
  type WorkflowActionKind,
  type WorkflowStep,
  type WorkflowSubjectKind,
} from "@/lib/workflows";
import { useCollection } from "@/lib/hooks";
import { playSound } from "@/lib/sound";

/**
 * The Workflow Editor: the compose surface for custom workflows, the Guide
 * Editor's pattern over the workflow definition (src/lib/workflows.ts). The
 * list names every custom workflow on the device with its subject kind and
 * step count, Edit, and delete; the draft names the workflow, picks the
 * subject kind it studies, and builds the step list: per step a title, the
 * guidance prompt, an optional handoff to one of the real tools, and a note
 * invitation, with the wall-priority steppers for order. Saving writes the
 * composition to berean.customworkflows.v1, where the runner resolves it
 * through workflowFor exactly like a built-in; a workflow deleted out from
 * under its runs leaves them saying the library no longer knows it. A tab
 * opened with a workflow id lands in that workflow's draft; a tab opened
 * with none lands on the list. Sharing waits on accounts.
 */

interface DraftStep extends WorkflowStep {
  /** Local identity for the row, so reorder and remove keep the fields. */
  key: string;
}

interface Draft {
  /** The record being edited; null while the workflow is new. */
  id: string | null;
  name: string;
  description: string;
  subject: WorkflowSubjectKind;
  steps: DraftStep[];
}

const ACTION_OPTIONS: { value: WorkflowActionKind | ""; label: string }[] = [
  { value: "", label: "No tool handoff" },
  { value: "reader", label: "Reader" },
  { value: "guide", label: "Passage Guide" },
  { value: "exegetical", label: "Exegetical Guide" },
  { value: "textcompare", label: "Text Compare" },
  { value: "wordstudy", label: "Bible Word Study" },
  { value: "lexicon", label: "Lexicon" },
  { value: "search", label: "Search" },
];

const SUBJECT_OPTIONS: { value: WorkflowSubjectKind; label: string }[] = [
  { value: "passage", label: "A passage" },
  { value: "word", label: "A word (a Strong's number)" },
  { value: "topic", label: "A topic" },
];

const SUBJECT_LABELS: Record<WorkflowSubjectKind, string> = {
  passage: "passage",
  word: "word",
  topic: "topic",
};

let stepCounter = 0;
const newStep = (): DraftStep => ({ key: `step-${++stepCounter}`, title: "", prompt: "" });

const toDraft = (id: string, w: { name: string; description: string; subject: WorkflowSubjectKind; steps: WorkflowStep[] }): Draft => ({
  id,
  name: w.name,
  description: w.description,
  subject: w.subject,
  steps: w.steps.map((s) => ({ ...s, key: `step-${++stepCounter}` })),
});

const INPUT =
  "border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none";

export default function WorkflowEditorPane({ workflowId }: { workflowId: string | null }) {
  const saved = useCollection(customWorkflows);
  const [draft, setDraft] = useState<Draft | null>(null);

  /* A pinned workflow id opens its draft; a deleted id falls back to the list. */
  useEffect(() => {
    if (!workflowId) return;
    const w = customWorkflows.get(workflowId);
    if (w) setDraft(toDraft(w.id, w));
  }, [workflowId]);

  const startNew = () => {
    playSound("open");
    setDraft({ id: null, name: "", description: "", subject: "passage", steps: [newStep()] });
  };

  const startEdit = (id: string) => {
    const w = customWorkflows.get(id);
    if (w) {
      playSound("open");
      setDraft(toDraft(w.id, w));
    }
  };

  const setStep = (key: string, patch: Partial<DraftStep>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      steps: draft.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    });
  };

  /* One step up or down the composition, the wall-priority idiom. */
  const move = (key: string, delta: -1 | 1) => {
    if (!draft) return;
    const i = draft.steps.findIndex((s) => s.key === key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    setDraft({ ...draft, steps });
  };

  const removeStep = (key: string) => {
    if (!draft) return;
    setDraft({ ...draft, steps: draft.steps.filter((s) => s.key !== key) });
  };

  /* The honest bars to saving, named for the message under the form. */
  const invalid = !draft
    ? null
    : !draft.name.trim()
      ? "name"
      : draft.steps.length === 0
        ? "steps"
        : draft.steps.some((s) => !s.title.trim())
          ? "titles"
          : draft.steps.some((s) => s.capture && !s.prompt.trim())
            ? "prompts"
            : null;

  const save = () => {
    if (!draft || invalid) return;
    const steps: WorkflowStep[] = draft.steps.map((s) => ({
      title: s.title,
      prompt: s.prompt,
      ...(s.action ? { action: s.action } : {}),
      ...(s.capture ? { capture: true } : {}),
    }));
    if (
      !saveWorkflow(draft.id, {
        name: draft.name,
        description: draft.description,
        subject: draft.subject,
        steps,
      })
    )
      return;
    playSound("complete");
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Workflow Editor</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">Custom workflows</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          Guided studies composed from the same steps the library runs; a custom workflow starts
          from the Documents rail beside the built-ins. Sharing waits on accounts.
        </p>
      </header>

      {draft ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={draft.name}
              aria-label="Workflow name"
              placeholder="Workflow name"
              autoFocus={draft.id === null}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={`w-72 ${INPUT}`}
            />
            <select
              value={draft.subject}
              onChange={(e) =>
                setDraft({ ...draft, subject: e.target.value as WorkflowSubjectKind })
              }
              aria-label="What the workflow studies"
              className={INPUT}
            >
              {SUBJECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Studies {o.label.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <input
            value={draft.description}
            aria-label="One line for the library lists"
            placeholder="One line for the library lists"
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={`w-full max-w-xl ${INPUT}`}
          />

          <ol className="fx-stagger space-y-2">
            {draft.steps.map((s, i) => (
              <li
                key={s.key}
                className="glass space-y-1.5 rounded-[4px] p-3"
                style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-[0.68rem] text-muted">{i + 1}.</span>
                  <input
                    value={s.title}
                    aria-label={`Title of step ${i + 1}`}
                    placeholder="Step title"
                    onChange={(e) => setStep(s.key, { title: e.target.value })}
                    className={`min-w-0 flex-1 ${INPUT}`}
                  />
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(s.key, -1)}
                    title="Move up the workflow"
                    aria-label={`Move step ${i + 1} up the workflow`}
                    className="fx-press border border-rule bg-paper px-1 leading-none text-ink hover:border-sapphire disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === draft.steps.length - 1}
                    onClick={() => move(s.key, 1)}
                    title="Move down the workflow"
                    aria-label={`Move step ${i + 1} down the workflow`}
                    className="fx-press border border-rule bg-paper px-1 leading-none text-ink hover:border-sapphire disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(s.key)}
                    title="Remove this step"
                    aria-label={`Remove step ${i + 1}`}
                    className="px-1 text-[0.72rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={s.prompt}
                  rows={2}
                  aria-label={`Guidance for step ${i + 1}`}
                  placeholder="The guidance the runner shows for this step"
                  onChange={(e) => setStep(s.key, { prompt: e.target.value })}
                  className={`w-full ${INPUT}`}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={s.action ?? ""}
                    onChange={(e) =>
                      setStep(s.key, {
                        action: (e.target.value || undefined) as WorkflowActionKind | undefined,
                      })
                    }
                    aria-label={`Tool handoff for step ${i + 1}`}
                    className={INPUT}
                  >
                    {ACTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <label className="switch text-[0.68rem] text-muted">
                    <input
                      type="checkbox"
                      checked={s.capture === true}
                      onChange={(e) => {
                        setStep(s.key, { capture: e.target.checked || undefined });
                        playSound(e.target.checked ? "toggle-on" : "toggle-off");
                      }}
                    />
                    <span className="switch-track" aria-hidden="true" />
                    <span>Invites a note</span>
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => draft && setDraft({ ...draft, steps: [...draft.steps, newStep()] })}
            className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Add a step
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={invalid !== null}
              className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {draft.id ? "Save workflow" : "Create workflow"}
            </button>
            <button
              type="button"
              onClick={() => {
                playSound("close");
                setDraft(null);
              }}
              className="px-2 py-1 text-xs text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Cancel
            </button>
            {draft.id && (
              <button
                type="button"
                onClick={() => {
                  customWorkflows.remove(draft.id as string);
                  setDraft(null);
                }}
                className="px-2 py-1 text-xs text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Delete
              </button>
            )}
          </div>
          {invalid === "steps" && (
            <p className="text-[0.68rem] text-muted">A workflow needs at least one step.</p>
          )}
          {invalid === "titles" && (
            <p className="text-[0.68rem] text-muted">Every step needs a title.</p>
          )}
          {invalid === "prompts" && (
            <p className="text-[0.68rem] text-muted">
              A step that invites a note needs its guidance, so the note knows what it answers.
            </p>
          )}
        </div>
      ) : saved.length === 0 ? (
        <p className="text-xs text-muted">
          No custom workflows yet. Compose one and it joins the guided studies in the Documents
          rail.
        </p>
      ) : (
        <ul className="space-y-1">
          {saved.map((w) => (
            <li key={w.id} className="flex items-baseline gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink" title={w.description}>
                {w.name}
              </p>
              <span className="shrink-0 text-[0.68rem] text-muted">
                {SUBJECT_LABELS[w.subject]} · {w.steps.length}{" "}
                {w.steps.length === 1 ? "step" : "steps"}
              </span>
              <button
                type="button"
                onClick={() => startEdit(w.id)}
                className="shrink-0 px-1 text-[0.68rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => customWorkflows.remove(w.id)}
                title="Delete this workflow; runs on it say the library no longer knows it"
                aria-label={`Delete ${w.name}`}
                className="shrink-0 px-1 text-[0.72rem] leading-none text-muted hover:text-ruby focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {!draft && (
        <button
          type="button"
          onClick={startNew}
          className="fx-press border border-rule bg-paper px-2 py-1 text-xs text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          New workflow
        </button>
      )}
    </div>
  );
}
