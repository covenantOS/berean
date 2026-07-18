"use client";

import { useState } from "react";
import Link from "next/link";

interface SemanticHit {
  ref: string;
  book: string;
  chapter: number;
  from: number;
  text: string;
  reason: string;
}

interface SemanticResponse {
  hits?: SemanticHit[];
  withheld?: { ref: string; reason: string }[];
  error?: string;
}

export default function SemanticMode() {
  const [concept, setConcept] = useState("");
  const [scope, setScope] = useState("all");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [result, setResult] = useState<SemanticResponse | null>(null);
  const [error, setError] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (concept.trim().length < 3) return;
    setState("working");
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: concept.trim(), scope }),
      });
      const data = (await res.json()) as SemanticResponse;
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data);
      setState("idle");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "The search could not be completed.");
    }
  }

  const hits = result?.hits ?? [];
  const withheld = result?.withheld ?? [];

  return (
    <>
      <p className="mb-6 text-sm text-muted">
        Name a concept and the Scribe names passages that bear on it. Every
        reference is verified against the canon before it is shown; the text
        you read is the actual KJV, not the model's words.
      </p>

      <form onSubmit={search} className="mb-8 flex gap-2">
        <input
          type="search"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="e.g. covenant faithfulness, the fear of the LORD"
          aria-label="Search by meaning"
          className="w-full rounded-[4px] border border-rule bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          aria-label="Range"
          className="rounded-[4px] border border-rule bg-surface px-2 py-2 text-sm"
        >
          <option value="all">Whole canon</option>
          <option value="ot">Old Testament</option>
          <option value="nt">New Testament</option>
        </select>
        <button
          type="submit"
          disabled={state === "working"}
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {state === "working" ? "Searching…" : "Search"}
        </button>
      </form>

      {state === "error" && (
        <p className="rounded-[4px] border border-rule bg-surface p-4 text-sm text-muted">
          {error}
        </p>
      )}

      {result && (
        <>
          <p className="small-caps mb-4 border-b border-rule pb-2 text-sm text-muted">
            {hits.length} verified {hits.length === 1 ? "passage" : "passages"}
          </p>
          <ol className="space-y-4">
            {hits.map((hit) => (
              <li key={`${hit.book}-${hit.chapter}-${hit.from}`}>
                <Link
                  href={`/read/${hit.book}/${hit.chapter}#v${hit.from}`}
                  className="small-caps text-sm font-medium text-sapphire no-underline hover:underline"
                >
                  {hit.ref}
                </Link>
                <p className="font-reader mt-0.5 leading-relaxed">{hit.text}</p>
                <p className="mt-1 text-xs text-muted">{hit.reason}</p>
              </li>
            ))}
          </ol>
          {hits.length === 0 && (
            <p className="text-sm text-muted">
              The Scribe offered nothing that could be verified for “{concept}”.
            </p>
          )}
          {withheld.length > 0 && (
            <p className="mt-6 border-t border-rule pt-4 text-xs text-muted">
              {withheld.length} {withheld.length === 1 ? "suggestion was" : "suggestions were"}{" "}
              withheld because{" "}
              {withheld.length === 1 ? "it" : "they"} could not be verified against the canon
              {withheld.length <= 3
                ? `: ${withheld.map((w) => w.ref).join(", ")}`
                : ""}
              .
            </p>
          )}
        </>
      )}
    </>
  );
}
