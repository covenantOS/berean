# syntax=docker/dockerfile:1
# Berean on a managed Node host (Render, Railway, Fly). The host detects this
# file, builds the image, and injects PORT; the standalone server honors it.
# See DEPLOY.md for the full walkthrough.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prebuild regenerates public/precache.json from data/kjv, next build emits
# the standalone server, and postbuild folds public/ and .next/static into
# .next/standalone so the runner below needs only that tree plus data/.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# The data shelf caches parsed JSON at module scope; a fully warmed shelf
# holds roughly 500MB. On the recommended 2GB container, cap V8's old space
# at 1536MB so the shelf fits without the heap starving the rest of the
# process. On a 1GB container lower this to 768 and expect slower cold reads.
ENV NODE_OPTIONS=--max-old-space-size=1536
COPY --from=build /app/.next/standalone ./
# The processed JSON the API routes read at runtime, resolved against
# process.cwd(). Raw sources stay out of the image via .dockerignore, except
# the Natural Earth land shapes the atlas draws from.
COPY data ./data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
