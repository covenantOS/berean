"use client";

import { useEffect, useState } from "react";
import AtlasMap, { AtlasPoint } from "../AtlasMap";

interface AtlasPayload {
  viewBox: string;
  paths: string[];
  points: AtlasPoint[];
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; map: AtlasPayload };

/**
 * The Atlas pane: every geolocated place in Scripture on its land base, as a
 * workspace tab. A pinned place focuses the way the retired page's ?place=
 * did; the map itself is the shared AtlasMap, unchanged.
 */
export default function AtlasPane({ place }: { place?: string }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pane/atlas", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setLoad({ status: "missing" });
          return;
        }
        setLoad({ status: "ready", map: (await res.json()) as AtlasPayload });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, []);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Plotting the atlas…</p>;
  }
  if (load.status === "missing") {
    return (
      <p className="text-xs text-muted">
        The atlas is not furnished in this build; it ships only when both the
        Natural Earth land base and the TIPNR place data are present and
        registered in the rights registry.
      </p>
    );
  }
  const { map } = load;
  const majorCount = map.points.filter((p) => p.major).length;

  return (
    <div className="space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Atlas</p>
        <h2 className="font-editorial mt-0.5 text-lg font-semibold">The biblical world</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">
          {map.points.length.toLocaleString()} places carry coordinates · {majorCount} referenced
          ten times or more, labeled · every point opens its Factbook entry
        </p>
      </header>
      <AtlasMap viewBox={map.viewBox} paths={map.paths} points={map.points} focusId={place} />
    </div>
  );
}
