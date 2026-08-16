# syntax=docker/dockerfile:1

# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM node:24.19.0-alpine AS base

RUN apk add --no-cache libc6-compat && corepack enable

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install the pinned package manager and dependency graph.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# One-shot image used to apply committed Payload migrations before a release.
FROM base AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
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
# layers and image history; migrations run separately through the migrator.
RUN --mount=type=secret,id=database_url,env=DATABASE_URL \
  --mount=type=secret,id=payload_secret,env=PAYLOAD_SECRET \
  NEXT_OUTPUT_STANDALONE=1 \
  NODE_OPTIONS="--no-deprecation --max-old-space-size=8000" \
  pnpm exec next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

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
