# Deploying Berean

Berean is a single Next.js server that reads its Scripture and reference
shelf from `data/` on disk. It deploys to any managed Node host that honors
a Dockerfile: Render, Railway, or Fly. The steps below cover Render and
Railway.

## What the host needs to know

- **Dockerfile detected automatically.** Both Render and Railway find the
  root `Dockerfile` and build it. No manual build or start command is
  required; if the host asks, the start command is `node server.js` inside
  the image (the Dockerfile's CMD).
- **PORT.** The host injects `PORT`; the standalone Next.js server listens
  on it. Nothing to configure.
- **Health check.** Point the host's health check at `/api/health`. It
  answers 200 even while the data shelf is cold-loading, so the host will
  not kill a healthy container during warm-up.
- **Memory.** Run the 2GB plan. The shelf caches parsed JSON at module
  scope; a fully warmed shelf holds roughly 500MB, and the image sets
  `NODE_OPTIONS=--max-old-space-size=1536` to match a 2GB container. A 1GB
  plan works for a demo with slower first reads per work; lower the ceiling
  to 768 in the Dockerfile if you choose it.
- **ANTHROPIC_API_KEY (optional).** Set it in the host's environment to
  enable the Scribe and semantic search. Without it the app runs fully and
  those surfaces say so honestly.
- **Accounts and sync (optional).** Accounts are better-auth magic links;
  sync is the push/pull pair under `/api/sync`. Both share one Postgres
  database, Neon in production (ADR 0002):
  - `DATABASE_URL`: the Neon connection string. It turns on the pg sync
    store and puts the account tables in Postgres. Without it the sync
    routes answer 503 and accounts fall back to a local sqlite file
    (`data/auth.db` under the server's working directory, overridable with
    `BEREAN_AUTH_DB`), which suits a single-process self-host but not a
    shared deployment.
  - `BETTER_AUTH_SECRET`: a random 32+ character string (`openssl rand
    -base64 32`). Required in production; sessions cannot sign without it.
  - `BETTER_AUTH_URL`: the public origin, for example
    `https://berean.onrender.com`. Magic links are built from it.
  - `RESEND_API_KEY` and `RESEND_FROM`: the Resend key and a verified
    sender (for example `Berean <login@yourdomain.com>`). Without them the
    sign-in flow still completes and the server log prints the link, which
    is the dev mode, not a production posture.
  - Provisioning is two files, applied in order against the Neon database:
    `psql "$DATABASE_URL" -f db/migrations/0001_sync.sql` then
    `db/migrations/0002_auth.sql`. Both are idempotent. Equivalently,
    `npx @better-auth/cli migrate` creates the auth tables from the app
    config; the SQL file keeps provisioning one documented step with no CLI.
    The sqlite fallback needs no provisioning: its tables are created
    automatically on first use.
  - `SYNC_DRIVER=memory` remains available for a single-process in-memory
    sync store (rows vanish on restart). Signed-in requests sync under the
    account's user id; signed-out requests use the caller's namespace slug
    as before (src/lib/sync-server.ts).
- **First build is slow.** The repo carries about 600MB of processed JSON.
  The first clone and the first Docker build take several minutes; later
  deploys reuse the cached clone.

## Render

1. Push the repo to GitHub (github.com/covenantOS/berean).
2. In the Render dashboard: New > Web Service > connect the repository.
3. Render detects the Dockerfile. Leave the build and start commands blank.
4. Choose the instance type with 2GB RAM.
5. Under Health Check Path, enter `/api/health`.
6. Under Environment, add `ANTHROPIC_API_KEY` if you want the Scribe live.
7. Deploy. Render serves HTTPS on its own domain automatically.

## Railway

1. Push the repo to GitHub.
2. In Railway: New Project > Deploy from GitHub repo > select berean.
3. Railway detects the Dockerfile and builds it. No start command needed.
4. Under Settings > Resources, confirm 2GB RAM.
5. Under Variables, add `ANTHROPIC_API_KEY` if you want the Scribe live.
6. Under Settings > Networking, generate a public domain. Railway serves
   HTTPS on it automatically.

## The PWA needs HTTPS

The installed app and the offline service worker (which precaches the full
KJV chapter set, about 5.4MB) only activate on a secure origin. Both hosts
above provide HTTPS by default, so install works out of the box on their
domains. A plain-IP or HTTP demo will run but will not install or work
offline.
