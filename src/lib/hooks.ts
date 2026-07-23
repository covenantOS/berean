"use client";

import { useEffect, useState } from "react";
import type { Collection, Record_ } from "./store";

/** Subscribe a component to a collection; re-renders on any write. */
export function useCollection<T extends Record_>(c: Collection<T>, filter?: (row: T) => boolean): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    const load = () => setRows(c.list(filter));
    load();
    return c.subscribe(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);
  return rows;
}

export function useRecord<T extends Record_>(c: Collection<T>, id: string): T | undefined {
  const [row, setRow] = useState<T | undefined>(undefined);
  useEffect(() => {
    const load = () => setRow(c.get(id));
    load();
    return c.subscribe(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, id]);
  return row;
}

/**
 * Re-renders the component when any of the collections is written, without
 * reading rows. The tab strip subscribes this way so a rename lands on an
 * open tab's label the moment it is written (PaneGrid's tabLabel reads the
 * collections live).
 */
export function useCollectionWrites(
  collections: { subscribe: (fn: () => void) => () => void }[]
): void {
  const [, bump] = useState(0);
  useEffect(() => {
    const load = () => bump((n) => n + 1);
    const unsubs = collections.map((c) => c.subscribe(load));
    return () => {
      for (const u of unsubs) u();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections]);
}
