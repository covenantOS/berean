import type { Metadata } from "next";
import { RIGHTS_REGISTRY } from "@/lib/rights";

export const metadata: Metadata = { title: "Sources & Rights" };

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  shipped: { label: "Shipped", cls: "text-emerald border-emerald" },
  "pending-license": { label: "Pending license", cls: "text-amber border-amber" },
  planned: { label: "Planned", cls: "text-muted border-rule" },
};

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Sources &amp; Rights</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        Every text Berean presents carries a documented source and license.
        Nothing is shipped, searched, quoted, exported, or indexed for the
        Scribe until its rights entry permits that exact use. A safe fallback
        applies wherever access is missing: the resource simply is not shown.
      </p>

      <div className="space-y-6">
        {RIGHTS_REGISTRY.map((r) => {
          const status = STATUS_LABEL[r.status];
          return (
            <section key={r.id} className="rounded-[4px] border border-rule bg-surface p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-editorial text-lg font-bold">{r.title}</h2>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}
                >
                  {status.label}
                </span>
              </div>
              <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
                <Row label="Kind" value={r.kind.replace("-", " ")} />
                <Row label="Rights holder" value={r.rightsHolder} />
                <Row label="License" value={r.license} />
                <Row
                  label="Source"
                  value={
                    r.source.startsWith("http") ? (
                      <a href={r.source} className="break-all text-sapphire" rel="noopener">
                        {r.source}
                      </a>
                    ) : (
                      r.source
                    )
                  }
                />
                <Row label="Retrieved" value={r.sourceRetrieved} />
                <Row
                  label="Allowed uses"
                  value={r.allowedUses.length ? r.allowedUses.join(", ") : "none yet"}
                />
              </dl>
              {r.territoryNotes && (
                <p className="mt-3 text-xs text-muted">
                  <span className="font-medium">Territory:</span> {r.territoryNotes}
                </p>
              )}
              {r.notes && <p className="mt-2 text-xs text-muted">{r.notes}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="small-caps shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
