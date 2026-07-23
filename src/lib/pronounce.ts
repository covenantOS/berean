"use client";

import { useEffect, useState } from "react";

/**
 * Pronunciation: a lemma spoken aloud by the platform's own speech voices.
 * No audio ships; the operating system's Greek or Hebrew voice reads the
 * original script when it furnishes one, and the fallback rule is honest:
 *
 *   - a matching voice reads the lemma in the original script;
 *   - without one, the default voice reads the transliteration, which is
 *     an English rendering of the sounds and stays intelligible;
 *   - with neither, the default voice reads the script itself. A rough
 *     reading answers the question; silence does not.
 *
 * The rate sits slightly slow, for clarity: a lemma is heard once, not
 * followed. Speech keeps the reader's one-at-a-time discipline (the
 * read-aloud wave's SpeechRun): starting a pronunciation retires whatever
 * the speech channel holds, and the SPEECH_TAKEN_EVENT tells the reader's
 * read-aloud to stand down so the two never talk over each other. Every
 * entry point no-ops where speech cannot run; a missing voice must never
 * take the workspace down with it.
 */

/** Names the moment the speech channel changes hands; the read-aloud retires. */
export const SPEECH_TAKEN_EVENT = "berean:speech-taken";

export type PronounceLang = "el" | "he";

/** Slightly slow, for clarity. */
const PRONOUNCE_RATE = 0.85;

/* The live utterance, pinned against the collector: some browsers collect
 * an utterance mid-speech and never fire its end (the SpeechRun lesson). */
let live: SpeechSynthesisUtterance | null = null;

/** True where system speech can run; the server render answers false. */
export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * The platform's voice for a language: el / el-GR for Greek, he / he-IL for
 * Hebrew (iw-IL on older platforms), matched on the voice's BCP 47 primary
 * subtag. Null when the platform furnishes none, so the caller falls back
 * honestly. Queried at speak time: Chrome populates the voice list
 * asynchronously after load, and every call here rides a user gesture.
 */
export function voiceForLang(lang: PronounceLang): SpeechSynthesisVoice | null {
  if (!speechAvailable()) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => {
        const primary = v.lang.toLowerCase().replace("_", "-").split("-")[0];
        return lang === "el" ? primary === "el" : primary === "he" || primary === "iw";
      }) ?? null
    );
  } catch {
    return null;
  }
}

/** The language a script implies, for words that carry no Strong's id. */
export function langOfScript(text: string): PronounceLang | null {
  if (/[\u0590-\u05FF]/.test(text)) return "he";
  if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(text)) return "el";
  return null;
}

/**
 * Speaks text once. In-flight speech is cancelled first: one voice at a
 * time, the reader's SpeechRun discipline. lang pins the matching platform
 * voice when one exists; null takes the default voice. Returns false where
 * speech cannot run, and a failed utterance never throws.
 */
export function pronounce(text: string, lang: PronounceLang | null): boolean {
  if (!speechAvailable()) return false;
  try {
    window.dispatchEvent(new Event(SPEECH_TAKEN_EVENT));
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = PRONOUNCE_RATE;
    const voice = lang ? voiceForLang(lang) : null;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    live = utterance;
    const retire = () => {
      if (live === utterance) live = null;
    };
    utterance.onend = retire;
    utterance.onerror = retire;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * The lemma rule stated above: the original script to a matching voice,
 * the transliteration to the default voice without one, the script to the
 * default voice when no transliteration exists. lang may be null; the
 * lemma's own script then names the language.
 */
export function pronounceLemma({
  lemma,
  xlit,
  lang,
}: {
  lemma?: string;
  xlit?: string;
  lang: PronounceLang | null;
}): boolean {
  const spokenLang = lang ?? (lemma ? langOfScript(lemma) : null);
  if (lemma && spokenLang && voiceForLang(spokenLang)) return pronounce(lemma, spokenLang);
  if (xlit) return pronounce(xlit, null);
  if (lemma) return pronounce(lemma, spokenLang);
  return false;
}

/**
 * Arms after mount, so the server render and the first client pass agree
 * (the ReaderPane idiom): affordances hide where speech cannot run rather
 * than offering a dead button.
 */
export function useSpeechAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(speechAvailable());
  }, []);
  return available;
}
