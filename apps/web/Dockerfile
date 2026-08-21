# syntax=docker/dockerfile:1.10
#
# Builds the web image away from the production host.
#
# WHY THIS EXISTS
# Coolify built this app with Railpack on the same box that serves it. The build
# takes ~30 minutes and competes with the site, Postgres, Redis and the worker
# for 8 cores. On 2026-08-21 it went past competing: the host filled its swap and
# the kernel's OOM killer took Traefik, then Redis. A deploy could take the site
# down, which is the wrong shape for a deploy. This Dockerfile lets CI produce the
# image so the host only ever pulls one.
#
# The build context is the REPO ROOT, not apps/web: pnpm resolves the workspace
# from there, and `outputFileTracingRoot` in next.config.ts already points at it.
# Build with `docker build -f apps/web/Dockerfile .`.
#
# SECRETS
# Nothing sensitive may be baked in, because the image is public on ghcr.io (that
# is what makes the registry free). Build-time variables therefore arrive through
# a BuildKit secret mount rather than through ARG or ENV, both of which persist in
# the layer history. `next build` needs real credentials: pages are prerendered
# through the SDK loopback against the live database, so a credential-less build
# would emit empty shells that only heal on their first revalidation.

# Pin the exact runtime the Railpack image ran, so moving the build does not
# quietly become a Node upgrade too.
ARG NODE_VERSION=22.23.2

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# corepack pins pnpm from the root package.json `packageManager` field, so the
# version cannot drift from the one that wrote pnpm-lock.yaml.
RUN corepack enable
WORKDIR /app

# Dependencies, resolved from the manifests alone.
#
# Only the package.json files and the lockfile land in this stage, so the layer
# is reused by every build that did not change a dependency. Copying the sources
# first would invalidate the install on each commit, which is how the current
# build ends up reinstalling from scratch every time (the host reports
# `Build Cache: 0B`).
#
# `--ignore-scripts` because the workspace's postinstall runs generators that
# need the sources we have deliberately not copied yet. The builder stage runs
# them, and `prebuild` regenerates the same artifacts anyway.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY apps/bot/package.json apps/bot/
COPY apps/proxy/package.json apps/proxy/
COPY packages/core/package.json packages/core/
COPY packages/shared/package.json packages/shared/
COPY packages/wargaming/package.json packages/wargaming/
COPY packages/sdk/package.json packages/sdk/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/wargaming/node_modules ./packages/wargaming/node_modules
COPY --from=deps /app/packages/sdk/node_modules ./packages/sdk/node_modules
COPY . .

# The flag sprites are gitignored and produced by react-flagpack's postinstall,
# which `--ignore-scripts` skipped. They have to exist before `postbuild` copies
# public/ into the standalone tree, or the site ships without its flags.
RUN pnpm --filter @unicum.gg/web exec react-flagpack

# `build` runs prebuild (glossary, OpenAPI spec, generated routes, SDK client)
# and postbuild (copies .next/static and public/ next to the traced server.js)
# around `next build`, through pnpm's pre/post script support.
#
# The secret is a dotenv file rather than one mount per variable: the set is long
# (three Wargaming ids, the database, the cron secret, the public app URL, plus
# whatever optional integration is configured) and it changes as features land,
# so enumerating them here would mean editing this file every time. `set -a`
# exports them for the duration of the command only.
RUN --mount=type=secret,id=build_env,required=true \
    set -a && . /run/secrets/build_env && set +a \
    && pnpm --filter @unicum.gg/web build

# The runtime carries the standalone tree and nothing else.
#
# `output: "standalone"` traces exactly the files the server needs, which is 491M
# against the 2.5G of a full workspace install. Everything the build needed and
# the server does not (sources, dev dependencies, the pnpm store) stays behind in
# the builder stage.
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production
# PM2 is the process manager the app starts under, and it is the only runtime
# dependency the standalone tree does not carry. Pinned to the major the
# ecosystem config was written against.
RUN npm install --global pm2@5 && npm cache clean --force

WORKDIR /app/apps/web

# `ecosystem.config.cjs` resolves the cluster's cwd as `__dirname` +
# `.next/standalone/apps/web`, so it has to sit at the apps/web root with the
# standalone tree beneath it, exactly as it does in the workspace.
COPY --from=builder /app/apps/web/ecosystem.config.cjs ./ecosystem.config.cjs
COPY --from=builder /app/apps/web/.next/standalone ./.next/standalone

EXPOSE 3000
# HOSTNAME is forced to 0.0.0.0 by the ecosystem config, because Docker sets it
# to the container id and the standalone server would otherwise bind to that
# single interface, leaving the healthcheck unable to reach it.
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
