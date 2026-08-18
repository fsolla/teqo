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

  it('guards against stale runs: only the current main HEAD deploys', () => {
    expect(script).toContain('git ls-remote')
    expect(script).toContain('refs/heads/main')
    expect(script).toContain('stale run')
  })

  it('builds with BuildKit secrets — prod credentials never enter image layers', () => {
    expect(script).toContain('--secret')
    expect(script).toContain('id=database_url,env=DATABASE_URL')
    expect(script).toContain('id=payload_secret,env=PAYLOAD_SECRET')
  })

  it('builds inside the compose network so the static generation reaches the prod DB', () => {
    expect(script).toContain('--network stack_default')
  })

  it('applies migrations through the maintenance service before the rollout', () => {
    // The rollback helper also contains a `compose up -d` (before the migrate
    // step); the REAL rollout is the last occurrence.
    const migrateIndex = script.indexOf('teqo-1313-migrate')
    const upIndex = script.lastIndexOf('docker compose up -d teqo-1313')
    expect(migrateIndex).toBeGreaterThan(-1)
    expect(upIndex).toBeGreaterThan(-1)
    expect(migrateIndex).toBeLessThan(upIndex)
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
})
