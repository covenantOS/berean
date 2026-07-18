import { promises as fs } from "fs";
import path from "path";

/**
 * Chapter audio lookup for the reader's Listen control.
 *
 * data/audio/manifest.json is built by scripts/build-audio.mjs from
 * public-domain LibriVox KJV recordings on archive.org (rights registry id
 * "librivox-kjv-audio"). Audio is streamed from archive.org; nothing is
 * vendored. Chapters with no per-chapter recording simply have no entry.
 */

export interface ChapterAudio {
  /** archive.org streaming URL for the chapter's MP3. */
  url: string;
  /** Reader credit from the LibriVox item, when stated. */
  reader: string | null;
  /** Recording length in seconds, when the metadata carries it. */
  seconds: number | null;
  /** archive.org item page, for provenance. */
  sourceUrl: string;
}

interface AudioManifest {
  generated: string;
  sources: Record<string, { title: string; license: string; reader: string | null }>;
  chapters: Record<string, { src: string; file: string; seconds: number | null }>;
}

let cache: AudioManifest | null | undefined;

async function loadManifest(): Promise<AudioManifest | null> {
  if (cache !== undefined) return cache;
  try {
    const file = path.join(process.cwd(), "data", "audio", "manifest.json");
    cache = JSON.parse(await fs.readFile(file, "utf8")) as AudioManifest;
  } catch {
    cache = null;
  }
  return cache;
}

/** The recording for one chapter, or null when none is mapped. */
export async function getChapterAudio(
  slug: string,
  chapter: number
): Promise<ChapterAudio | null> {
  const manifest = await loadManifest();
  const entry = manifest?.chapters[`${slug}:${chapter}`];
  if (!manifest || !entry) return null;
  const source = manifest.sources[entry.src];
  return {
    url: `https://archive.org/download/${entry.src}/${entry.file}`,
    reader: source?.reader ?? null,
    seconds: entry.seconds,
    sourceUrl: `https://archive.org/details/${entry.src}`,
  };
}
