import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { getSyncStore, resolveNamespace } from "@/lib/sync-server";

/**
 * Drop tombstones older than a cutoff, the server half of the client's
 * purgeTombstones (src/lib/store.ts). A delete travels as a tombstone so
 * every device learns it; once every device has caught up, the tombstone is
 * dead weight, and this route reclaims it. The body is { namespace?, days? }:
 * days defaults to SYNC_TOMBSTONE_DAYS, then to 30.
 *
 * Scope resolves two ways. Without a secret it works exactly like push and
 * pull: a valid account session purges the account's namespace, anything
 * else purges the caller's slug. When SYNC_PURGE_SECRET is set and the
 * request carries it as a bearer token, the namespace may be omitted to
 * purge every namespace, which is the form a host scheduler uses; the
 * secret is server config, so it never reaches a client bundle.
 *
 * Purging is safe to repeat and safe to run early: the worst case of purging
 * a tombstone a device has not yet pulled is that the device still holds the
 * record live and pushes it back on its next cycle.
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

  const secret = process.env.SYNC_PURGE_SECRET;
  const authorized =
    secret !== undefined &&
    secret.length > 0 &&
    req.headers.get("authorization") === `Bearer ${secret}`;
  let namespace: string | null;
  if (authorized && (b?.namespace === undefined || b?.namespace === null)) {
    namespace = null;
  } else if (authorized) {
    if (typeof b.namespace !== "string" || b.namespace.length < 1) {
      return NextResponse.json({ error: "Invalid namespace." }, { status: 400 });
    }
    namespace = b.namespace;
  } else {
    namespace = resolveNamespace(await sessionUserId(req.headers), b?.namespace);
    if (namespace === null) {
      return NextResponse.json({ error: "Invalid namespace." }, { status: 400 });
    }
  }

  const daysValue = b?.days ?? process.env.SYNC_TOMBSTONE_DAYS ?? 30;
  const days = typeof daysValue === "string" ? Number(daysValue) : daysValue;
  if (
    typeof days !== "number" ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 3650
  ) {
    return NextResponse.json({ error: "Invalid days." }, { status: 400 });
  }
  const before = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const res = await store.purgeTombstones(namespace, before);
    return NextResponse.json({ before, days, purged: res.purged });
  } catch {
    return NextResponse.json({ error: "Purge failed." }, { status: 500 });
  }
}
