"use client";

import { formatPassageRef, parsePassageRef, type PassageRef } from "./documents";
import { saveNote, type MarginNote } from "./marginalia";
import { collection, type Record_ } from "./store";

/**
 * Workflows: step-by-step guided studies, the Logos mechanic rebuilt
 * honestly over the tools the workspace already has. A workflow DEFINITION
 * is an id, a name, a subject kind, and an ordered list of steps. A step is
 * a prompt of pastoral guidance, an optional tool handoff (one of the
 * shell's existing open* events, aimed at the run's subject), and an
 * optional note invitation. The prebuilt definitions are static code data
 * below; definitions the reader composes in the Workflow Editor persist in
 * berean.customworkflows.v1 in the same shape, a collection of their own
 * beside the guides' rather than inside the runs', so a runs listing never
 * filters two record kinds. workflowFor resolves both, and the runner never
 * learns which library a definition came from.
 *
 * A workflow RUN is the persisted record: the workflow started on one
 * subject, the step it stands on, and the steps already completed. Runs
 * live in berean.workflows.v1 with the sync envelope from day one as
 * everywhere, so a study resumes across sessions and the whole graph's
 * export carries them. Progress is the honest fraction of steps completed;
 * there are no streaks and no badges.
 *
 * Capture is marginalia (src/lib/marginalia.ts), never a parallel model:
 * a captured note files under a notebook named for the workflow and the
 * subject, and anchors to the subject passage when the subject is one.
 */

/** What a workflow studies: a passage, a word (a Strong's number), or a topic. */
export type WorkflowSubjectKind = "passage" | "word" | "topic";

/**
 * A step's tool handoff. Passage kinds aim at the run's passage; word kinds
 * at the run's Strong's number; "search" answers a topic subject with the
 * concordance. The pane translates the kind into the shell's open* event.
 */
export type WorkflowActionKind =
  | "reader"
  | "guide"
  | "exegetical"
  | "textcompare"
  | "wordstudy"
  | "lexicon"
  | "search";

export interface WorkflowStep {
  /** The step's short name in the runner's step list. */
  title: string;
  /** The guidance copy the runner shows in full. */
  prompt: string;
  /** The tool the step hands off to; absent steps are reading or prayer. */
  action?: WorkflowActionKind;
  /** True when the step invites a note into the run's notebook. */
  capture?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  /** One honest line for the library lists. */
  description: string;
  subject: WorkflowSubjectKind;
  steps: WorkflowStep[];
}

