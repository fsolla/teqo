import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// C231 — the CLI's fail-closed write guards, exercised as a subprocess: each
// refusal must happen before any Flickr call, S3 write or DB connection.

const repoRoot = process.cwd()
const scriptPath = join(repoRoot, 'scripts', 'ingest-flickr-archive.mjs')

const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_OPTIONS: '--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs',
      NODE_ENV: 'production',
      VITEST: '',
      DATABASE_URL: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo_1313',
      PAYLOAD_SECRET: 'test-secret',
      FLICKR_API_KEY: 'test-key',
      FLICKR_USER_ID: '123@N00',
      FLICKR_IMPORT_CONFIRM: '',
      TEQO_ENV: '',
      ALLOW_REMOTE_DB: '',
      S3_BUCKET: '',
      S3_ENDPOINT: '',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
      ...env,
    },
  })

const output = (result: ReturnType<typeof run>) => `${result.stdout}${result.stderr}`

describe('flickr:import write guards (C231)', () => {
  it('prints the help even without a database', () => {
    const result = run(['--help'], { DATABASE_URL: '' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('FLICKR_IMPORT_CONFIRM')
    expect(result.stdout).toContain('pnpm flickr:import')
  })

  it('refuses --apply on a production target without the intent flag, before the key check', () => {
    const result = run(['--apply'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('FLICKR_IMPORT_CONFIRM=1')
    expect(output(result)).not.toContain('FLICKR_API_KEY')
  })

  it('requires the declared TEQO_ENV once the intent flag is set', () => {
    const result = run(['--apply'], { FLICKR_IMPORT_CONFIRM: '1' })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('TEQO_ENV')
  })

  it('refuses a target database that does not match the declared environment', () => {
    const result = run(['--apply'], { FLICKR_IMPORT_CONFIRM: '1', TEQO_ENV: 'staging' })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('≠ "teqo_staging"')
  })

  it('refuses --apply without the complete S3_* set on a declared production target', () => {
    const result = run(['--apply'], { FLICKR_IMPORT_CONFIRM: '1', TEQO_ENV: 'production' })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('S3_BUCKET')
  })

  it('refuses an unknown argument before touching anything', () => {
    const result = run(['--force'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('argumento desconhecido')
  })
})
