/**
 * The letterpress verse card, shared by the old reader's margin, the
 * workspace context strip, and the Media studio. Pure string building: safe
 * to import from client or server code. A print/export aid only; the card
 * carries text, reference, and translation tag, no ornament beyond the gold
 * rule.
 */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Approximate word wrap for the card's serif at a given measure. */
function wrapCardText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (trial.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The sharing frames the studio offers; "auto" lets the verse set the height. */
export type VerseCardSize = "auto" | "square" | "landscape" | "story";

/** The card's two lights: paper for daylight, candlelight for the dark study. */
export type VerseCardTheme = "paper" | "candlelight";

export interface VerseCardOptions {
  size?: VerseCardSize;
  theme?: VerseCardTheme;
  /** The reference line; shown unless asked away. */
  reference?: boolean;
  /** The translation tag; shown unless asked away. */
  translation?: boolean;
}

/* The fixed frames, named for where the cards are shared: square and story
 * for the social feeds, landscape for a slide or a wide post. */
const FRAMES: Record<Exclude<VerseCardSize, "auto">, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  landscape: { w: 1600, h: 900 },
  story: { w: 1080, h: 1920 },
};

/* The shell's own palettes (globals.css): the paper card the margin has
 * always exported, and the same card drawn in the candlelight colors. */
const PALETTES: Record<
  VerseCardTheme,
  { bg: string; rule: string; ink: string; muted: string; gold: string }
> = {
  paper: { bg: "#faf5e9", rule: "#d9cdb4", ink: "#262016", muted: "#6d5f4b", gold: "#c9a227" },
  candlelight: {
    bg: "#1d1812",
    rule: "#3d3427",
    ink: "#e6d8bc",
    muted: "#a4906e",
    gold: "#d9b45e",
  },
};

/** Keeps the auto frame's arithmetic exact; fixed frames take decimals. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A letterpress card: paper, a double rule border, the verse in the reader
 *  serif, reference and translation tag. With no options the margin card of
 *  old: 1200 wide, as tall as the verse asks, in the paper palette. */
export function verseCardSvg(
  text: string,
  reference: string,
  abbrev: string,
  options: VerseCardOptions = {}
): string {
  const frame = options.size && options.size !== "auto" ? FRAMES[options.size] : null;
  const palette = PALETTES[options.theme ?? "paper"];
  const showRef = options.reference ?? true;
  const showTag = options.translation ?? true;
  const W = frame?.w ?? 1200;
  const s = W / 1200;
  const SERIF = `'EB Garamond','Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif`;
  let fontSize = round1(46 * s);
  let lineHeight = round1(72 * s);
  const maxChars = Math.max(28, Math.round(44 * s));
  let lines = wrapCardText(text, maxChars);
  const topPad = 150 * s;
  const bottomPad = 130 * s;
  const ruleGap = 64 * s;
  /* A fixed frame shrinks the type until the verse stands inside it; the
   * auto frame grows to the verse instead and never fits. */
  if (frame) {
    const room = frame.h - topPad - bottomPad - ruleGap - 120 * s;
    while (fontSize > 20 && lines.length * lineHeight > room) {
      fontSize = round1(fontSize * 0.92);
      lineHeight = round1(lineHeight * 0.92);
      lines = wrapCardText(text, Math.ceil((maxChars * 46 * s) / fontSize));
    }
  }
  const textBlock = lines.length * lineHeight;
  const refY = topPad + textBlock + ruleGap + 56 * s;
  const tagY = showRef ? refY + 48 * s : refY;
  const naturalH =
    showRef || showTag
      ? (showTag ? tagY : refY) + bottomPad
      : topPad + textBlock + bottomPad;
  /* On a fixed frame the composed block centers in the canvas; the border
   * stays full-bleed and does not move. */
  const dy = frame ? (frame.h - naturalH) / 2 : 0;
  const H = frame?.h ?? naturalH;
  const y = (v: number) => round1(v + dy);
  const textLines = lines
    .map(
      (line, i) =>
        `  <text x="${W / 2}" y="${y(topPad + i * lineHeight)}" text-anchor="middle" font-family="${SERIF}" font-size="${fontSize}" fill="${palette.ink}">${escapeXml(line)}</text>`
    )
    .join("\n");
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `  <rect width="${W}" height="${H}" fill="${palette.bg}"/>`,
    `  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="${palette.rule}" stroke-width="3"/>`,
    `  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${palette.rule}" stroke-width="1"/>`,
    textLines,
  ];
  if (showRef || showTag) {
    parts.push(
      `  <line x1="${W / 2 - 60}" y1="${y(topPad + textBlock + ruleGap)}" x2="${W / 2 + 60}" y2="${y(topPad + textBlock + ruleGap)}" stroke="${palette.gold}" stroke-width="2"/>`
    );
  }
  if (showRef) {
    parts.push(
      `  <text x="${W / 2}" y="${y(refY)}" text-anchor="middle" font-family="${SERIF}" font-size="${round1(30 * s)}" letter-spacing="${round1(4 * s)}" fill="${palette.ink}">${escapeXml(reference.toUpperCase())}</text>`
    );
  }
  if (showTag) {
    parts.push(
      `  <text x="${W / 2}" y="${y(tagY)}" text-anchor="middle" font-family="${SERIF}" font-size="${round1(22 * s)}" letter-spacing="${round1(3 * s)}" fill="${palette.muted}">${escapeXml(abbrev)}</text>`
    );
  }
  parts.push(`</svg>`, "");
  return parts.join("\n");
}

/**
 * Downloads the card as a PNG, the format every photo app and chat target
 * accepts. The SVG renders into a canvas at 2x for crispness; when the
 * browser cannot rasterize (older engines, blocked canvas), the SVG file
 * itself downloads instead, the previous behavior.
 */
export async function downloadCardPng(svg: string, filename: string): Promise<"png" | "svg"> {
  const base = filename.replace(/\.svg$/, "");
  try {
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
      });
      img.src = svgUrl;
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * 2;
      canvas.height = img.naturalHeight * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("canvas export failed");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return "png";
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return "svg";
  }
}
