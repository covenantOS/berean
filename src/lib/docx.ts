/**
 * A real .docx writer with no dependencies: the OOXML minimal part set
 * packed into a ZIP of STORE entries (nothing compressed), the CRC32
 * hand-rolled from the polynomial table. Five parts ride in every file:
 * [Content_Types].xml, _rels/.rels, word/document.xml, word/styles.xml, and
 * the document part's own .rels, which Word requires before it honors the
 * styles part at all.
 *
 * The Markdown the Writing Desk preaches from maps onto Word's own styles,
 * following the shared renderer (src/components/shell/markdown.tsx):
 * headings become Heading 1-3 (deeper levels clamp to 3, as the renderer
 * clamps), quote blocks become Quote, typed callouts become a small-caps
 * label paragraph and a content paragraph in the kind's own style, lists
 * become indented paragraphs carrying their literal marks (no numbering
 * part, so the bullets and numbers are text and never renumber), bold and
 * italic become run properties, and footnote marks become superscript, the
 * honest inline form the renderer already gives them. External links keep
 * their URL in parentheses after the text; app-relative links carry their
 * text alone, since the workspace means nothing outside it.
 */

import { CALLOUT_KINDS, calloutOf } from "./documents";

/* ---------- CRC32 (ISO 3309, the ZIP polynomial) ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC32 of a byte run, exported so the packer and the tests share it. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- ZIP: STORE entries only, no compression ---------- */

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/* A fixed DOS date (1980-01-01): the archive's bytes carry no clock, so two
 * exports of the same document differ only where the document differs. */
const DOS_TIME = 0;
const DOS_DATE = 0x21;

/**
 * Packs the entries into a ZIP archive with every member STORED. The layout
 * is the spec's: local headers with their data in order, the central
 * directory pointing back at each local header, and the end record closing
 * it. Offsets and sizes are honest because nothing is compressed.
 */
function zipStore(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, entry.data);

    const record = new Uint8Array(46 + name.length);
    const cv = new DataView(record.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory record
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); // local header offset
    record.set(name, 46);
    central.push(record);

    offset += local.length + entry.data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true); // where the central directory begins

  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const chunk of [...parts, ...central, end]) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/* ---------- The document part: Markdown to Word paragraphs ---------- */

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  superscript?: boolean;
}

/* The inline grammar, the same marks the renderer reads: links, bold,
 * italic, and footnote marks (a definition's [^1]: never matches, the (?!:)
 * the renderer carries). */
const INLINE_RE =
  /(\[([^\]]+)\]\((\/[^)\s]*|https?:[^)\s]*)\)|\*\*[^*]+\*\*|\*[^*]+\*|\[\^\w+\](?!:))/g;

function inlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    const tok = m[0];
    if (m[2] !== undefined && m[3] !== undefined) {
      runs.push({ text: m[2] });
      /* An external link keeps its URL beside the text; an app path carries
       * its text alone. */
      if (/^https?:/.test(m[3])) runs.push({ text: ` (${m[3]})` });
    } else if (tok.startsWith("**")) {
      runs.push({ text: tok.slice(2, -2), bold: true });
    } else if (tok.startsWith("*")) {
      runs.push({ text: tok.slice(1, -1), italic: true });
    } else {
      runs.push({ text: tok.slice(2, -1), superscript: true });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

function para(style: string | null, runs: Run[]): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  const rs = runs
    .map((r) => {
      let rPr = "";
      if (r.bold) rPr += "<w:b/>";
      if (r.italic) rPr += "<w:i/>";
      if (r.superscript) rPr += '<w:vertAlign w:val="superscript"/>';
      return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
    })
    .join("");
  return `<w:p>${pPr}${rs}</w:p>`;
}

/* The block walk mirrors renderMarkdown: same splits, same tests, so the
 * .docx reads as the preaching view does. */
function documentXml(title: string, body: string): string {
  const paras: string[] = [para("Title", [{ text: title }])];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split("\n");
    const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
    if (heading && lines.length === 1) {
      const depth = Math.min(heading[1].length, 3);
      paras.push(para(`Heading${depth}`, inlineRuns(heading[2])));
      continue;
    }
    if (lines.every((l) => /^>\s?/.test(l))) {
      const callout = calloutOf(lines);
      if (callout) {
        const label = CALLOUT_KINDS.find((k) => k.key === callout.kind)?.label ?? callout.kind;
        paras.push(para("CalloutLabel", [{ text: label }]));
        const text = callout.content
          .map((l) => l.replace(/^>\s?/, ""))
          .join(" ")
          .trim();
        if (text) {
          paras.push(
            para(
              callout.kind === "illustration" ? "CalloutIllustration" : "CalloutQuestion",
              inlineRuns(text)
            )
          );
        }
        continue;
      }
      const text = lines
        .map((l) => l.replace(/^>\s?/, ""))
        .join(" ")
        .trim();
      paras.push(para("Quote", inlineRuns(text)));
      continue;
    }
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      for (const l of lines) {
        paras.push(para("ListParagraph", [{ text: "• " }, ...inlineRuns(l.replace(/^[-*]\s+/, ""))]));
      }
      continue;
    }
    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      for (const l of lines) {
        const m = /^(\d+[.)])\s+(.*)$/.exec(l);
        paras.push(para("ListParagraph", [{ text: `${m?.[1] ?? ""} ` }, ...inlineRuns(m?.[2] ?? l)]));
      }
      continue;
    }
    paras.push(para(null, inlineRuns(lines.join(" "))));
  }
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${paras.join("")}` +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
    "</w:sectPr></w:body></w:document>"
  );
}

/* The styles part: Normal in a serif face, the heading chain Word's
 * navigation pane recognizes (the name "heading N" is the key), Quote and
 * the callout styles with the renderer's quiet indents and italics, and
 * List Paragraph for the literal-marked lists. */
const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  "<w:docDefaults><w:rPrDefault><w:rPr>" +
  '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="22"/>' +
  "</w:rPr></w:rPrDefault></w:docDefaults>" +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
  '<w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Title">' +
  '<w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1">' +
  '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>' +
  '<w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2">' +
  '<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr>' +
  '<w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading3">' +
  '<w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="2"/></w:pPr>' +
  '<w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Quote">' +
  '<w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/><w:color w:val="595959"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="ListParagraph">' +
  '<w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:ind w:left="720"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="CalloutLabel">' +
  '<w:name w:val="Callout Label"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:spacing w:before="240"/></w:pPr>' +
  '<w:rPr><w:smallCaps/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="CalloutIllustration">' +
  '<w:name w:val="Callout Illustration"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="CalloutQuestion">' +
  '<w:name w:val="Callout Question"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:ind w:left="360"/></w:pPr></w:style>' +
  "</w:styles>";

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const DOCUMENT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

/**
 * The manuscript as a real .docx: the title in the Title style, then the
 * body's blocks mapped as above. The bytes are ready for a Blob download;
 * Word, LibreOffice, and Google Docs all open the result.
 */
export function docxFor(title: string, body: string): Uint8Array {
  const encoder = new TextEncoder();
  return zipStore([
    { name: "[Content_Types].xml", data: encoder.encode(CONTENT_TYPES_XML) },
    { name: "_rels/.rels", data: encoder.encode(ROOT_RELS_XML) },
    { name: "word/_rels/document.xml.rels", data: encoder.encode(DOCUMENT_RELS_XML) },
    { name: "word/document.xml", data: encoder.encode(documentXml(title, body)) },
    { name: "word/styles.xml", data: encoder.encode(STYLES_XML) },
  ]);
}