/* ---------- The prebuilt library ---------- */

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "basic-bible-study",
    name: "Basic Bible Study",
    description: "Read a passage closely, look at what is there, and write down what you see.",
    subject: "passage",
    steps: [
      {
        title: "Read",
        prompt:
          "Read the passage aloud, then read it again slowly. Note the people, the place, and the repeated words before you reach for any tool.",
        action: "reader",
      },
      {
        title: "Observe",
        prompt:
          "Open the Passage Guide on the passage. Work through the cross-references, the people and places, and the notable words. Ask what the text says, not yet what it means.",
        action: "guide",
      },
      {
        title: "Study a word",
        prompt:
          "In the guide's notable words, choose the one that carries the most weight and open its word study from the guide. Write what the word contributes to the passage.",
        capture: true,
      },
      {
        title: "Write it down",
        prompt:
          "Write what the passage says and what it asks of you, in your own words. Keep it honest and short.",
        capture: true,
      },
    ],
  },
  {
    id: "passage-exegesis",
    name: "Passage Exegesis",
    description: "Draw the meaning out of a passage from the text itself, in the original languages.",
    subject: "passage",
    steps: [
      {
        title: "Read the text",
        prompt:
          "Read the passage until you can say its argument back without looking. Establish the boundaries: where the thought begins and where it ends.",
        action: "reader",
      },
      {
        title: "Work the original",
        prompt:
          "Open the Exegetical Guide. Walk the verse-by-verse original-language report: the lemmas, the forms, the words the translations handle differently.",
        action: "exegetical",
      },
      {
        title: "Compare translations",
        prompt:
          "Open Text Compare and read the passage across the translations on the shelf. Where they diverge, ask why; the divergence marks the interpretive decisions.",
        action: "textcompare",
      },
      {
        title: "Consult the guide",
        prompt:
          "Open the Passage Guide for the commentaries and cross-references. Let the dead argue with you before you settle the meaning.",
        action: "guide",
      },
      {
        title: "State the meaning",
        prompt:
          "Write the passage's meaning in one sentence, then the paragraph that defends it from the text. Cite the evidence you actually found.",
        capture: true,
      },
    ],
  },
  {
    id: "word-study",
    name: "Word Study",
    description: "Trace one word through its lexicon entry and its uses across the canon.",
    subject: "word",
    steps: [
      {
        title: "Open the word study",
        prompt:
          "Open the Bible Word Study on the word. Read the lexical report whole: the glosses, the forms, the distribution across the canon.",
        action: "wordstudy",
      },
      {
        title: "Read the lexicon",
        prompt:
          "Open the lexicon entry itself. Take the definition from the lexicon, not from the English word you already know.",
        action: "lexicon",
      },
      {
        title: "Weigh the renderings",
        prompt:
          "Return to the word study and read the translation section: every way the KJV renders the word, with its count. The range of renderings marks the range of meaning; write where the range surprises you.",
        capture: true,
      },
      {
        title: "Write the finding",
        prompt:
          "Write the word's range of meaning in your own words, with the uses that establish it. Keep the finding smaller than the evidence.",
        capture: true,
      },
    ],
  },
  {
    id: "devotional",
    name: "Devotional",
    description: "Read a passage before God, linger over it, and answer Him in prayer.",
    subject: "passage",
    steps: [
      {
        title: "Read",
        prompt:
          "Read the passage slowly, twice. Ask God to give you light, and do not hurry past the verse that stops you.",
        action: "reader",
      },
      {
        title: "Meditate",
        prompt:
          "Stay with the verse that stopped you. Turn it over: what it shows of God, what it shows of you, what it promises, what it commands.",
        capture: true,
      },
      {
        title: "Pray",
        prompt:
          "Answer the passage in prayer: adore what it shows of God, confess what it shows of you, ask for what it promises. Write the prayer as you pray it.",
        capture: true,
      },
    ],
  },
  {
    id: "lectio-divina",
    name: "Lectio Divina",
    description: "The old fourfold reading: read, meditate, pray, rest in the text.",
    subject: "passage",
    steps: [
      {
        title: "Lectio",
        prompt:
          "Read the passage once, slowly. Listen for the word or phrase that sounds loudest, and stop there.",
        action: "reader",
      },
      {
        title: "Meditatio",
        prompt:
          "Read it again and stay with that word or phrase. Let it ask its questions of you before you ask yours of it. Write what it asks.",
        capture: true,
      },
      {
        title: "Oratio",
        prompt:
          "Read it a third time and answer aloud. Speak to God about what the passage has said to you; write the answer as a prayer.",
        capture: true,
      },
      {
        title: "Contemplatio",
        prompt:
          "Set the words down and rest in what you have heard. When you are ready, write one sentence to carry from the passage into the day.",
        capture: true,
      },
    ],
  },
  {
    id: "inductive-study",
    name: "Inductive Bible Study",
    description: "Observe, interpret, apply: the passage speaks before anyone speaks for it.",
    subject: "passage",
    steps: [
      {
        title: "Observe",
        prompt:
          "Read the passage and mark what is there: repeated words, contrasts, cause and effect, the connectives. Observation asks what the text says.",
        action: "reader",
        capture: true,
      },
      {
        title: "Interpret",
        prompt:
          "Open the Passage Guide. Test your reading against the cross-references and the commentaries, and let Scripture interpret Scripture before any voice from the shelf.",
        action: "guide",
        capture: true,
      },
      {
        title: "Apply",
        prompt:
          "Name what the passage asks of you specifically: a belief to hold, a sin to kill, a duty to take up, a promise to trust. Write the application as a resolve.",
        capture: true,
      },
    ],
  },
];

