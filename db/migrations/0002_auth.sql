-- Auth schema for better-auth 1.6 (src/lib/auth.ts), plugins: magicLink and
-- anonymous. Generated from `npx @better-auth/cli generate` and translated
-- to Postgres types: booleans for the integer flags, timestamptz for the
-- date columns. These are better-auth's own tables; the sync tables in
-- 0001_sync.sql never reference them, and the "userId" column there carries
-- this schema's "user".id when a session resolves, with no foreign key: a
-- namespace slug and an account id share one column by design.
--
-- Apply after 0001_sync.sql on the Neon database (see DEPLOY.md). The sqlite
-- dev dialect needs no such file: `npx @better-auth/cli migrate` creates the
-- same tables locally.

BEGIN;

CREATE TABLE IF NOT EXISTS "user" (
  id              text        PRIMARY KEY,
  name            text        NOT NULL,
  email           text        NOT NULL UNIQUE,
  "emailVerified" boolean     NOT NULL,
  image           text,
  "createdAt"     timestamptz NOT NULL,
  "updatedAt"     timestamptz NOT NULL,
  -- anonymous plugin: true for a server-side identity with no email address.
  "isAnonymous"   boolean
);

CREATE TABLE IF NOT EXISTS "session" (
  id          text        PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token       text        NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId"    text        NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  id                     text        PRIMARY KEY,
  "accountId"            text        NOT NULL,
  "providerId"           text        NOT NULL,
  "userId"               text        NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  "accessToken"          text,
  "refreshToken"         text,
  "idToken"              text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                  text,
  password               text,
  "createdAt"            timestamptz NOT NULL,
  "updatedAt"            timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

-- Magic-link tokens ride here: identifier is the email, value the token.
CREATE TABLE IF NOT EXISTS "verification" (
  id          text        PRIMARY KEY,
  identifier  text        NOT NULL,
  value       text        NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" (identifier);

COMMIT;
