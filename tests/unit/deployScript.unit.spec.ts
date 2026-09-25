// @vitest-environment node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const scriptPath = join(repoRoot, 'scripts', 'deploy-homeserver.sh')
const script = readFileSync(scriptPath, 'utf8')

describe('scripts/deploy-homeserver.sh (OPS53 deploy pipeline)', () => {
  it('is valid bash', () => {
    expect(() => execFileSync('bash', ['-n', scriptPath], { stdio: 'pipe' })).not.toThrow()
  })

  it('deploys the dispatched SHA to the end even when main advanced during verify (OPS102)', () => {
    // OPS53's stale-run guard assumed an automatic deploy; since OPS71 the
    // dispatch is a deliberate operator act — the run must complete with the
    // SHA it started with. Reintroducing a main-HEAD comparison must fail here.
    expect(script).not.toContain('stale run')
    expect(script).not.toContain('git ls-remote')
    expect(script).not.toContain('refs/heads/main')
  })

  it('never exits green without deploying: the only early exit 0 is "already deployed"', () => {
    // #953: the stale-run skip used to `exit 0` — a green deploy that never
    // happened while prod stayed on an older image.
    expect(script.match(/\bexit 0\b/g) ?? []).toHaveLength(1)
  })

  it('keeps flock serialization after removing the HEAD guards (OPS102)', () => {
    expect(script).toContain('exec 9>"$DEPLOY_LOCK"')
    expect(script).toContain('flock -w 3600 9')
  })

  it('skips idempotently when the running container already runs the SHA (OPS65)', () => {
    expect(script).toContain('already deployed')
    expect(script).toContain('docker inspect')
    expect(script).toContain('org.opencontainers.image.revision')
    expect(script).toContain('$running_rev')
    expect(script).toContain('"$running_rev" = "$SHA"')
  })

  it('builds with BuildKit secrets — prod credentials never enter image layers', () => {
    expect(script).toContain('--secret')
    expect(script).toContain('id=database_url,env=DATABASE_URL')
    expect(script).toContain('id=payload_secret,env=PAYLOAD_SECRET')
  })

  it('reaches the env DB from the build (loopback proxy on the compose network)', () => {
    // BuildKit rejects `--network <bridge>`; the build uses --network host and
    // a socat proxy (on stack_default, published on the host loopback) with a
    // rewritten DATABASE_URL. OPS103 parameterized the proxy per environment.
    expect(script).toContain('--network host')
    expect(script).toContain('$TEQO_BUILD_PROXY')
    expect(script).toContain('TCP:postgres:5432')
    expect(script).toContain('$TEQO_BUILD_PROXY_PORT')
  })

  it('applies migrations BEFORE the runner build — static generation reads the new schema (OPS66)', () => {
    // OPS66: a migration that creates a table a static route reads used to
    // deadlock the deploy (runner build failed -> migrate never ran -> build
    // failed again). The migrator stage never runs `next build`, so it must
    // build first; the compose swap feeds the new migrator image to the
    // maintenance service; then migrate runs; only then the runner builds
    // against the migrated DB. OPS103 anchors the markers on the invocation
    // itself (the raw `teqo-1313-migrate` literal now appears first in the
    // environment map at the top of the script).
    const migratorBuildIndex = script.indexOf('build_image migrator')
    const swapIndex = script.indexOf('compose swap')
    const migrateIndex = script.indexOf('--profile maintenance run --rm')
    const runnerBuildIndex = script.indexOf('build_image runner')
    // The rollback helper also contains a `compose up -d` (before the migrate
    // step); the REAL rollout is the last occurrence.
    const upIndex = script.lastIndexOf('docker compose up -d "$TEQO_CONTAINER"')
    for (const i of [migratorBuildIndex, swapIndex, migrateIndex, runnerBuildIndex, upIndex]) {
      expect(i).toBeGreaterThan(-1)
    }
    expect(migratorBuildIndex).toBeLessThan(swapIndex)
    expect(swapIndex).toBeLessThan(migrateIndex)
    expect(migrateIndex).toBeLessThan(runnerBuildIndex)
    expect(runnerBuildIndex).toBeLessThan(upIndex)
  })

  it('smokes the deployed surface with the prod revalidate secret', () => {
    for (const fragment of [
      '/campanha/login',
      '/admin',
      '/campanha/webauthn/login-options',
      '/api/revalidate',
      'x-revalidate-secret',
    ]) {
      expect(script, fragment).toContain(fragment)
    }
  })

  it('audits the running container feature envs after the healthcheck, non-fatally', () => {
    // Incident 2026-09-24: prod/staging ran without DEEPSEEK_API_KEY and every
    // AI-backed feature degraded silently (theme search showed the unavailable
    // notice). The audit reads the CONTAINER env — the compose env_file is the
    // truth — and annotates what is missing; it must never fail the deploy
    // (which feature keys are set is the human's call).
    for (const fragment of [
      'warn_missing_feature_envs',
      'DEEPSEEK_API_KEY',
      'DEEPINFRA_API_KEY',
      'RESEND_API_KEY',
      'CAMPAIGN_EMAIL_FROM',
      'VAPID_PUBLIC_KEY',
      'VAPID_PRIVATE_KEY',
      '::warning::',
    ]) {
      expect(script, fragment).toContain(fragment)
    }

    const definitionIndex = script.indexOf('warn_missing_feature_envs() {')
    const callIndex = script.indexOf('warn_missing_feature_envs\n')
    const healthIndex = script.indexOf('waiting for the healthcheck')
    const smokeIndex = script.indexOf('# --- smoke')
    expect(definitionIndex).toBeGreaterThan(healthIndex)
    expect(callIndex).toBeGreaterThan(definitionIndex)
    expect(callIndex).toBeLessThan(smokeIndex)
  })

  it('probes the container AI egress non-fatally (route/proxy breakage incident 2026-09-25)', () => {
    // The keys can be present and the capability still dead: the homeserver's
    // route to api.deepseek.com is intermittent and the app egresses through a
    // tailnet proxy. The probe runs INSIDE the container (honoring
    // NODE_USE_ENV_PROXY/HTTPS_PROXY) and only warns — a broken provider path
    // must never fail an otherwise good deploy.
    for (const fragment of [
      'warn_ai_egress',
      'docker exec "$TEQO_CONTAINER" node -e',
      'api.deepseek.com',
    ]) {
      expect(script, fragment).toContain(fragment)
    }
    const probeIndex = script.indexOf('warn_ai_egress() {')
    const callIndex = script.indexOf('warn_ai_egress\n')
    const healthIndex = script.indexOf('waiting for the healthcheck')
    const smokeIndex = script.indexOf('# --- smoke')
    expect(probeIndex).toBeGreaterThan(healthIndex)
    expect(callIndex).toBeGreaterThan(probeIndex)
    expect(callIndex).toBeLessThan(smokeIndex)
  })

  it('never echoes secret values (no set -x, passwords only via stdin/secrets)', () => {
    expect(script).not.toMatch(/^set -x\b/m)
    expect(script).not.toContain('echo "$DATABASE_URL"')
    expect(script).not.toContain('echo "$PAYLOAD_SECRET"')
    // Registry password goes to docker via stdin — never stdout, never argv.
    expect(script).toContain('echo "$REGISTRY_PASSWORD" | docker login')
    expect(script).not.toContain('--password "$REGISTRY_PASSWORD"')
  })

  it('Dockerfile: NEXT_OUTPUT_STANDALONE and NODE_OPTIONS reach next build (shell prefix scoping)', () => {
    // Shell prefix assignments (`VAR=x cmd1 && cmd2`) bind to only the first
    // command. When OPS99 chained the importmap generator before next build,
    // the standalone/memory flags silently stayed on the generator side — next
    // build would produce no standalone output for the runner stage.
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8')
    const builderStage = dockerfile
      .slice(dockerfile.indexOf('AS builder'), dockerfile.indexOf('AS runner'))
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n')
    const [importMapCommand, nextBuildCommand] = builderStage.split('&&')
    expect(importMapCommand).not.toContain('NEXT_OUTPUT_STANDALONE')
    expect(importMapCommand).not.toContain('max-old-space-size')
    expect(nextBuildCommand).toContain('next build')
    expect(nextBuildCommand).toContain('NEXT_OUTPUT_STANDALONE=1')
    expect(nextBuildCommand).toContain('max-old-space-size=8000')
  })

  it('Dockerfile: the migrator stage never runs `next build` (it builds against the old schema)', () => {
    // The invariant OPS66 depends on: the migrator image can always be built,
    // even before the new migrations exist in the DB.
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8')
    const migratorStage = dockerfile.slice(
      dockerfile.indexOf('AS migrator'),
      dockerfile.indexOf('AS builder'),
    )
    expect(migratorStage).toContain('CMD ["pnpm", "migrate"]')
    expect(migratorStage).not.toContain('next build')
    const builderStage = dockerfile.slice(dockerfile.indexOf('AS builder'))
    expect(builderStage).toContain('next build')
  })

  it('Dockerfile: the migrator bakes pnpm at build time (no runtime registry fetch)', () => {
    // The migrator container runs `pnpm migrate` at CONTAINER START: without a
    // corepack cache in the image, corepack downloads pnpm from
    // registry.npmjs.org at deploy time — the maintenance container's outbound
    // is not guaranteed (the staging deploy of 2026-09-13 failed with
    // ETIMEDOUT to the registry while the same download worked at build time).
    // `corepack install` bakes the cache into the layer; offline proof:
    // `docker run --network none <image> pnpm --version` answers 10.11.0.
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8')
    const migratorStage = dockerfile.slice(
      dockerfile.indexOf('AS migrator'),
      dockerfile.indexOf('AS builder'),
    )
    expect(migratorStage).toContain('RUN corepack install')
  })

  it('Dockerfile: generates the importMap via the canonical script (react-server condition)', () => {
    // OPS99 added the generator to the builder, but the bare
    // `pnpm exec payload generate:importmap` misses `--conditions=react-server`;
    // `server-only` then throws and every Docker build failed (2026-09-12
    // incident — no deploy landed after OPS99). The package script owns the
    // flags.
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts['generate:importmap']).toContain('--conditions=react-server')

    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8')
    const builderStage = dockerfile.slice(dockerfile.indexOf('AS builder'))
    expect(builderStage).toContain('pnpm generate:importmap')
    expect(builderStage).not.toContain('pnpm exec payload generate:importmap')
  })
})

