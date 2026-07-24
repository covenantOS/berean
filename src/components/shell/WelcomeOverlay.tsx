"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { markOnboarded, seedStarterDocuments } from "@/lib/onboarding";
import { playSound } from "@/lib/sound";
import { useWorkspace } from "./WorkspaceContext";
import { LAYOUT_PRESETS, PREFERRED_TRANSLATION_KEY, type PresetId } from "./workspace-state";

/** One translation on the shelf, as /api/translations reports it. */
interface ShelfTranslation {
  id: string;
  abbrev: string;
  name: string;
  otOnly: boolean;
}

/**
 * The first-run welcome: a full-pane overlay in the reading view's idiom,
 * never a route. Two steps and a skip: the translation new passages open in,
 * then the task that builds the first layout from the presets (the generated
 * layouts; nothing is invented here). Finishing writes the onboarded mark so
 * the overlay never returns, seeds the starter documents, and applies the
 * chosen preset around the passage in focus. The Settings pane's Welcome row
 * re-opens the flow through berean:welcome for a second device owner or a
 * fresh look; seeding skips collections that already hold work, so the
 * choices apply honestly over existing data.
 *
 * The room wears the study's own light: the stained-glass wash drifts behind
 * a glass card under the leaded-window mark, the steps crossfade, and the
 * task cards cascade in. The bells answer the gestures: the Settings row's
 * summons rises, backing up falls, and finishing completes at the
 * switchboard. The first-run arrival itself keeps silent: no gesture has
 * sounded yet, and boot does not ring its own bell.
 */
export default function WelcomeOverlay() {
  const { firstRun, dispatch } = useWorkspace();
  const [open, setOpen] = useState(firstRun);
  const [step, setStep] = useState<1 | 2>(1);
  const [shelf, setShelf] = useState<ShelfTranslation[]>([]);
  const [translation, setTranslation] = useState("kjv");

  useEffect(() => {
    const onWelcome = () => {
      /* The Settings row's click is a gesture; the first-run mount is not,
       * so the arrival chime lives here rather than in the open effect. */
      playSound("open");
      setStep(1);
      setOpen(true);
    };
    window.addEventListener("berean:welcome", onWelcome);
    return () => window.removeEventListener("berean:welcome", onWelcome);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTranslation(window.localStorage.getItem(PREFERRED_TRANSLATION_KEY) ?? "kjv");
    fetch("/api/translations")
      .then((res) => (res.ok ? res.json() : { translations: [] }))
      .then((data: { translations: ShelfTranslation[] }) =>
        // OT-only texts cannot default: a new tab might open in the NT.
        setShelf(data.translations.filter((t) => !t.otOnly))
      )
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const finish = (preset: PresetId, withTranslation: boolean) => {
    if (withTranslation) {
      // Written before the dispatch so the preset's reader tabs open in it.
      if (translation === "kjv") window.localStorage.removeItem(PREFERRED_TRANSLATION_KEY);
      else window.localStorage.setItem(PREFERRED_TRANSLATION_KEY, translation);
    }
    markOnboarded();
    seedStarterDocuments();
    dispatch({ type: "applyPreset", preset });
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Berean Blue"
      className="fx-fade fixed inset-0 z-50 flex items-center justify-center bg-paper px-4 text-ink"
    >
      {/* The first-run room keeps the study's light (globals .stained-ambient). */}
      <div className="stained-ambient" aria-hidden="true" />
      <div className="glass-lit fx-bloom w-full max-w-md rounded-[4px] p-8">
        <span className="leaded-mark mb-4" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <p className="small-caps text-xs font-semibold text-amber">Welcome to Berean Blue</p>
        {step === 1 ? (
          <div key="translation" className="fx-fade">
            <h2 className="font-editorial mt-1 text-xl font-semibold">Choose your translation</h2>
            <p className="mt-1 text-sm text-muted">
              New passages open in this text. Change it anytime in Settings.
            </p>
            <select
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              aria-label="Default translation"
              className="mt-4 w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
            >
              {shelf.length === 0 && <option value="kjv">King James Version</option>}
              {shelf.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.abbrev})
                </option>
              ))}
            </select>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => finish("reading", false)}
                className="fx-press text-sm text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Open the book and go
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound("navigate");
                  setStep(2);
                }}
                className="fx-press rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div key="task" className="fx-fade">
            <h2 className="font-editorial mt-1 text-xl font-semibold">What brings you here?</h2>
            <p className="mt-1 text-sm text-muted">
              Pick a task and the workspace builds its layout around an open passage.
            </p>
            <div className="fx-stagger mt-4 grid gap-2">
              {LAYOUT_PRESETS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => finish(p.id, true)}
                  style={{ "--i": i } as CSSProperties}
                  className="glass glass-hover fx-bloom fx-press rounded-[4px] px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-muted">{p.blurb}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  playSound("close");
                  setStep(1);
                }}
                className="fx-press text-sm text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                Back
              </button>
              <p className="text-xs text-muted">No account, no tour. Your work stays on this device.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
