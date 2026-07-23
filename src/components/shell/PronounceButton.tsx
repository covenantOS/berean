"use client";

import { pronounceLemma, useSpeechAvailable, type PronounceLang } from "@/lib/pronounce";
import { SpeakerIcon } from "./icons";

/**
 * The small speaker glyph the lexical surfaces carry, in the quiet idiom:
 * structural ink until hovered, press feedback, a focus ring. It speaks
 * the lemma in the original script when the platform furnishes a matching
 * voice and the transliteration through the default voice otherwise
 * (src/lib/pronounce.ts states the rule in full). Where system speech
 * cannot run the glyph stays hidden rather than offering a dead button.
 */
export default function PronounceButton({
  lemma,
  xlit,
  lang,
  className = "",
}: {
  lemma?: string;
  xlit?: string;
  lang: PronounceLang | null;
  className?: string;
}) {
  const available = useSpeechAvailable();
  if (!available || (!lemma && !xlit)) return null;
  const label = lemma ?? xlit ?? "";
  return (
    <button
      type="button"
      title={`Hear ${label} spoken`}
      aria-label={`Hear ${label} spoken`}
      onClick={() => pronounceLemma({ lemma, xlit, lang })}
      className={`fx-press inline-flex items-center self-center text-muted hover:text-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire ${className}`}
    >
      <SpeakerIcon />
    </button>
  );
}
