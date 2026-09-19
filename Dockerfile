# syntax=docker/dockerfile:1

# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM node:24.19.0-alpine AS base

RUN apk add --no-cache libc6-compat && corepack enable

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# pnpm-workspace.yaml carries onlyBuiltDependencies — pnpm 10 no longer reads the "pnpm" field.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# One-shot image used to apply committed Payload migrations before a release.
FROM base AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Bake the package manager INTO the image: `pnpm migrate` runs at CONTAINER
# START, so without a corepack cache the runtime downloads pnpm from
# registry.npmjs.org — the maintenance container's outbound is not guaranteed
# (the staging deploy of 2026-09-13 failed exactly there, ETIMEDOUT to the
# registry, while the same download worked at build time). The install runs at
# BUILD time, where the network is available, and the cache ships in the layer.
RUN corepack install
CMD ["pnpm", "migrate"]

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Static generation reads Payload data. BuildKit mounts keep credentials out of
# layers and image history; migrations run separately through the migrator —
# the deploy script applies them BEFORE this build (OPS66: static routes read
# the new schema, so the build must see a migrated DB).
#
# S15 — copy the MediaPipe wasm runtime into public/ so the card cutout runs
# same-origin (the files are gitignored build artifacts, never committed).
RUN node scripts/copy-card-vision-assets.mjs

# OPS99: Generate importMap with dummy S3_* envs BEFORE next build.
# This ensures the production image always has the S3ClientUploadHandler entry,
# eliminating the class of bugs where the admin goes blank (OPS69/OPS72/OPS73).
# The dummy values are safe because Payload's generator doesn't connect to S3.
# Shell prefix assignments bind to a single command, so each side of the `&&`
# declares its own env: the generator runs through `pnpm generate:importmap`
# (which owns the `--conditions=react-server` the Payload CLI needs to import
# server-only modules), and `next build` carries the standalone flag itself.
RUN --mount=type=secret,id=database_url,env=DATABASE_URL \
  --mount=type=secret,id=payload_secret,env=PAYLOAD_SECRET \
  S3_BUCKET=build-dummy \
  S3_ENDPOINT=http://127.0.0.1:3900 \
  S3_ACCESS_KEY_ID=build-dummy \
  S3_SECRET_ACCESS_KEY=build-dummy \
  pnpm generate:importmap && \
  NEXT_OUTPUT_STANDALONE=1 \
  NODE_OPTIONS="--no-deprecation --max-old-space-size=8000" \
  pnpm exec next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# C167 — `ffmpeg` cuts the exact [início,fim] excerpt of an acervo speech
# (speechCutJob). Only the runner stage pays for it: the deps/builder/migrator
# stages never run it. `FFMPEG_PATH` can still override the binary.
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Remove this line if you do not have this folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]