/** The definition an id names: the prebuilt library first, then the custom
 *  compositions on the device; undefined for an id neither knows. */
export function workflowFor(id: string): WorkflowDefinition | undefined {
  const built = WORKFLOWS.find((w) => w.id === id);
  if (built) return built;
  const custom = customWorkflows.get(id);
  if (!custom) return undefined;
  return {
    id: custom.id,
    name: custom.name,
    description: custom.description,
    subject: custom.subject,
    steps: custom.steps,
  };
}

/* ---------- Custom workflows ---------- */

/**
 * A reader-composed workflow, the same shape the prebuilt library runs.
 * The record id is the workflow id, so a run names it the way it names a
 * built-in and resume works unchanged. The sync envelope rides along from
 * day one as everywhere.
 */
export interface CustomWorkflow extends Record_ {
  name: string;
  description: string;
  subject: WorkflowSubjectKind;
  steps: WorkflowStep[];
}

const customWorkflows = collection<CustomWorkflow>("berean.customworkflows.v1");
export { customWorkflows };

const SUBJECT_KINDS: WorkflowSubjectKind[] = ["passage", "word", "topic"];

const ACTION_KINDS: WorkflowActionKind[] = [
  "reader",
  "guide",
  "exegetical",
  "textcompare",
  "wordstudy",
  "lexicon",
  "search",
];

/** The steps a stored or imported record carries, down to the honest shape:
 *  an untitled step drops, an unknown action or a non-boolean capture goes. */
export function sanitizeSteps(raw: unknown): WorkflowStep[] {
  if (!Array.isArray(raw)) return [];
  const actions = new Set<string>(ACTION_KINDS);
  const out: WorkflowStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const record = s as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim().slice(0, 80) : "";
    if (!title) continue;
    const prompt = typeof record.prompt === "string" ? record.prompt.trim().slice(0, 2000) : "";
    const step: WorkflowStep = { title, prompt };
    if (typeof record.action === "string" && actions.has(record.action)) {
      step.action = record.action as WorkflowActionKind;
    }
    if (record.capture === true) step.capture = true;
    out.push(step);
  }
  return out;
}

/**
 * Saves a composition; null when it fails honest validation: a name, at
 * least one step that survives sanitize, and a prompt on every step that
 * invites a note. Editing writes the same record, so runs already open on
 * the workflow follow the new composition.
 */
export function saveWorkflow(
  id: string | null,
  fields: { name: string; description: string; subject: WorkflowSubjectKind; steps: WorkflowStep[] }
): CustomWorkflow | null {
  const name = fields.name.trim().slice(0, 80);
  const description = fields.description.trim().slice(0, 200);
  const subject = SUBJECT_KINDS.includes(fields.subject) ? fields.subject : "passage";
  const steps = sanitizeSteps(fields.steps);
  if (!name || steps.length === 0) return null;
  if (steps.some((s) => s.capture && !s.prompt)) return null;
  if (id) return customWorkflows.update(id, { name, description, subject, steps }) ?? null;
  return customWorkflows.create({ name, description, subject, steps });
}

/* ---------- Runs ---------- */

export interface WorkflowRun extends Record_ {
  workflowId: string;
  /** The subject in its validated display form: "John 3:16-18", "G26", "grace". */
  subject: string;
  /** The step the run stands on, an index into the definition's steps. */
  currentStep: number;
  /** Step indexes completed, in completion order. */
  completedSteps: number[];
}

const runs = collection<WorkflowRun>("berean.workflows.v1");
export { runs };

