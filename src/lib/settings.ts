"use client";

import { collection, type Record_ } from "./store";

/**
 * The reader's profile — governed memory, not surveillance. Everything the
 * Scribe is allowed to know is written here explicitly, inspectable, and
 * deletable. Nothing is inferred behind the reader's back.
 */

export const CONFESSIONS = [
  "None declared",
  "Westminster Confession of Faith",
  "1689 London Baptist Confession",
  "Three Forms of Unity",
  "Thirty-Nine Articles",
  "Augsburg Confession",
  "Other (noted below)",
] as const;

export interface Profile extends Record_ {
  /** Singleton row; id is stable across writes. */
  confession: string;
  confessionNote: string;
  /** Free-text doctrinal and translation preferences the Scribe may read. */
  scribeCharge: string;
  /** Whether the Scribe may read project notes when drafting briefs. */
  scribeMayReadNotes: boolean;
}

const profiles = collection<Profile>("berean.settings.v1");

export function getProfile(): Profile | undefined {
  return profiles.list()[0];
}

export function saveProfile(patch: Partial<Omit<Profile, keyof Record_>>) {
  const existing = profiles.list()[0];
  if (existing) profiles.update(existing.id, patch);
  else
    profiles.create({
      confession: "None declared",
      confessionNote: "",
      scribeCharge: "",
      scribeMayReadNotes: false,
      ...patch,
    });
}

export function deleteProfile() {
  profiles.removeAll();
}

export { profiles };
