// @vitest-environment node

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// C242 — the write guards of the face/publish CLIs, exercised as subprocesses:
// every refusal must happen before any engine call or DB connection.

const repoRoot = process.cwd()
const indexScript = join(repoRoot, 'scripts', 'index-archive-faces.mjs')
const publishScript = join(repoRoot, 'scripts', 'publish-archive-photos.mjs')

const run = (scriptPath: string, args: string[], env: Record<string, string> = {}) =>
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
      TEQO_ENV: '',
      ALLOW_REMOTE_DB: '',
      FACE_INDEX_CONFIRM: '',
      ARCHIVE_PUBLISH_CONFIRM: '',
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

describe('faces:index write guards (C242)', () => {
  it('prints the help even without a database', () => {
    const result = run(indexScript, ['--help'], { DATABASE_URL: '' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('FACE_INDEX_CONFIRM')
    expect(result.stdout).toContain('--refresh')
  })

  it('refuses --apply on a production target without the intent flag', () => {
    const result = run(indexScript, ['--apply'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('FACE_INDEX_CONFIRM=1')
  })

  it('requires the declared TEQO_ENV once the intent flag is set', () => {
    const result = run(indexScript, ['--apply'], { FACE_INDEX_CONFIRM: '1' })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('TEQO_ENV')
  })

  it('refuses --apply without the complete S3_* set on a declared production target', () => {
    const result = run(indexScript, ['--apply'], {
      FACE_INDEX_CONFIRM: '1',
      TEQO_ENV: 'production',
    })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('S3_BUCKET')
  })

  it('reaches the payload bootstrap with the complete target declared', () => {
    const result = run(indexScript, ['--apply'], {
      FACE_INDEX_CONFIRM: '1',
      TEQO_ENV: 'production',
      ...withS3,
    })

    // No production database here: the run must fail while connecting (or
    // right after), never with one of the write guards. The spawn boots
    // Payload, so the unit default (5s) is not enough on CI runners.
    expect(result.status).toBe(1)
    expect(output(result)).not.toContain('FACE_INDEX_CONFIRM=1')
    expect(output(result)).not.toContain('TEQO_ENV=')
  }, 30_000)
})

describe('archive:publish write guards (C242)', () => {
  it('prints the help even without a database', () => {
    const result = run(publishScript, ['--help'], { DATABASE_URL: '' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ARCHIVE_PUBLISH_CONFIRM')
    expect(result.stdout).toContain('--limit')
  })

  it('refuses --apply on a production target without the intent flag', () => {
    const result = run(publishScript, ['--apply'])

    expect(result.status).toBe(1)
    expect(output(result)).toContain('ARCHIVE_PUBLISH_CONFIRM=1')
  })

  it('requires the declared TEQO_ENV once the intent flag is set', () => {
    const result = run(publishScript, ['--apply'], { ARCHIVE_PUBLISH_CONFIRM: '1' })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('TEQO_ENV')
  })

  it('refuses a target database that does not match the declared environment', () => {
    const result = run(publishScript, ['--apply'], {
      ARCHIVE_PUBLISH_CONFIRM: '1',
      TEQO_ENV: 'staging',
    })

    expect(result.status).toBe(1)
    expect(output(result)).toContain('≠ "teqo_staging"')
  })
})