/** Word subjects are Strong's numbers, the ids the lexicon and word study answer. */
const STRONGS_PATTERN = /^[GH]\d{1,5}$/i;

/**
 * Validates a typed subject against the workflow's kind and returns its
 * display form; null when the subject is not what the workflow studies.
 * A passage normalizes through the shared reference parser, the way the
 * pulpit's passage field does.
 */
export function validateSubject(kind: WorkflowSubjectKind, raw: string): string | null {
  if (kind === "passage") {
    const ref = parsePassageRef(raw);
    return ref ? formatPassageRef(ref) : null;
  }
  if (kind === "word") {
    const id = raw.trim().toUpperCase();
    return STRONGS_PATTERN.test(id) ? id : null;
  }
  const topic = raw.trim();
  return topic.length >= 2 ? topic : null;
}

/** The passage a run studies; undefined when the subject is a word or topic. */
export function runPassage(run: WorkflowRun): PassageRef | undefined {
  const def = workflowFor(run.workflowId);
  if (def?.subject !== "passage") return undefined;
  return parsePassageRef(run.subject);
}

/**
 * Starts a run; null when the workflow or the subject fails validation.
 * A second run on the same workflow and subject resumes the one already
 * open rather than splitting the notebook.
 */
export function startRun(workflowId: string, subjectRaw: string): WorkflowRun | null {
  const def = workflowFor(workflowId);
  if (!def) return null;
  const subject = validateSubject(def.subject, subjectRaw);
  if (!subject) return null;
  const existing = runs
    .list((r) => r.workflowId === workflowId && r.subject === subject)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (existing) return existing;
  return runs.create({ workflowId, subject, currentStep: 0, completedSteps: [] });
}

/** The notebook a run's captured notes file under, named for the study. */
export function runNotebook(run: WorkflowRun): string {
  const def = workflowFor(run.workflowId);
  return `${def?.name ?? "Workflow"}: ${run.subject}`;
}

/** Moves the run to a step; out-of-range indexes clamp into the steps. */
export function goToStep(runId: string, step: number): WorkflowRun | undefined {
  const run = runs.get(runId);
  if (!run) return undefined;
  const def = workflowFor(run.workflowId);
  if (!def) return undefined;
  const currentStep = Math.min(Math.max(0, Math.trunc(step)), def.steps.length - 1);
  return runs.update(runId, { currentStep });
}

/** Marks a step done and advances to the next uncompleted step, or stays on
 * the last one. Re-completing a step changes nothing beyond the position. */
export function completeStep(runId: string, step: number): WorkflowRun | undefined {
  const run = runs.get(runId);
  if (!run) return undefined;
  const def = workflowFor(run.workflowId);
  if (!def) return undefined;
  const completedSteps = run.completedSteps.includes(step)
    ? run.completedSteps
    : [...run.completedSteps, step];
  const next = def.steps.findIndex((_, i) => !completedSteps.includes(i));
  return runs.update(runId, {
    completedSteps,
    currentStep: next === -1 ? def.steps.length - 1 : next,
  });
}

/** True when every step of the run's workflow is completed. */
export function isComplete(run: WorkflowRun): boolean {
  const def = workflowFor(run.workflowId);
  return def !== undefined && run.completedSteps.length >= def.steps.length;
}

/**
 * Captures a note from a step into the run's notebook. The note is ordinary
 * marginalia: it anchors to the subject passage when the subject is one
 * (its first verse, the way a deep link anchors), and a word or topic
 * subject leaves it anchored to the study alone.
 */
export function captureNote(run: WorkflowRun, text: string): MarginNote | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const ref = runPassage(run);
  return saveNote({
    text: trimmed,
    notebook: runNotebook(run),
    ...(ref ? { book: ref.book, chapter: ref.chapter, verse: ref.from ?? 1 } : {}),
  });
}

export function deleteRun(id: string) {
  runs.remove(id);
}