describe('scripts/deploy-homeserver.sh environment parameterization (OPS103)', () => {
  const productionBlock = script.slice(
    script.indexOf('  production)'),
    script.indexOf('  staging)'),
  )
  const stagingBlock = script.slice(script.indexOf('  staging)'), script.indexOf('  *)'))
  const fallbackBlock = script.slice(script.indexOf('  *)'), script.indexOf('esac'))

  it('defaults to production with the exact pre-OPS103 identities', () => {
    // The canonical invocation `bash scripts/deploy-homeserver.sh <sha>` (no
    // env) must keep deploying production with the same names and ports as
    // before — a drift here is a production regression.
    expect(script).toContain('TEQO_ENV="${TEQO_ENV:-production}"')
    expect(productionBlock).toContain('TEQO_CONTAINER=teqo-1313')
    expect(productionBlock).toContain('TEQO_MIGRATE_SERVICE=teqo-1313-migrate')
    expect(productionBlock).toContain('teqo-1313.env')
    expect(productionBlock).toContain('TEQO_IMAGE_REPO=teqo-1313')
    expect(productionBlock).toContain('TEQO_BUILD_PROXY=teqo-1313-build-proxy')
    expect(productionBlock).toContain('TEQO_BUILD_PROXY_PORT=5433')
    expect(productionBlock).toContain('TEQO_SMOKE_BASE=http://localhost:1313')
  })

  it('maps the staging identities (container, service, env file, ports)', () => {
    expect(stagingBlock).toContain('TEQO_CONTAINER=teqo-staging')
    expect(stagingBlock).toContain('TEQO_MIGRATE_SERVICE=teqo-staging-migrate')
    expect(stagingBlock).toContain('teqo-staging.env')
    expect(stagingBlock).toContain('TEQO_IMAGE_REPO=teqo-staging')
    expect(stagingBlock).toContain('TEQO_BUILD_PROXY=teqo-staging-build-proxy')
    expect(stagingBlock).toContain('TEQO_BUILD_PROXY_PORT=5434')
    expect(stagingBlock).toContain('TEQO_SMOKE_BASE=http://localhost:1314')
  })

  it('serializes both environments on ONE shared lock (compose/workspace are shared)', () => {
    // Per-env locks would let staging and production build/swap concurrently
    // on the same workspace and compose file (the workflow job-level
    // concurrency lives only on deploy-staging since OPS107 — this lock also
    // covers cross-run execution and manual invocations on the host).
    expect(script).toContain('DEPLOY_LOCK="${DEPLOY_LOCK:-/tmp/teqo-deploy.lock}"')
    expect(script).not.toContain('/tmp/teqo-1313-deploy.lock')
    expect(script).not.toContain('/tmp/teqo-staging-deploy.lock')
  })

  it('fails closed on an unknown TEQO_ENV (case fallback, before any deploy step)', () => {
    expect(fallbackBlock).toContain('fatal "unknown TEQO_ENV')
    expect(script.indexOf('fatal "unknown TEQO_ENV')).toBeLessThan(script.indexOf('exec 9>'))
  })

  it('freezes the derived env map against env-file retargeting (readonly)', () => {
    expect(script).toContain(
      'readonly TEQO_CONTAINER TEQO_MIGRATE_SERVICE TEQO_ENV_FILE TEQO_IMAGE_REPO',
    )
    expect(script).toContain(
      'readonly TEQO_BUILD_PROXY TEQO_BUILD_PROXY_PORT TEQO_SMOKE_BASE DEPLOY_LOCK',
    )
    // The env files are sourced after the map; a readonly assignment error
    // aborts the deploy (fail-closed) instead of silently switching targets.
    const readonlyIndex = script.indexOf('readonly TEQO_CONTAINER')
    const sourceIndex = script.indexOf('. "$TEQO_ENV_FILE"')
    expect(readonlyIndex).toBeGreaterThan(-1)
    expect(readonlyIndex).toBeLessThan(sourceIndex)
  })

  it('parameterizes image refs, migrate service, rollout, healthcheck and cleanup', () => {
    expect(script).toContain('$TEQO_REGISTRY/$TEQO_IMAGE_REPO-migrator:$SHA')
    expect(script).toContain('$TEQO_REGISTRY/$TEQO_IMAGE_REPO:$SHA')
    expect(script).toContain('run --rm "$TEQO_MIGRATE_SERVICE"')
    expect(script).toContain('docker compose up -d "$TEQO_CONTAINER"')
    expect(script).toContain('\'{{.State.Health.Status}}\' "$TEQO_CONTAINER"')
    expect(script).toContain('grep -E "^($TEQO_REGISTRY/)?$TEQO_IMAGE_REPO(-migrator)?:"')
  })

  it('anchors the revision-label sed to the service block (never stamps the other env)', () => {
    // A bare global replace would stamp THIS env's SHA onto the other
    // environment's service, and the "already deployed" guard would read a
    // lying revision. The range is re-read afterwards to fail closed when the
    // service block has no label (a silent no-op would disable the guard).
    expect(script).toContain('label_range="/^  $TEQO_CONTAINER:/,/^  [A-Za-z0-9_.-]+:/"')
    expect(script).not.toContain('-e "s|org.opencontainers.image.revision')
    expect(script).toContain('grep -q "org.opencontainers.image.revision: $SHA"')
  })
})
