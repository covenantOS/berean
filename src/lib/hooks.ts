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
