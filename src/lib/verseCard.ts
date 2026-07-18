/**
 * The letterpress verse card, shared by the old reader's margin and the
 * workspace context strip. Pure string building: safe to import from
 * client or server code. A print/export aid only; the card carries text,
 * reference, and translation tag, no ornament beyond the gold rule.
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

/** A letterpress card: paper, a double rule border, the verse in the reader
 *  serif, reference and translation tag. */
export function verseCardSvg(text: string, reference: string, abbrev: string): string {
  const W = 1200;
  const SERIF = `'EB Garamond','Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif`;
  const fontSize = 46;
  const lineHeight = 72;
  const lines = wrapCardText(text, 44);
  const topPad = 150;
  const bottomPad = 130;
  const textBlock = lines.length * lineHeight;
  const ruleGap = 64;
  const refY = topPad + textBlock + ruleGap + 56;
  const tagY = refY + 48;
  const H = tagY + bottomPad;
  const textLines = lines
    .map(
      (line, i) =>
        `  <text x="${W / 2}" y="${topPad + i * lineHeight}" text-anchor="middle" font-family="${SERIF}" font-size="${fontSize}" fill="#262016">${escapeXml(line)}</text>`
    )
    .join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `  <rect width="${W}" height="${H}" fill="#faf5e9"/>`,
    `  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#d9cdb4" stroke-width="3"/>`,
    `  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#d9cdb4" stroke-width="1"/>`,
    textLines,
    `  <line x1="${W / 2 - 60}" y1="${topPad + textBlock + ruleGap}" x2="${W / 2 + 60}" y2="${topPad + textBlock + ruleGap}" stroke="#c9a227" stroke-width="2"/>`,
    `  <text x="${W / 2}" y="${refY}" text-anchor="middle" font-family="${SERIF}" font-size="30" letter-spacing="4" fill="#262016">${escapeXml(reference.toUpperCase())}</text>`,
    `  <text x="${W / 2}" y="${tagY}" text-anchor="middle" font-family="${SERIF}" font-size="22" letter-spacing="3" fill="#6d5f4b">${escapeXml(abbrev)}</text>`,
    `</svg>`,
    "",
  ].join("\n");
}
