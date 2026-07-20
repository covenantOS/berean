/**
 * Accounts: better-auth with magic-link email and anonymous sessions, the
 * identity half of ADR 0002. The app never requires an account; everything
 * here exists so a user who wants sync across devices can have one subject
 * the sync routes can trust (resolveNamespace in src/lib/sync-server.ts).
 *
 * Database dialect: when DATABASE_URL is set the account tables live in the
 * same Neon Postgres as the sync rows (db/migrations/0002_auth.sql); when it
 * is unset a local better-sqlite3 file serves dev and single-process
 * self-hosting, so the whole sign-in flow verifies with zero servers. The
 * sqlite side creates its tables automatically on first use; the pg side is
 * provisioned once, either with `npx @better-auth/cli migrate` or by
 * applying 0002_auth.sql. better-auth speaks to both through its Kysely
 * adapter; the schema is identical either way.
 *
 * Magic-link delivery: with RESEND_API_KEY and RESEND_FROM set the link goes
 * out as a real email through the Resend API (plain fetch; the SDK would add
 * a dependency for one POST). Without them the link is written to the server
 * log and the flow completes anyway, which is the honest dev mode: no mail
 * server, no pretense of one.
 *
 * genericOAuth stays unwired on purpose: the rebuild plan reserves social
 * sign-in for a later wave, and adding the plugin here would ship surface
 * area nobody asked for.
 */

import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { anonymous, magicLink } from "better-auth/plugins";
import { Pool } from "pg";
import path from "path";

/** The local dialect file. BEREAN_AUTH_DB overrides it; otherwise it is
 *  data/auth.db under the server's working directory, which is the repo
 *  root under `next dev`/`next start` and .next/standalone under
 *  `npm start` (the standalone server chdirs to its own directory; in the
 *  Docker image that directory is /app, so the file lands beside the data
 *  shelf either way). Gitignored; it holds account rows, never user work. */
const SQLITE_PATH =
  process.env.BEREAN_AUTH_DB ?? path.join(process.cwd(), "data", "auth.db");

/** Build the database handle for this deployment. The Pool connects lazily
 *  and the sqlite file opens on first read, so importing this module never
 *  touches a server. */
function authDatabase(): Pool | Database.Database {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return new Database(SQLITE_PATH);
}

/** The Resend POST that carries the link. Throws on a non-2xx so a failed
 *  delivery surfaces as a failed sign-in request instead of a lost email. */
async function sendViaResend(email: string, url: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: email,
      subject: "Your Berean sign-in link",
      text: `Open this link to sign in to Berean. It expires shortly and works once.\n\n${url}\n\nIf you did not ask for it, ignore this message; nothing has been created in your name beyond this email.`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend answered ${res.status}: ${await res.text()}`);
  }
}

async function sendMagicLink({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<void> {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    await sendViaResend(email, url);
    return;
  }
  console.log(
    `[berean auth] email is not configured on this deployment; magic link for ${email}: ${url}`,
  );
}

function createAuth() {
  return betterAuth({
    appName: "Berean",
    baseURL: process.env.BETTER_AUTH_URL,
    // A DATABASE_URL deployment is production posture: BETTER_AUTH_SECRET is
    // required there and better-auth refuses to run without it. The local
    // sqlite posture (no DATABASE_URL) gets a dev fallback so a fresh clone
    // signs in with zero configuration; it signs nothing production accepts.
    secret:
      process.env.BETTER_AUTH_SECRET ??
      (process.env.DATABASE_URL
        ? undefined
        : "berean-dev-secret-not-for-production"),
    database: authDatabase(),
    plugins: [magicLink({ sendMagicLink }), anonymous()],
  });
}

// Cached on globalThis so dev hot-reloads keep one auth instance, one pool,
// and one sqlite handle, matching the sync store's pattern.
const globalForAuth = globalThis as unknown as {
  __bereanAuth?: ReturnType<typeof createAuth>;
};

export const auth = globalForAuth.__bereanAuth ?? createAuth();
globalForAuth.__bereanAuth = auth;

/**
 * The account behind a request, or null when there is no valid session. A
 * deployment whose auth tables are not provisioned yet answers null here
 * too, so the sync routes fall back to the pre-auth slug path and the app
 * behaves exactly as before accounts landed.
 */
export async function sessionUserId(headers: Headers): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers });
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}
