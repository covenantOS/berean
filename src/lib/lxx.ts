/**
 * Septuagint versification notes.
 *
 * The Brenton English and Greek LXX columns keep the LXX's own chapter and
 * verse numbering. Where that numbering diverges from the KJV/Hebrew count
 * the reader shows the note from this table rather than silently misaligning
 * verses. Gaps in either direction render as an honest dash.
 */

export const LXX_TRANSLATION_IDS = new Set(["brenton", "lxx"]);

export function isLxxTranslation(id: string): boolean {
  return LXX_TRANSLATION_IDS.has(id);
}

/**
 * A short notice for chapters where LXX numbering diverges from the KJV, or
 * null when the two counts agree. Deliberately conservative: only well-known,
 * structural divergences are called out.
 */
export function lxxNumberingNote(slug: string, chapter: number): string | null {
  switch (slug) {
    case "psalms":
      if (chapter >= 10 && chapter <= 146) {
        return `Septuagint numbering differs here: this psalm is Psalm ${chapter - 1} in the LXX. The LXX column shows the LXX's own Psalm ${chapter}, which corresponds to KJV Psalm ${chapter + 1}.`;
      }
      if (chapter === 147) {
        return "Septuagint numbering differs here: the LXX splits this psalm into Psalms 146 and 147. The LXX column shows its Psalm 147 (KJV 147:12-20).";
      }
      return null;
    case "esther":
      return "The Septuagint's Esther carries the Greek additions interleaved as lettered verses (1b-1s and so on); the brackets in the LXX text mark material not in the Hebrew Esther.";
    case "malachi":
      return chapter === 4
        ? "The Septuagint counts KJV Malachi 4:1-6 as 3:19-24; there is no Malachi 4 in the LXX."
        : chapter === 3
          ? "KJV Malachi 4:1-6 appears in the Septuagint as 3:19-24, at the end of this chapter."
          : null;
    case "joel":
      if (chapter === 2) {
        return "The Septuagint counts KJV 2:28-32 as its own chapter (Joel 3); the LXX chapter 2 ends at verse 27.";
      }
      if (chapter === 3) {
        return "Septuagint numbering differs here: the LXX's Joel 3 is KJV 2:28-32, and KJV chapter 3 is Joel 4 in the LXX. The LXX column shows the LXX's own chapter 3; LXX Joel 4 is not reachable in this three-chapter book view.";
      }
      return null;
    case "daniel":
      return chapter === 3
        ? "The Greek Daniel includes the Prayer of Azariah within chapter 3, so LXX verse numbers run well past the KJV's 30 verses; the extra verses are shown after verse 30. Susanna and Bel and the Dragon are separate LXX books and are not served here."
        : null;
    case "1-kings":
      return chapter === 2
        ? "The Septuagint inserts additional material in 1 Kings 2 as lettered verses (35a-35o, 46a-46l), shown in place with their LXX labels."
        : null;
    case "job":
      return chapter === 42
        ? "The Septuagint appends a postscript to Job as lettered verses 17a-17e, shown in place with their LXX labels."
        : null;
    case "jeremiah":
      return "The Septuagint's Jeremiah is about an eighth shorter than the Hebrew and arranges material differently (the oracles against the nations follow 25:13); the LXX column keeps the LXX's own numbering, so correspondence with the KJV column is approximate.";
    case "proverbs":
      return chapter >= 24
        ? "The Septuagint arranges the later chapters of Proverbs in a different order; correspondence with the KJV column is approximate."
        : null;
    default:
      return null;
  }
}
