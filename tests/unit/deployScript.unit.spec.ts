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
    expect(script.match(/^\s*exit 0\s*$/gm) ?? []).toHaveLength(1)
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

  it('reaches the prod DB from the build (loopback proxy on the compose network)', () => {
    // BuildKit rejects `--network <bridge>`; the build uses --network host and
    // a socat proxy (on stack_default, published on the host loopback) with a
    // rewritten DATABASE_URL.
    expect(script).toContain('--network host')
    expect(script).toContain('teqo-1313-build-proxy')
    expect(script).toContain('TCP:postgres:5432')
    expect(script).toContain('127.0.0.1:5433')
  })

  it('applies migrations BEFORE the runner build — static generation reads the new schema (OPS66)', () => {
    // OPS66: a migration that creates a table a static route reads used to
    // deadlock the deploy (runner build failed -> migrate never ran -> build
    // failed again). The migrator stage never runs `next build`, so it must
    // build first; the compose swap feeds the new migrator image to the
    // maintenance service; then migrate runs; only then the runner builds
    // against the migrated DB.
    const migratorBuildIndex = script.indexOf('build_image migrator')
    const swapIndex = script.indexOf('compose swap')
    const migrateIndex = script.indexOf('teqo-1313-migrate')
    const runnerBuildIndex = script.indexOf('build_image runner')
    // The rollback helper also contains a `compose up -d` (before the migrate
    // step); the REAL rollout is the last occurrence.
    const upIndex = script.lastIndexOf('docker compose up -d teqo-1313')
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
