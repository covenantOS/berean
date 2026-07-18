"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { getBook } from "@/lib/canon";
import type { ExegeticalBrief } from "@/lib/brief";
import { StudyProject, getProject, updateProject } from "@/lib/projects";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<StudyProject | null | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [briefState, setBriefState] = useState<"idle" | "working" | "error">("idle");
  const [briefError, setBriefError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const p = getProject(id) ?? null;
    setProject(p);
    setNotes(p?.notes ?? "");
  }, [id]);

  function onNotesChange(value: string) {
    setNotes(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateProject(id, { notes: value });
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
        body: JSON.stringify({ book: project.book, chapter: project.chapter }),
      });
      const data = (await res.json()) as { brief?: ExegeticalBrief; error?: string };
      if (!res.ok || !data.brief) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      updateProject(id, { brief: data.brief });
      setProject(getProject(id) ?? null);
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
          Project not found on this device.{" "}
          <Link href="/study" className="text-sapphire">
            Back to Study
          </Link>
        </p>
      </div>
    );
  }

  const book = getBook(project.book);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/study" className="text-sapphire no-underline hover:underline">
          Study
        </Link>{" "}
        / {project.title}
      </nav>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
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
          </p>
        </div>
        <button
          onClick={requestBrief}
          disabled={briefState === "working"}
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {briefState === "working"
            ? "The Scribe is at work…"
            : project.brief
              ? "Prepare a fresh brief"
              : "Request the Scribe’s brief"}
        </button>
      </div>

      {briefState === "error" && (
        <p className="mb-6 rounded-[4px] border border-ruby/40 bg-surface p-3 text-sm text-ruby">
          {briefError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="small-caps mb-2 text-sm text-muted">Your notes</h2>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={18}
            placeholder="Exegetical notes, the argument taking shape, questions to settle…"
            className="w-full rounded-[4px] border border-rule bg-surface p-4 font-reader text-[0.95rem] leading-relaxed focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <p className="mt-1 text-xs text-muted">Saved automatically, on this device only.</p>
        </section>

        <section>
          <h2 className="small-caps mb-2 text-sm text-muted">The Scribe’s brief</h2>
          {project.brief ? (
            <BriefView brief={project.brief} />
          ) : (
            <div className="rounded-[4px] border border-rule bg-surface p-5 text-sm leading-relaxed text-muted">
              <p>
                No brief yet. The Scribe prepares an exegetical brief on the
                appointed chapter: its structure, key terms, and the questions
                the text raises — with every claim cited to the verses it
                stands on, and every quotation verified against the text
                before it is shown.
              </p>
              <p className="mt-3">
                The Scribe prepares the study; the sermon remains yours.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
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
                  <span className="text-muted">“{c.quote}”</span>{" "}
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
