import { RIGHTS_REGISTRY } from "@/lib/rights";

/**
 * The library catalog as a spreadsheet download: every registered work with
 * its rights and provenance metadata, straight from the registry
 * (src/lib/rights.ts), so the export can never drift from what the app
 * itself reports. Planned and pending entries ride along with their status;
 * a catalog that hides them would overstate the shelf.
 */

const COLUMNS: [string, (r: (typeof RIGHTS_REGISTRY)[number]) => string][] = [
  ["id", (r) => r.id],
  ["title", (r) => r.title],
  ["kind", (r) => r.kind],
  ["status", (r) => r.status],
  ["rights_holder", (r) => r.rightsHolder],
  ["license", (r) => r.license],
  ["territory_notes", (r) => r.territoryNotes ?? ""],
  ["allowed_uses", (r) => r.allowedUses.join("; ")],
  ["source", (r) => r.source],
  ["source_retrieved", (r) => r.sourceRetrieved],
  ["notes", (r) => r.notes ?? ""],
];

/** RFC 4180 escaping: quote fields carrying commas, quotes, or newlines. */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function GET() {
  const lines = [
    COLUMNS.map(([name]) => name).join(","),
    ...RIGHTS_REGISTRY.map((r) => COLUMNS.map(([, get]) => cell(get(r))).join(",")),
  ];
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="berean-library-catalog.csv"',
    },
  });
}
