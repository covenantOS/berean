"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
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

export default function SermonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<StudyProject | null | undefined>(undefined);
  const [stage, setStage] = useState<StageKey>("exegesis");
  const [text, setText] = useState("");
  const [briefState, setBriefState] = useState<"idle" | "working" | "error">("idle");
  const [briefError, setBriefError] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = () => setProject(getProject(id) ?? null);
    load();
    return projectsCollection.subscribe(load);
  }, [id]);

  useEffect(() => {
    const p = getProject(id);
    setText(p?.stages?.[stage] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stage]);

  function onTextChange(value: string) {
    setText(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateStage(id, stage, value), 500);
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
      updateProject(id, { brief: data.brief });
      setShowBrief(true);
      setBriefState("idle");
    } catch (err) {
      setBriefState("error");
      setBriefError(err instanceof Error ? err.message : "The brief could not be prepared.");
    }
  }

  if (project === undefined) return null;
  if (project === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">
          Sermon not found on this device.{" "}
          <Link href="/pulpit" className="text-sapphire">
            Back to the Pulpit
          </Link>
        </p>
      </div>
    );
  }

  const book = getBook(project.book);
  const prior = priorHandlings(project.book, project.chapter, project.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted no-print">
        <Link href="/pulpit" className="text-sapphire no-underline hover:underline">
          The Pulpit
        </Link>{" "}
        / {project.title}
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <h1 className="font-editorial text-3xl font-bold">{project.title}</h1>
          <p className="small-caps mt-1 text-sm text-muted">
            Appointed text:{" "}
            <Link
              href={`/read/${project.book}/${project.chapter}`}
              className="text-sapphire no-underline hover:underline"
            >
              {book?.name} {project.chapter}
            </Link>
            {project.series ? ` · ${project.series}` : ""}
            {project.appointedFor ? ` · for ${project.appointedFor}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={requestBrief}
            disabled={briefState === "working"}
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {briefState === "working"
              ? "The Scribe is at work…"
              : project.brief
                ? "Prepare a fresh brief"
                : "Request the Scribe's brief"}
          </button>
          <button
            onClick={() =>
              updateProject(id, { status: project.status === "delivered" ? "preparing" : "delivered" })
            }
            className="rounded-[4px] border border-rule bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            {project.status === "delivered" ? "Reopen preparation" : "Mark delivered"}
          </button>
        </div>
      </div>

      {briefState === "error" && (
        <p className="mb-6 rounded-[4px] border border-ruby/40 bg-surface p-3 text-sm text-ruby no-print">
          {briefError}
        </p>
      )}

      {prior.length > 0 && (
        <div className="mb-6 rounded-[4px] border border-rule bg-surface p-4 text-sm no-print">
          <p className="small-caps mb-1 text-xs text-muted">You have handled this text before</p>
          {prior.map((p) => (
            <p key={p.id}>
              <Link href={`/pulpit/${p.id}`} className="text-sapphire no-underline hover:underline">
                {p.title}
              </Link>{" "}
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
            {PIPELINE_STAGES.map((s) => {
              const filled = Boolean(project.stages?.[s.key]?.trim());
              return (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={stage === s.key}
                  onClick={() => setStage(s.key)}
                  className={`rounded-[4px] border px-3 py-1.5 text-xs font-medium ${
                    stage === s.key
                      ? "border-ink bg-ink text-white"
                      : filled
                        ? "border-emerald/50 bg-surface text-emerald hover:bg-paper"
                        : "border-rule bg-surface text-ink hover:bg-paper"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={24}
            placeholder={placeholderFor(stage)}
            className="w-full rounded-[4px] border border-rule bg-surface p-4 font-reader text-[0.95rem] leading-relaxed focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <p className="mt-1 text-xs text-muted no-print">
            Saved automatically, on this device only. Each stage feeds the next; the words remain yours.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between no-print">
            <h2 className="small-caps text-sm text-muted">The Scribe&apos;s brief</h2>
            {project.brief && (
              <button
                onClick={() => setShowBrief(!showBrief)}
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
                onClick={() => setShowBrief(true)}
                className="w-full rounded-[4px] border border-rule bg-surface p-4 text-left text-sm text-muted hover:bg-paper"
              >
                Brief prepared {new Date(project.brief.generatedAt).toLocaleDateString()} — open it
                alongside your work.
              </button>
            )
          ) : (
            <div className="rounded-[4px] border border-rule bg-surface p-5 text-sm leading-relaxed text-muted">
              <p>
                When you request it, the Scribe prepares the study before you enter: the structure of
                the passage, key terms and their function, the questions the text raises — every claim
                cited and every quotation verified against the text.
              </p>
              <p className="mt-3">The Scribe prepares the study; it never writes the sermon.</p>
            </div>
          )}
        </section>
      </div>
    </div>
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

function placeholderFor(stage: StageKey): string {
  switch (stage) {
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
    <div className="rounded-[4px] border border-rule bg-surface p-5">
      <p className="font-reader leading-relaxed">{brief.overview}</p>
      {brief.sections.map((s, i) => (
        <section key={i} className="mt-5 border-t border-rule pt-4">
          <h3 className="font-editorial mb-1.5 font-bold">{s.heading}</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p>
          {s.citations.length > 0 && (
            <ul className="mt-2 space-y-1">
              {s.citations.map((c, j) => (
                <li key={j} className="text-xs leading-relaxed">
                  <Link
                    href={`/read/${c.book}/${c.chapter}#v${c.verse}`}
                    className="small-caps font-medium text-sapphire no-underline hover:underline"
                  >
                    {book?.name} {c.chapter}:{c.verse}
                  </Link>{" "}
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
