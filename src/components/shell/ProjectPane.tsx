"use client";

import { useEffect, useRef, useState } from "react";
import { getBook } from "@/lib/canon";
import type { ExegeticalBrief } from "@/lib/brief";
import {
  PIPELINE_STAGES,
  StageKey,
  StudyProject,
  getProject,
  priorHandlings,
  updateProject,
  updateStage,
} from "@/lib/projects";
import { projects as projectsCollection } from "@/lib/projects";
import { getProfile } from "@/lib/settings";
import { playSound } from "@/lib/sound";
import { useWorkspace } from "./WorkspaceContext";

/** The free study notes ride beside the pipeline as one more stage tab. */
type StageTab = StageKey | "notes";

/**
 * A project open at its pipeline, moved from the retired /pulpit/[id] and
 * /study/[id] pages. One record model serves both rooms, so one surface
 * carries both aspects: the study's free notes sit beside the Pulpit's
 * stages, each stage saving on a debounce into the projects collection
 * with the bell ringing when that write lands, and the Scribe's brief
 * comes through its citation-verified route and never writes a word of
 * the sermon. Passage and citation links dispatch berean:open-ref,
 * carrying the pane in focus to the text. A record id that answers to
 * nothing renders the gone notice, the way a missing manuscript does.
 */
export default function ProjectPane({ projectId }: { projectId: string }) {
  const { dispatch } = useWorkspace();
  const [project, setProject] = useState<StudyProject | null | undefined>(undefined);
  const [stage, setStage] = useState<StageTab>("exegesis");
  const [text, setText] = useState("");
  const [briefState, setBriefState] = useState<"idle" | "working" | "error">("idle");
  const [briefError, setBriefError] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageInit = useRef(false);

  useEffect(() => {
    const load = () => {
      const p = getProject(projectId) ?? null;
      setProject(p);
      // A study project opens on its notes; a sermon opens on the exegesis.
      if (p && !stageInit.current) {
        stageInit.current = true;
        if (p.kind === "study") setStage("notes");
      }
    };
    load();
    return projectsCollection.subscribe(load);
  }, [projectId]);

  useEffect(() => {
    const p = getProject(projectId);
    setText(stage === "notes" ? (p?.notes ?? "") : (p?.stages?.[stage] ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, stage]);

  function onTextChange(value: string) {
    setText(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (stage === "notes") updateProject(projectId, { notes: value });
      else updateStage(projectId, stage, value);
      /* The bell answers the completed write alone: a project gone from
       * this device wrote nothing, and nothing rings. */
      if (getProject(projectId)) playSound("complete");
    }, 500);
  }

  async function requestBrief() {
    if (!project) return;
    setBriefState("working");
    setBriefError("");
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book: project.book,
          chapter: project.chapter,
          charge: profileCharge(),
          notes: profileAllowsNotes() ? project.stages?.exegesis || project.notes : undefined,
        }),
      });
      const data = (await res.json()) as { brief?: ExegeticalBrief; error?: string };
      if (!res.ok || !data.brief) throw new Error(data.error ?? `Request failed (${res.status})`);
      updateProject(projectId, { brief: data.brief });
      setShowBrief(true);
      setBriefState("idle");
      playSound("complete");
    } catch (err) {
      setBriefState("error");
      setBriefError(err instanceof Error ? err.message : "The brief could not be prepared.");
      playSound("error");
    }
  }

  if (project === undefined) return null;
  if (project === null) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-muted">
          Project not found on this device.{" "}
          <button
            type="button"
            onClick={() => dispatch({ type: "openPulpit" })}
            className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Back to the Pulpit
          </button>
        </p>
      </div>
    );
  }

  const book = getBook(project.book);
  const prior = priorHandlings(project.book, project.chapter, project.id);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <h2 className="font-editorial text-2xl font-bold">{project.title}</h2>
          <p className="small-caps mt-1 text-sm text-muted">
            Appointed text:{" "}
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("berean:open-ref", {
                    detail: { book: project.book, chapter: project.chapter },
                  })
                )
              }
              title={`Open ${book?.name} ${project.chapter} in the workspace`}
              className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              {book?.name} {project.chapter}
            </button>
            {project.series ? ` · ${project.series}` : ""}
            {project.appointedFor ? ` · for ${project.appointedFor}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={requestBrief}
            disabled={briefState === "working"}
            className="fx-press rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {briefState === "working"
              ? "The Scribe is at work…"
              : project.brief
                ? "Prepare a fresh brief"
                : "Request the Scribe's brief"}
          </button>
          {project.kind !== "study" && (
            <button
              onClick={() => {
                const delivering = project.status !== "delivered";
                updateProject(projectId, {
                  status: delivering ? "delivered" : "preparing",
                });
                /* Delivered rings the completion figure; reopening returns
                 * the work to the bench with the falling one. */
                playSound(delivering ? "complete" : "toggle-off");
              }}
              className="fx-press rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
            >
              {project.status === "delivered" ? "Reopen preparation" : "Mark delivered"}
            </button>
          )}
        </div>
      </div>

      {briefState === "error" && (
        <p className="mb-6 rounded-[4px] border border-ruby/40 bg-surface p-3 text-sm text-ruby no-print">
          {briefError}
        </p>
      )}

      {prior.length > 0 && (
        <div className="glass mb-6 rounded-[4px] p-4 text-sm no-print">
          <p className="small-caps mb-1 text-xs text-muted">You have handled this text before</p>
          {prior.map((p) => (
            <p key={p.id}>
              <button
                type="button"
                onClick={() => dispatch({ type: "openProject", projectId: p.id, title: p.title })}
                title={`Open ${p.title}`}
                className="text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {p.title}
              </button>{" "}
              <span className="text-muted">
                — {new Date(p.updatedAt).toLocaleDateString()}
                {p.series ? ` · ${p.series}` : ""}
              </span>
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex flex-wrap gap-1 no-print" role="tablist" aria-label="Pipeline stages">
            {PIPELINE_STAGES.map((s) => (
              <StageButton
                key={s.key}
                label={s.label}
                active={stage === s.key}
                filled={Boolean(project.stages?.[s.key]?.trim())}
                onSelect={() => setStage(s.key)}
              />
            ))}
            <StageButton
              label="Notes"
              active={stage === "notes"}
              filled={Boolean(project.notes.trim())}
              onSelect={() => setStage("notes")}
            />
          </div>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={24}
            placeholder={placeholderFor(stage)}
            className="w-full rounded-[4px] border border-rule bg-surface p-4 font-reader text-[0.95rem] leading-relaxed focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <p className="mt-1 text-xs text-muted no-print">
            Saved automatically, on this device only. Each stage feeds the next; the words remain
            yours.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between no-print">
            <h3 className="small-caps text-sm text-muted">The Scribe&apos;s brief</h3>
            {project.brief && (
              <button
                onClick={() => {
                  setShowBrief(!showBrief);
                  playSound(showBrief ? "toggle-off" : "toggle-on");
                }}
                className="text-xs text-sapphire hover:underline"
              >
                {showBrief ? "Collapse" : "Open"}
              </button>
            )}
          </div>
          {project.brief ? (
            showBrief ? (
              <BriefView brief={project.brief} />
            ) : (
              <button
                onClick={() => {
                  setShowBrief(true);
                  playSound("toggle-on");
                }}
                className="glass fx-fade fx-press w-full rounded-[4px] p-4 text-left text-sm text-muted hover:bg-paper"
              >
                Brief prepared {new Date(project.brief.generatedAt).toLocaleDateString()} — open it
                alongside your work.
              </button>
            )
          ) : (
            <div className="glass rounded-[4px] p-5 text-sm leading-relaxed text-muted">
              <p>
                When you request it, the Scribe prepares the study before you enter: the structure
                of the passage, key terms and their function, the questions the text raises — every
                claim cited and every quotation verified against the text.
              </p>
              <p className="mt-3">The Scribe prepares the study; it never writes the sermon.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StageButton({
  label,
  active,
  filled,
  onSelect,
}: {
  label: string;
  active: boolean;
  filled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`fx-press rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-ink bg-ink text-white"
          : filled
            ? "border-emerald/50 bg-surface text-emerald hover:bg-paper"
            : "border-rule bg-surface text-ink hover:bg-paper"
      }`}
    >
      {label}
    </button>
  );
}

function profileCharge(): string | undefined {
  const p = getProfile();
  if (!p) return undefined;
  const parts = [];
  if (p.confession && p.confession !== "None declared") parts.push(`Confession: ${p.confession}.`);
  if (p.confessionNote.trim()) parts.push(p.confessionNote.trim());
  if (p.scribeCharge.trim()) parts.push(p.scribeCharge.trim());
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function profileAllowsNotes(): boolean {
  return getProfile()?.scribeMayReadNotes ?? false;
}

function placeholderFor(stage: StageTab): string {
  switch (stage) {
    case "notes":
      return "Exegetical notes, the argument taking shape, questions to settle…";
    case "exegesis":
      return "Your exegetical notes — the grammar, the structure, the terms, what the text says…";
    case "argument":
      return "The argument of the sermon — the burden of the text stated as one claim on the hearers…";
    case "outline":
      return "The outline — heads and subheads carrying the argument…";
    case "manuscript":
      return "The manuscript…";
    case "delivery":
      return "Delivery notes — what to hold, what to cut if time runs, where to slow down…";
  }
}

function BriefView({ brief }: { brief: ExegeticalBrief }) {
  const book = getBook(brief.passage.book);
  return (
    <div className="glass fx-fade rounded-[4px] p-5">
      <p className="font-reader leading-relaxed">{brief.overview}</p>
      {brief.sections.map((s, i) => (
        <section key={i} className="mt-5 border-t border-rule pt-4">
          <h4 className="font-editorial mb-1.5 font-bold">{s.heading}</h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p>
          {s.citations.length > 0 && (
            <ul className="mt-2 space-y-1">
              {s.citations.map((c, j) => (
                <li key={j} className="text-xs leading-relaxed">
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("berean:open-ref", {
                          detail: { book: c.book, chapter: c.chapter, verse: c.verse },
                        })
                      )
                    }
                    title={`Open ${book?.name} ${c.chapter}:${c.verse} in the workspace`}
                    className="small-caps font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    {book?.name} {c.chapter}:{c.verse}
                  </button>{" "}
                  <span className="text-muted">&ldquo;{c.quote}&rdquo;</span>{" "}
                  {c.verified === false && (
                    <span className="font-medium text-ruby">
                      [unverified — this wording was not found in the cited verse]
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="mt-5 border-t border-rule pt-3 text-xs text-muted">
        Prepared {new Date(brief.generatedAt).toLocaleString()} · engine {brief.model} · every
        quotation checked against the KJV text; anything that failed the check is marked.
      </p>
    </div>
  );
}
