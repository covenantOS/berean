"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";

interface CommentarySection {
  verses: string;
  text: string;
}

interface CommentaryWork {
  id: string;
  label: string;
  sections: CommentarySection[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; works: CommentaryWork[] };

/** Sections collapse at roughly a paragraph; the rest waits behind "Read on". */
const EXCERPT = 320;

/**
 * The dock's commentary wall: every shipped work on the shelf answers the
 * passage in focus, in wall order. Sections render in the reader face and
 * collapse at EXCERPT characters, the shelf's old wall style.
 */
export default function CommentaryDock() {
  const { activeRef } = useWorkspace();
  const book = activeRef?.book ?? null;
  const chapter = activeRef?.chapter ?? null;
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (book === null || chapter === null) return;
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/commentary?book=${encodeURIComponent(book)}&chapter=${chapter}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { works: CommentaryWork[] };
        setLoad({ status: "ready", works: data.works });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [book, chapter]);

  if (book === null || chapter === null) {
    return <p className="text-xs text-muted">Open a passage and the shelf gathers here.</p>;
  }
  if (load.status === "loading") {
    return <p className="text-xs text-muted">Taking the volumes down…</p>;
  }
  if (load.status === "error") {
    return <p className="text-xs text-muted">The commentary shelf could not be reached.</p>;
  }
  if (load.works.length === 0) {
    return (
      <p className="text-xs text-muted">The commentary shelf holds no volume for this chapter yet.</p>
    );
  }
  return (
    <div className="space-y-6">
      {load.works.map((w) => (
        <section key={w.id}>
          <p className="small-caps mb-2 text-xs font-semibold text-muted">{w.label}</p>
          <div className="space-y-4">
            {w.sections.map((s, i) => (
              <WallSection key={i} section={s} />
            ))}
          </div>
        </section>
      ))}
      <p className="border-t border-rule pt-2 text-[0.68rem] text-muted">
        Public domain. The volumes are on the shelf; take any of them down
        yourself at any point of disagreement.
      </p>
    </div>
  );
}

function WallSection({ section }: { section: CommentarySection }) {
  const [open, setOpen] = useState(false);
  const long = section.text.length > EXCERPT;
  const shown =
    open || !long ? section.text : section.text.slice(0, EXCERPT).replace(/\s+\S*$/, "") + " …";
  return (
    <div>
      {section.verses && (
        <p className="mb-1 text-xs font-semibold text-sapphire">Verses {section.verses}</p>
      )}
      {shown.split(/\n\n+/).map((para, j) => (
        <p key={j} className="mb-2 font-reader text-[0.86rem] leading-relaxed">
          {para}
        </p>
      ))}
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs font-medium text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {open ? "Put back" : "Read on"}
        </button>
      )}
    </div>
  );
}
