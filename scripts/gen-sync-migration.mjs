// Throwaway generator for db/migrations/0001_sync.sql: the collection list is
// copied from GRAPH_KEYS (src/lib/store.ts) so the schema stays one table per
// collection. Rerun by hand if GRAPH_KEYS grows; the migration itself is the
// artifact, this script is scaffolding.
import { mkdirSync, writeFileSync } from "node:fs";

const keys = [
  "berean.marginalia.v1",
  "berean.highlights.v1",
  "berean.highlightstyles.v1",
  "berean.copystyles.v1",
  "berean.visualfilters.v1",
  "berean.librarymeta.v1",
  "berean.projects.v1",
  "berean.documents.v1",
  "berean.listdocs.v1",
  "berean.liturgies.v1",
  "berean.liturgy-templates.v1",
  "berean.plans.v1",
  "berean.prayers.v1",
  "berean.memory.v1",
  "berean.calendar.v1",
  "berean.rule.v1",
  "berean.settings.v1",
  "berean.layouts.v1",
  "berean.favorites.v1",
  "berean.guides.v1",
  "berean.collections.v1",
  "berean.active-collection.v1",
  "berean.workflows.v1",
  "berean.customworkflows.v1",
  "berean.canvases.v1",
  "berean.diagrams.v1",
  "berean.personalbooks.v1",
  "berean.printbooks.v1",
];

const tbl = (k) => "sync_" + k.replace(/[^a-zA-Z0-9]/g, "_");

const header = `-- Sync v1 server schema (ADR 0002, src/lib/sync.ts, src/lib/sync-server.ts).
--
-- One table per GRAPH_KEYS collection, keyed ("userId", id). The "userId"
-- column carries the pre-auth namespace slug today and the identity subject
-- when accounts land; nothing else about the shape changes at that point.
-- "record" holds the whole sync envelope as jsonb, tombstones included, so
-- deletes travel. "updatedAt" mirrors the envelope stamp for indexing. "seq"
-- is the commit stamp from the shared sequence: the pull cursor is this
-- commit sequence, never a client updatedAt, so a record pushed late with an
-- old stamp still reaches every device on its next pull.
--
-- Merges are last-writer-wins decided in the application (lwwWinner in
-- src/lib/sync.ts); the tables hold rows, they do not arbitrate them.

BEGIN;

-- One sequence for every collection: gaps are harmless, and a single
-- sequence keeps the commit order total across a user's whole graph.
CREATE SEQUENCE IF NOT EXISTS sync_commit_seq;
`;

const body = keys
  .map(
    (k) => `
-- ${k}
CREATE TABLE IF NOT EXISTS ${tbl(k)} (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS ${tbl(k)}_user_seq ON ${tbl(k)} ("userId", seq);
`,
  )
  .join("\n");

mkdirSync("db/migrations", { recursive: true });
writeFileSync("db/migrations/0001_sync.sql", header + body + "\nCOMMIT;\n");
console.log(`written ${keys.length} collection tables`);
