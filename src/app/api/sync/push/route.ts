import { NextRequest, NextResponse } from "next/server";
import {
  getSyncStore,
  isCollection,
  parseNamespace,
  parseRecords,
} from "@/lib/sync-server";

/**
 * Push one batch of records into one collection. The body is a PushRequest
 * (src/lib/sync.ts) plus the pre-auth namespace slug: { namespace,
 * collection, records }. The store merges last-writer-wins and answers how
 * many rows it actually wrote; a retried push merges away idempotently.
 * Auth is not wired: the namespace stands in for the identity subject until
 * that wave lands, and the shape does not change when it does.
 */
export async function POST(req: NextRequest) {
  const store = getSyncStore();
  if (!store) {
    return NextResponse.json(
      { error: "Sync is not enabled on this deployment." },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const namespace = parseNamespace(b?.namespace);
  if (namespace === null) {
    return NextResponse.json({ error: "Invalid namespace." }, { status: 400 });
  }
  if (!isCollection(b.collection)) {
    return NextResponse.json({ error: "Unknown collection." }, { status: 400 });
  }
  const records = parseRecords(b.records);
  if (records === null) {
    return NextResponse.json({ error: "Invalid records." }, { status: 400 });
  }
  try {
    const res = await store.push(namespace, b.collection, records);
    return NextResponse.json(res);
  } catch {
    return NextResponse.json({ error: "Push failed." }, { status: 500 });
  }
}
