/**
 * Sharing a composed card through the device's own share sheet (the Web
 * Share API). The card is an SVG and it goes as an SVG: there is no PNG
 * conversion in the renderers, and rasterizing one here would pretend at a
 * fidelity the card never had. Some targets refuse SVG files; where the
 * sheet will not take the file the caller keeps its download path and the
 * Share button stays hidden.
 *
 * Client-only by construction: every entry point guards on `navigator`, so
 * the module is safe to import from server-rendered client components.
 */

/** True where the device offers a share sheet at all; false on the server. */
export function shareSheetAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** True where the sheet will take this card as a file. */
export function canShareCard(filename: string): boolean {
  if (!shareSheetAvailable()) return false;
  if (typeof navigator.canShare !== "function") return true;
  try {
    return navigator.canShare({
      files: [new File([""], filename, { type: "image/svg+xml" })],
    });
  } catch {
    return false;
  }
}

/**
 * Shares the card as an SVG file named for its passage. Answers "shared",
 * "cancelled" (the user dismissed the sheet, not an error), or "failed"
 * (no sheet, the file refused, or the sheet itself erred), so the caller
 * can fall back to its download honestly.
 */
export async function shareCard(
  svg: string,
  filename: string,
  title: string
): Promise<"shared" | "cancelled" | "failed"> {
  if (!canShareCard(filename)) return "failed";
  try {
    await navigator.share({
      files: [new File([svg], filename, { type: "image/svg+xml" })],
      title,
    });
    return "shared";
  } catch (err) {
    return err instanceof DOMException && err.name === "AbortError" ? "cancelled" : "failed";
  }
}
