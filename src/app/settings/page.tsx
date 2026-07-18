"use client";

import { useRef, useState } from "react";
import { useCollection } from "@/lib/hooks";
import { CONFESSIONS, deleteProfile, profiles, saveProfile } from "@/lib/settings";
import { deleteGraph, exportGraph, importGraph } from "@/lib/store";

export default function SettingsPage() {
  const profileRows = useCollection(profiles);
  const profile = profileRows[0];
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");

  function download() {
    const blob = new Blob([exportGraph()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `berean-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(file: File) {
    const result = importGraph(await file.text());
    setMessage(result.ok ? "Import complete — your study is restored on this device." : result.error ?? "Import failed.");
  }

  function destroyAll() {
    if (
      window.confirm(
        "Delete every note, project, sermon, liturgy, plan, and setting stored on this device? Export first if you want a copy. This cannot be undone."
      )
    ) {
      deleteGraph();
      setMessage("Everything on this device has been deleted.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        Your work belongs to you. Everything Berean knows is written on this page or visible in
        your rooms — inspectable, exportable, and deletable, with nothing inferred behind your back.
      </p>

      <section className="mb-8 rounded-[4px] border border-rule bg-surface p-5">
        <h2 className="small-caps mb-3 text-sm text-muted">Your standards — what the Scribe may know</h2>
        <div className="grid gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Confession</span>
            <select
              value={profile?.confession ?? "None declared"}
              onChange={(e) => saveProfile({ confession: e.target.value })}
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            >
              {CONFESSIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Doctrinal notes</span>
            <textarea
              value={profile?.confessionNote ?? ""}
              onChange={(e) => saveProfile({ confessionNote: e.target.value })}
              rows={2}
              placeholder="Convictions on the disputed questions, translation preferences…"
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Standing charge to the Scribe</span>
            <textarea
              value={profile?.scribeCharge ?? ""}
              onChange={(e) => saveProfile({ scribeCharge: e.target.value })}
              rows={3}
              placeholder="How you want briefs arranged, sources weighted, questions framed…"
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile?.scribeMayReadNotes ?? false}
              onChange={(e) => saveProfile({ scribeMayReadNotes: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              The Scribe may read my working notes on a passage when preparing its brief for that
              passage. <span className="text-muted">Off by default; briefs then use only the chapter text and this page.</span>
            </span>
          </label>
          {profile && (
            <button
              onClick={() => deleteProfile()}
              className="justify-self-start rounded-[4px] border border-rule px-3 py-1.5 text-xs text-ruby hover:bg-paper"
            >
              Forget all of this
            </button>
          )}
        </div>
        <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
          These are the only memory scopes the Scribe has. Nothing is learned by inference, and
          nothing here is sent anywhere except inside your own brief requests.
        </p>
      </section>

      <section className="mb-8 rounded-[4px] border border-rule bg-surface p-5">
        <h2 className="small-caps mb-3 text-sm text-muted">Your study — export, restore, delete</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={download}
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Export everything (.json)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-[4px] border border-rule px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Import an export
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={destroyAll}
            className="rounded-[4px] border border-ruby/50 px-4 py-2 text-sm font-medium text-ruby hover:bg-paper"
          >
            Delete everything on this device
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-emerald">{message}</p>}
        <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
          The export contains your whole knowledge graph — marginalia, projects, sermons,
          manuscripts, liturgies, plans, memory work, calendar, rule of life, and these settings.
          It is also the bridge between devices until cloud sync arrives (see the architecture
          notes in the repository); no account is required and no telemetry exists.
        </p>
      </section>
    </div>
  );
}
