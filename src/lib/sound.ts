"use client";

import { useEffect, useState } from "react";

/**
 * The study's small bells: hand-rolled WebAudio chimes with no assets.
 * Every sound is one or two bell voices, a sine fundamental carrying a
 * soft triangle partial an octave up, struck with a fast attack and left
 * to decay exponentially. Sound is motion's sibling: it answers what
 * opened, what closed, and what finished, never louder than a page turn.
 *
 * Preferences live in one device-local key (berean.sound.v1) shaped
 * { enabled, volume }, defaulting to on at a low volume, and follow the
 * subscribe idiom of display.ts so controls on two surfaces never drift.
 * The AudioContext is created lazily on the first play, which only ever
 * happens inside a user gesture, so autoplay policy holds by construction.
 * Every entry point no-ops when audio is unavailable, suspended, or off:
 * a missing chime must never take the workspace down with it.
 */

export const SOUND_KEY = "berean.sound.v1";

export type SoundName =
  | "open"
  | "close"
  | "toggle-on"
  | "toggle-off"
  | "navigate"
  | "complete"
  | "error";

export interface SoundPrefs {
  enabled: boolean;
  /** 0..1, applied to a quiet master register. */
  volume: number;
}

const DEFAULTS: SoundPrefs = { enabled: true, volume: 0.25 };

function readPrefs(): SoundPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(SOUND_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS.enabled,
      volume:
        typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULTS.volume,
    };
  } catch {
    return DEFAULTS;
  }
}

/* Same-tab change notice, the display.ts idiom: the storage event only
 * fires across tabs, and two sound controls can be mounted at once. */
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function soundEnabled(): boolean {
  return readPrefs().enabled;
}

export function soundVolume(): number {
  return readPrefs().volume;
}

function writePrefs(prefs: SoundPrefs) {
  try {
    window.localStorage.setItem(SOUND_KEY, JSON.stringify(prefs));
  } catch {
    /* Storage blocked or full: the session keeps its sounds. */
  }
  notify();
}

export function setSoundEnabled(enabled: boolean) {
  writePrefs({ ...readPrefs(), enabled });
}

export function setSoundVolume(volume: number) {
  writePrefs({ ...readPrefs(), volume: Math.min(1, Math.max(0, volume)) });
}

/** The current prefs, hydrated after mount and re-read on every change. */
export function useSoundPrefs(): SoundPrefs {
  const [prefs, setPrefs] = useState<SoundPrefs>(DEFAULTS);
  useEffect(() => {
    const read = () => setPrefs(readPrefs());
    read();
    return subscribeSound(read);
  }, []);
  return prefs;
}

/* ---------- the bell voices ---------- */

let ctx: AudioContext | null = null;

/** Lazily creates and resumes the context; null where audio cannot run. */
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface BellNote {
  /** Hz of the sine fundamental. */
  freq: number;
  /** Seconds after the phrase starts. */
  at: number;
  /** Seconds of decay. */
  dur: number;
  /** Relative loudness within the phrase, 0..1; defaults to 1. */
  peak?: number;
}

/**
 * One bell voice: a sine fundamental with a triangle partial a slightly
 * detuned octave up (the glassy edge of a small bell), a 4ms attack, and
 * an exponential decay. The master gain carries the user's volume, and a
 * lowpass keeps the partial round.
 */
function bell(ac: AudioContext, note: BellNote, master: GainNode) {
  const t0 = ac.currentTime + note.at;
  const peak = (note.peak ?? 1) * 0.5;

  const fundamental = ac.createOscillator();
  fundamental.type = "sine";
  fundamental.frequency.value = note.freq;

  const partial = ac.createOscillator();
  partial.type = "triangle";
  partial.frequency.value = note.freq * 2.01;

  const envelope = ac.createGain();
  envelope.gain.setValueAtTime(0, t0);
  envelope.gain.linearRampToValueAtTime(peak, t0 + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);

  const partialGain = ac.createGain();
  partialGain.gain.value = 0.28;

  fundamental.connect(envelope);
  partial.connect(partialGain);
  partialGain.connect(envelope);
  envelope.connect(master);

  fundamental.start(t0);
  partial.start(t0);
  fundamental.stop(t0 + note.dur + 0.05);
  partial.stop(t0 + note.dur + 0.05);
}

/*
 * The kit, in the pitch grammar the ear already knows: rising figures open
 * and switch on, falling figures close and switch off, a single struck
 * note navigates, a three-note arpeggio completes, and a low soft cluster
 * says something went wrong without scolding.
 */
const KIT: Record<SoundName, BellNote[]> = {
  open: [
    { freq: 523.25, at: 0, dur: 0.3 },
    { freq: 784.0, at: 0.07, dur: 0.38 },
  ],
  close: [
    { freq: 784.0, at: 0, dur: 0.26 },
    { freq: 523.25, at: 0.07, dur: 0.32 },
  ],
  "toggle-on": [
    { freq: 659.25, at: 0, dur: 0.16 },
    { freq: 987.77, at: 0.05, dur: 0.24 },
  ],
  "toggle-off": [
    { freq: 987.77, at: 0, dur: 0.14 },
    { freq: 659.25, at: 0.05, dur: 0.2 },
  ],
  navigate: [{ freq: 880.0, at: 0, dur: 0.2 }],
  complete: [
    { freq: 523.25, at: 0, dur: 0.3 },
    { freq: 659.25, at: 0.09, dur: 0.3 },
    { freq: 880.0, at: 0.18, dur: 0.5 },
  ],
  error: [
    { freq: 233.08, at: 0, dur: 0.4, peak: 0.7 },
    { freq: 246.94, at: 0.02, dur: 0.4, peak: 0.5 },
  ],
};

/**
 * Plays a chime by name. No-ops silently when sound is off, the volume is
 * zero, the context cannot start, or anything in the audio path throws.
 */
export function playSound(name: SoundName) {
  try {
    const prefs = readPrefs();
    if (!prefs.enabled || prefs.volume <= 0) return;
    const ac = audioContext();
    if (!ac) return;
    const master = ac.createGain();
    master.gain.value = Math.pow(prefs.volume, 1.5) * 0.4;
    const lowpass = ac.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 4200;
    master.connect(lowpass);
    lowpass.connect(ac.destination);
    for (const note of KIT[name]) bell(ac, note, master);
  } catch {
    /* A chime is never worth an exception. */
  }
}
