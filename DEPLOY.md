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
  scope; a fully warmed shelf holds roughly 500MB, and the books-search
  indexes (commentary plus the Spurgeon archive) add about 650MB more once
  the first books search runs (measured stable at 778MB process RSS). The
  image sets `NODE_OPTIONS=--max-old-space-size=1536` to match a 2GB
  container. A 1GB plan works for a demo with slower first reads per work;
  lower the ceiling to 768 in the Dockerfile if you choose it.
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
  - Tombstone purge. Deletes travel as tombstones; once every device has
    caught up they are dead weight. `POST /api/sync/purge` drops tombstones
    older than a cutoff (default 30 days, tunable with `SYNC_TOMBSTONE_DAYS`
    or a `days` field in the body). Scoped like push and pull: a session
    purges its account namespace, anything else purges the caller's slug.
    For a scheduled sweep of every namespace, set `SYNC_PURGE_SECRET` and
    have the host hit the route on a cadence, for example a weekly cron job
    running
    `curl -X POST https://your-host/api/sync/purge -H "authorization: Bearer $SYNC_PURGE_SECRET" -H "content-type: application/json" -d '{}'`.
    Purging is safe to repeat; the worst case of purging a tombstone a
    device has not pulled yet is that the device still holds the record and
    pushes it back on its next cycle.
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

## Cloudflare Containers (the owner's production route)

Cloudflare Containers (GA April 2026, Workers Paid plan) run the shipped
Dockerfile on Cloudflare's network with a front Worker load-balancing
requests. The repo carries everything: `wrangler.jsonc` (the container
block, four max instances, observability on) and `worker/index.ts` (the
front door and the `BereanServer` container class).

1. Install Wrangler and log in: `npm i -g wrangler` then `wrangler login`.
   Docker must be running locally; `wrangler deploy` builds the image,
   pushes it to the account's container registry, and deploys the Worker.
2. Set the secrets (they bind to the Worker and forward into the container
   process via `worker/index.ts`):
   - `wrangler secret put DATABASE_URL` (the Neon connection string)
   - `wrangler secret put BETTER_AUTH_SECRET`
   - `wrangler secret put BETTER_AUTH_URL` (the public origin, e.g.
     https://berean.your-subdomain.workers.dev or a custom domain)
   - Optional: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`.
     If the framework ever fails to forward them, set the same names on
     the deployment in the Containers dashboard; that path is the fallback.
3. `npx wrangler deploy`. The first deploy builds and pushes the full
   image (about 600MB with the corpus), so it takes several minutes;
   later deploys reuse cached layers.
4. `npx wrangler containers list` shows instance health. The health check
   for any external monitor is `/api/health`.
5. The Neon database needs no change: the container reaches it over TLS
   from Cloudflare's network (Neon's pooler accepts it). Auth runs the pg
   dialect there automatically; better-sqlite3 never ships to production.
6. Custom domain: attach one in the dashboard (Workers > your worker >
   Domains) and set `BETTER_AUTH_URL` to match.
7. The sync tombstone purge has no cron on this host; schedule the same
   weekly curl above against the public origin, or wire a Workers Cron
   Trigger later.

Notes: container disks are ephemeral, which is fine by design (state lives
in Neon and the browser). Instance memory must cover the warm shelf and
search indexes (about 1.3GB; the image self-limits at 1536MB of old-space).
Cold starts run 1-3 seconds after idle; `sleepAfter` in `worker/index.ts`
trades cost against latency.

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

## The desktop shell

The Tauri desktop shell (desktop/) loads the deployed origin in its window.
Once the server is live, hand the origin to the shell with
`node scripts/set-tauri-url.mjs https://your-host`, then build the installer
with `cargo tauri build`. The full procedure is in `desktop/README.md`.
