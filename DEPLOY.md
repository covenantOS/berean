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
- **Sync (optional, pre-auth).** The sync routes (`/api/sync/push`,
  `/api/sync/pull`) answer 503 until a store is configured. Set
  `SYNC_DRIVER=memory` for a single-process in-memory store (rows vanish on
  restart), or set `DATABASE_URL` to a Postgres connection string after
  applying `db/migrations/0001_sync.sql` for the real store. Auth is not
  wired: clients pass a namespace slug, documented in
  `src/lib/sync-server.ts`.
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
