"use client";

import { useEffect, useState } from "react";
import { useWorkspaceDispatch } from "./WorkspaceContext";

/** One topic row in a work's index, from GET /api/topics. */
interface TopicRow {
  id: string;
  title: string;
  refs: number;
}

interface WorkIndex {
  id: "naves" | "torreys";
  label: string;
  topics: TopicRow[];
}

/** Each work shows its first matches up to this cap, the retired page's own. */
const PAGE = 200;

/**
 * The Topical Index pane: both topical works browsed together with an
 * inline filter, the retired /topics index in the workspace. A topic row
 * opens its Topic Guide in the same pane; the filter narrows both works at
 * once.
 */
export default function TopicsPane() {
  const { dispatch } = useWorkspaceDispatch();
  const [works, setWorks] = useState<WorkIndex[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/topics", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { works: WorkIndex[] };
        setWorks(data.works);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setWorks([]);
      });
    return () => controller.abort();
  }, []);

  const needle = query.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Topical Index</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">
          The canon under its subjects
        </h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          Every doctrine, duty, person, and place with its verses set out in
          full, from two public-domain works: Nave&apos;s Topical Bible and
          Torrey&apos;s New Topical Textbook.
        </p>
      </header>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="A topic: faith, prayer, atonement…"
        aria-label="Filter topics"
        spellCheck={false}
        autoComplete="off"
        className="w-full max-w-md border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none"
      />

      {works === null ? (
        <p className="text-xs text-muted">Opening the index…</p>
      ) : (
        works.map((w) => {
          const matches = needle
            ? w.topics.filter((t) => t.title.includes(needle))
            : w.topics;
          const shown = matches.slice(0, PAGE);
          return (
            <section key={w.id}>
              <h3 className="small-caps border-b border-rule pb-2 text-xs text-muted">
                {w.label} · {w.topics.length.toLocaleString()} topics
                {needle &&
                  ` · ${matches.length.toLocaleString()} ${matches.length === 1 ? "match" : "matches"}`}
                {matches.length > shown.length && ` · showing first ${shown.length}`}
              </h3>
              <ul className="grid gap-x-8 gap-y-1.5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((t) => (
                  <li key={t.id} className="text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "openTopicGuide",
                          work: w.id,
                          topicId: t.id,
                          title: t.title,
                        })
                      }
                      className="text-sapphire capitalize hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                    >
                      {t.title}
                    </button>{" "}
                    <span className="text-[0.68rem] text-muted">
                      {t.refs.toLocaleString()} {t.refs === 1 ? "ref" : "refs"}
                    </span>
                  </li>
                ))}
              </ul>
              {matches.length === 0 && (
                <p className="pt-3 text-xs text-muted">No topic in this work matches that filter.</p>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
