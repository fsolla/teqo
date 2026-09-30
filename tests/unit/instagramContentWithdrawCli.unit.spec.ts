import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// C230-followup — the withdraw CLI's fail-closed write guards, exercised as a
// subprocess: each refusal must happen before any Payload import, feed call or
// DB connection.

const repoRoot = process.cwd()
const scriptPath = join(repoRoot, 'scripts', 'withdraw-instagram-content.mjs')

const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      NODE_OPTIONS: '--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs',
      NODE_ENV: 'production',
      VITEST: '',
      DATABASE_URL: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo_1313',
      PAYLOAD_SECRET: 'test-secret',
      CONTENT_INSTAGRAM_WITHDRAW_CONFIRM: '',
      TEQO_ENV: '',
      ALLOW_REMOTE_DB: '',
      ...env,
    },
  })

const output = (result: ReturnType<typeof run>) => `${result.stdout}${result.stderr}`

describe('content:instagram:withdraw write guards (C230-followup)', () => {
  it('prints the help even without a database', () => {
    const result = run(['--help'], { DATABASE_URL: '' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('CONTENT_INSTAGRAM_WITHDRAW_CONFIRM')
    expect(result.stdout).toContain('pnpm content:instagram:withdraw')
  })

  it('requires --before before touching anything', () => {
    const result = run(['--apply'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('--before é obrigatório')
  })

  it('refuses an invalid cutoff before touching anything', () => {
    const result = run(['--before', '16/08/2026'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('YYYY-MM-DD')
  })

  it('refuses --apply on a production target without the intent flag, before any DB import', () => {
    const result = run(['--before', '2026-08-16', '--apply'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('CONTENT_INSTAGRAM_WITHDRAW_CONFIRM=1')
    expect(output(result)).not.toContain('| modo:')
  })

  it('requires the declared TEQO_ENV once the intent flag is set', () => {
    const result = run(['--before', '2026-08-16', '--apply'], {
      CONTENT_INSTAGRAM_WITHDRAW_CONFIRM: '1',
    })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('TEQO_ENV')
  })

  it('refuses a target database that does not match the declared environment', () => {
    const result = run(['--before', '2026-08-16', '--apply'], {
      CONTENT_INSTAGRAM_WITHDRAW_CONFIRM: '1',
      TEQO_ENV: 'staging',
    })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('≠ "teqo_staging"')
  })

  it('refuses an unknown argument before touching anything', () => {
    const result = run(['--force'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('argumento desconhecido')
  })
})
