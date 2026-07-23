"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { authClient } from "@/lib/auth-client";
import { playSound } from "@/lib/sound";
import {
  configuredTransport,
  deviceNamespace,
  lastSyncedAt,
  markSynced,
  SyncEngine,
  SYNCED_EVENT,
  type SyncSummary,
} from "@/lib/sync";

type Phase =
  | { state: "idle" }
  | { state: "running"; collection: string; index: number; total: number }
  | { state: "success"; summary: SyncSummary }
  | { state: "error"; message: string };

/** The collection key without its berean.*.v1 wrapper, for progress lines. */
function shortName(key: string): string {
  return key.split(".")[1] ?? key;
}

function countLine(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * The Settings sync section: the manual surface of the sync engine. It names
 * the identity the routes will resolve (the signed-in account, the anonymous
 * session, or this device's slug, the same ruling resolveNamespace makes on
 * the server), shows the last completed sync as this device recorded it, and
 * runs a full push-then-pull cycle over every collection on demand. While a
 * cycle runs it names the collection in flight; when one ends it reports the
 * honest counts the engine returned. On a deployment without the sync flag
 * the section says so and nothing else changes.
 */
export default function SyncSection() {
  const { data: session } = authClient.useSession();
  const [enabled, setEnabled] = useState(false);
  const [deviceSlug, setDeviceSlug] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });

  useEffect(() => {
    setEnabled(configuredTransport() !== null);
    setLast(lastSyncedAt());
    const refresh = () => setLast(lastSyncedAt());
    window.addEventListener(SYNCED_EVENT, refresh);
    return () => window.removeEventListener(SYNCED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (enabled && !session?.user) setDeviceSlug(deviceNamespace());
  }, [enabled, session?.user]);

  const user = session?.user;
  const isAnonymous = Boolean(user && (user as { isAnonymous?: boolean }).isAnonymous);

  async function syncNow() {
    const transport = configuredTransport(user?.id);
    if (!transport || phase.state === "running") return;
    try {
      const engine = new SyncEngine(transport);
      const summary = await engine.sync((key, index, total) =>
        setPhase({ state: "running", collection: shortName(key), index, total }),
      );
      markSynced();
      setPhase({ state: "success", summary });
      // A finished cycle is the workspace's clearest completion.
      playSound("complete");
    } catch (err) {
      setPhase({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      playSound("error");
    }
  }

  function identity(): string {
    if (user && !isAnonymous) return `Identity: your account (${user.id}).`;
    if (user) return `Identity: this anonymous session (${user.id}).`;
    if (deviceSlug) {
      return `Identity: this device's slug (${deviceSlug}). Sign in above to bring every device under one namespace.`;
    }
    return "";
  }

  return (
    <section className="glass rounded-[4px] p-5" style={{ "--i": 2 } as CSSProperties}>
      <h3 className="small-caps mb-3 text-sm text-muted">Sync: one study, every device</h3>

      {!enabled ? (
        <p className="text-sm text-muted">
          Sync is not enabled on this deployment. Export and import below remain the bridge
          between devices, and nothing on this device changes hands on its own.
        </p>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm">{identity()}</p>
          <p className="text-sm text-muted">
            {last
              ? `Last synced on this device: ${new Date(last).toLocaleString()}.`
              : "This device has not synced yet."}
          </p>
          <button
            onClick={syncNow}
            disabled={phase.state === "running"}
            className="fx-press justify-self-start rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {phase.state === "running" ? "Syncing…" : "Sync now"}
          </button>
          {phase.state === "running" && (
            <p className="text-sm text-muted">
              Pushing and pulling {phase.collection} ({phase.index + 1} of {phase.total})…
            </p>
          )}
          {phase.state === "success" && (
            <p className="text-sm text-emerald">
              {phase.summary.pushed === 0 && phase.summary.pulled === 0
                ? "Sync complete. Everything was already in step."
                : `Sync complete: ${countLine(phase.summary.pushed, "record")} sent, ${countLine(phase.summary.pulled, "record")} brought home.`}
            </p>
          )}
          {phase.state === "error" && (
            <p className="text-sm text-ruby">
              Sync stopped: {phase.message}. Work on this device is untouched, and the next run
              resumes where this one stopped.
            </p>
          )}
          <p className="border-t border-rule pt-3 text-xs text-muted">
            A cycle pushes every change this device holds, then pulls and merges what the server
            has, last writer wins per record. Open panes follow pulled changes on their own.
          </p>
        </div>
      )}
    </section>
  );
}
