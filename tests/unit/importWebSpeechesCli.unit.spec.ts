import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const scriptPath = join(repoRoot, 'scripts', 'import-web-speeches.mjs')
const missingFindingsPath = join(repoRoot, 'data', 'falas-web', 'missing-test-batch.json')

const runWithoutS3 = () =>
  spawnSync(process.execPath, [scriptPath, '--findings', missingFindingsPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_OPTIONS: '--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://teqo:teqo@127.0.0.1:5433/teqo_1313',
      FALAS_WEB_IMPORT_CONFIRM: '1',
      PAYLOAD_SECRET: 'test-secret',
      S3_BUCKET: '',
      S3_ENDPOINT: '',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
    },
  })

describe('import-web-speeches production media guard', () => {
  it('refuses a non-local write without S3 before reading the findings file', () => {
    const result = runWithoutS3()
    const output = `${result.stdout}${result.stderr}`

    expect(result.status).toBe(1)
    expect(output).toContain('S3_BUCKET')
    expect(output).not.toContain('ENOENT')
  }, 30_000)
})
