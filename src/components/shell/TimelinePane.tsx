"use client";

import { useEffect, useState } from "react";
import TimelineChart, { TimelineEraView } from "../TimelineChart";

interface TimelinePayload {
  count: number;
  eras: TimelineEraView[];
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; chart: TimelinePayload };

/**
 * The Timeline pane: the curated chronology in era bands, as a workspace
 * tab. A pinned event selects and scrolls to it the way the retired page's
 * ?event= did; the chart itself is the shared TimelineChart, unchanged.
 */
export default function TimelinePane({ event }: { event?: string }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pane/timeline", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setLoad({ status: "missing" });
          return;
        }
        setLoad({ status: "ready", chart: (await res.json()) as TimelinePayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, []);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Banding the chronology…</p>;
  }
  if (load.status === "missing") {
    return (
      <p className="text-xs text-muted">
        The timeline is not furnished in this build; it ships only when the
        curated chronology is present and registered in the rights registry.
      </p>
    );
  }
  const { chart } = load;

  return (
    <div className="fx-fade space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Timeline</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">
          Creation to the early church
        </h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {chart.count} events, banded by era · Old Testament years follow Ussher · select a marker
          for its passages
        </p>
      </header>
      <TimelineChart eras={chart.eras} focusId={event} />
    </div>
  );
}
