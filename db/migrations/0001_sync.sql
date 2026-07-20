-- Sync v1 server schema (ADR 0002, src/lib/sync.ts, src/lib/sync-server.ts).
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

-- berean.marginalia.v1
CREATE TABLE IF NOT EXISTS sync_berean_marginalia_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_marginalia_v1_user_seq ON sync_berean_marginalia_v1 ("userId", seq);


-- berean.highlights.v1
CREATE TABLE IF NOT EXISTS sync_berean_highlights_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_highlights_v1_user_seq ON sync_berean_highlights_v1 ("userId", seq);


-- berean.highlightstyles.v1
CREATE TABLE IF NOT EXISTS sync_berean_highlightstyles_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_highlightstyles_v1_user_seq ON sync_berean_highlightstyles_v1 ("userId", seq);


-- berean.copystyles.v1
CREATE TABLE IF NOT EXISTS sync_berean_copystyles_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_copystyles_v1_user_seq ON sync_berean_copystyles_v1 ("userId", seq);


-- berean.visualfilters.v1
CREATE TABLE IF NOT EXISTS sync_berean_visualfilters_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_visualfilters_v1_user_seq ON sync_berean_visualfilters_v1 ("userId", seq);


-- berean.librarymeta.v1
CREATE TABLE IF NOT EXISTS sync_berean_librarymeta_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_librarymeta_v1_user_seq ON sync_berean_librarymeta_v1 ("userId", seq);


-- berean.projects.v1
CREATE TABLE IF NOT EXISTS sync_berean_projects_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_projects_v1_user_seq ON sync_berean_projects_v1 ("userId", seq);


-- berean.documents.v1
CREATE TABLE IF NOT EXISTS sync_berean_documents_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_documents_v1_user_seq ON sync_berean_documents_v1 ("userId", seq);


-- berean.listdocs.v1
CREATE TABLE IF NOT EXISTS sync_berean_listdocs_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_listdocs_v1_user_seq ON sync_berean_listdocs_v1 ("userId", seq);


-- berean.liturgies.v1
CREATE TABLE IF NOT EXISTS sync_berean_liturgies_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_liturgies_v1_user_seq ON sync_berean_liturgies_v1 ("userId", seq);


-- berean.liturgy-templates.v1
CREATE TABLE IF NOT EXISTS sync_berean_liturgy_templates_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_liturgy_templates_v1_user_seq ON sync_berean_liturgy_templates_v1 ("userId", seq);


-- berean.plans.v1
CREATE TABLE IF NOT EXISTS sync_berean_plans_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_plans_v1_user_seq ON sync_berean_plans_v1 ("userId", seq);


-- berean.prayers.v1
CREATE TABLE IF NOT EXISTS sync_berean_prayers_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_prayers_v1_user_seq ON sync_berean_prayers_v1 ("userId", seq);


-- berean.memory.v1
CREATE TABLE IF NOT EXISTS sync_berean_memory_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_memory_v1_user_seq ON sync_berean_memory_v1 ("userId", seq);


-- berean.calendar.v1
CREATE TABLE IF NOT EXISTS sync_berean_calendar_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_calendar_v1_user_seq ON sync_berean_calendar_v1 ("userId", seq);


-- berean.rule.v1
CREATE TABLE IF NOT EXISTS sync_berean_rule_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_rule_v1_user_seq ON sync_berean_rule_v1 ("userId", seq);


-- berean.settings.v1
CREATE TABLE IF NOT EXISTS sync_berean_settings_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_settings_v1_user_seq ON sync_berean_settings_v1 ("userId", seq);


-- berean.layouts.v1
CREATE TABLE IF NOT EXISTS sync_berean_layouts_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_layouts_v1_user_seq ON sync_berean_layouts_v1 ("userId", seq);


-- berean.favorites.v1
CREATE TABLE IF NOT EXISTS sync_berean_favorites_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_favorites_v1_user_seq ON sync_berean_favorites_v1 ("userId", seq);


-- berean.guides.v1
CREATE TABLE IF NOT EXISTS sync_berean_guides_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_guides_v1_user_seq ON sync_berean_guides_v1 ("userId", seq);


-- berean.collections.v1
CREATE TABLE IF NOT EXISTS sync_berean_collections_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_collections_v1_user_seq ON sync_berean_collections_v1 ("userId", seq);


-- berean.active-collection.v1
CREATE TABLE IF NOT EXISTS sync_berean_active_collection_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_active_collection_v1_user_seq ON sync_berean_active_collection_v1 ("userId", seq);


-- berean.workflows.v1
CREATE TABLE IF NOT EXISTS sync_berean_workflows_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_workflows_v1_user_seq ON sync_berean_workflows_v1 ("userId", seq);


-- berean.customworkflows.v1
CREATE TABLE IF NOT EXISTS sync_berean_customworkflows_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_customworkflows_v1_user_seq ON sync_berean_customworkflows_v1 ("userId", seq);


-- berean.canvases.v1
CREATE TABLE IF NOT EXISTS sync_berean_canvases_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_canvases_v1_user_seq ON sync_berean_canvases_v1 ("userId", seq);


-- berean.diagrams.v1
CREATE TABLE IF NOT EXISTS sync_berean_diagrams_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_diagrams_v1_user_seq ON sync_berean_diagrams_v1 ("userId", seq);


-- berean.personalbooks.v1
CREATE TABLE IF NOT EXISTS sync_berean_personalbooks_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_personalbooks_v1_user_seq ON sync_berean_personalbooks_v1 ("userId", seq);


-- berean.printbooks.v1
CREATE TABLE IF NOT EXISTS sync_berean_printbooks_v1 (
  "userId"    text        NOT NULL,
  id          text        NOT NULL,
  record      jsonb       NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  seq         bigint      NOT NULL DEFAULT nextval('sync_commit_seq'),
  PRIMARY KEY ("userId", id)
);
-- The pull pattern: rows for one user committed after a cursor, in commit order.
CREATE INDEX IF NOT EXISTS sync_berean_printbooks_v1_user_seq ON sync_berean_printbooks_v1 ("userId", seq);

COMMIT;
