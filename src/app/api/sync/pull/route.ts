import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import {
  getSyncStore,
  isCollection,
  parseCursor,
  resolveNamespace,
} from "@/lib/sync-server";

/**
 * Pull every record in one collection committed after a cursor. The body is
 * a PullRequest (src/lib/sync.ts) plus the pre-auth namespace slug:
 * { namespace, collection, after }. after is null for the whole collection
 * (tombstones included) or the cursor from the last PullResponse, held
 * verbatim and never parsed by the device. Identity resolves as in push: a
 * session subject beats the slug.
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
  const namespace = resolveNamespace(await sessionUserId(req.headers), b?.namespace);
  if (namespace === null) {
    return NextResponse.json({ error: "Invalid namespace." }, { status: 400 });
  }
  if (!isCollection(b.collection)) {
    return NextResponse.json({ error: "Unknown collection." }, { status: 400 });
  }
  const after = parseCursor(b.after);
  if (after === undefined) {
    return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  }
  try {
    const res = await store.pull(namespace, b.collection, after);
    return NextResponse.json(res);
  } catch {
    return NextResponse.json({ error: "Pull failed." }, { status: 500 });
  }
}
