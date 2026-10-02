import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// C246 — the integrity CLI's fail-closed guards, exercised as a subprocess:
// each refusal must happen before any payload boot, bucket read or Flickr call.

const repoRoot = process.cwd()
const scriptPath = join(repoRoot, 'scripts', 'check-archive-integrity.mjs')

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
      ARCHIVE_INTEGRITY_CONFIRM: '',
      TEQO_ENV: '',
      ALLOW_REMOTE_DB: '',
      FLICKR_API_KEY: '',
      S3_BUCKET: '',
      S3_ENDPOINT: '',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
      ...env,
    },
  })

const output = (result: ReturnType<typeof run>) => `${result.stdout}${result.stderr}`
const withS3 = {
  S3_BUCKET: 'bucket',
  S3_ENDPOINT: 'http://127.0.0.1:3900',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
}

describe('archive:integrity write guards (C246)', () => {
  it('prints the help even without a database', () => {
    const result = run(['--help'], { DATABASE_URL: '' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ARCHIVE_INTEGRITY_CONFIRM')
    expect(result.stdout).toContain('FLICKR_API_KEY')
    expect(result.stdout).toContain('--only')
  })

  it('refuses --apply on a production target without the intent flag', () => {
    const result = run(['--apply'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('ARCHIVE_INTEGRITY_CONFIRM=1')
  })

  it('requires the declared TEQO_ENV once the intent flag is set', () => {
    const result = run(['--apply'], { ARCHIVE_INTEGRITY_CONFIRM: '1' })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('TEQO_ENV')
  })

  it('refuses a target database that does not match the declared environment', () => {
    const result = run(['--apply'], { ARCHIVE_INTEGRITY_CONFIRM: '1', TEQO_ENV: 'staging' })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('≠ "teqo_staging"')
  })

  it('refuses --apply without the complete S3_* set on a declared production target', () => {
    const result = run(['--apply'], { ARCHIVE_INTEGRITY_CONFIRM: '1', TEQO_ENV: 'production' })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('S3_BUCKET')
  })

  it('requires FLICKR_API_KEY for a repair with S3 configured', () => {
    const result = run(['--apply'], {
      ARCHIVE_INTEGRITY_CONFIRM: '1',
      TEQO_ENV: 'production',
      ...withS3,
    })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('FLICKR_API_KEY')
  })

  it('refuses even the read-only sweep on a non-local target without S3', () => {
    const result = run([])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('S3_BUCKET')
  })

  it('refuses an unknown argument before touching anything', () => {
    const result = run(['--force'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('argumento desconhecido')
  })
})
