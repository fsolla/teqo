#!/usr/bin/env node
/**
 * Guard: the committed importMap must include the S3ClientUploadHandler entry
 * (OPS69/OPS72/OPS73 class — regenerating the importMap without the S3_* envs
 * silently orphans it, and the admin goes blank in production).
 *
 * Regenerates the importMap with dummy S3_* envs (same trick as the OPS69
 * fix — the CLI iterates the config without a DB) and fails if the committed
 * file drifts. The working-tree file is restored afterwards so a failure
 * leaves the checkout untouched; the drift is printed in the error.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { S3_STORAGE_ENV_KEYS } from './lib/importMapContract.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const importMapPath = path.join(repoRoot, 'src/app/(payload)/admin/importMap.js')

if (!existsSync(importMapPath)) {
  console.error(`importMap not found at ${importMapPath}`)
  process.exit(1)
}

const committed = readFileSync(importMapPath, 'utf8')

const GUARD_S3_DUMMY = {
  S3_BUCKET: 'guard-bucket',
  S3_ENDPOINT: 'http://127.0.0.1:3900',
  S3_ACCESS_KEY_ID: 'guard-access-key',
  S3_SECRET_ACCESS_KEY: 'guard-secret-key',
}

const env = {
  ...process.env,
  // Same NODE_OPTIONS as the package.json `generate:importmap` script —
  // the payload CLI loads server-only modules.
  NODE_OPTIONS: '--no-deprecation --conditions=react-server',
  // Dummy S3_* envs gate the s3Storage plugin in (see mediaStorage.ts) so the
  // generation is prod-faithful; the generator never connects to the bucket.
  ...Object.fromEntries(S3_STORAGE_ENV_KEYS.map((key) => [key, GUARD_S3_DUMMY[key]])),
  // The payload config needs a secret and a database URL to build, even
  // though the generator never connects (iterateConfig, no DB).
  PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'guard-secret',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://guard:guard@127.0.0.1:1/guard',
}

try {
  execFileSync('pnpm', ['exec', 'payload', 'generate:importmap'], {
    cwd: repoRoot,
    env,
    stdio: 'pipe',
  })
} catch (error) {
  restore(committed)
  console.error('guard-importmap: payload generate:importmap failed')
  console.error(error.stderr?.toString() || error.message)
  process.exit(1)
}

const generated = readFileSync(importMapPath, 'utf8')
if (generated !== committed) {
  restore(committed)
  console.error(
    [
      'guard-importmap: the committed importMap drifted from the generation',
      'with S3_* envs set. Regenerate it with the S3_* envs (dummy values are',
      'fine) and commit the result:',
      '',
      '  S3_BUCKET=x S3_ENDPOINT=http://127.0.0.1:3900 \\',
      '  S3_ACCESS_KEY_ID=x S3_SECRET_ACCESS_KEY=x pnpm generate:importmap',
      '',
      'Drift (committed -> generated):',
    ].join('\n'),
  )
  const drift = diffLines(committed, generated)
  console.error(drift)
  process.exit(1)
}

// Minimal line diff (no external deps): removed lines prefixed with "-",
// added lines with "+".
function diffLines(before, after) {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const out = []
  let i = 0
  let j = 0
  while (i < beforeLines.length && j < afterLines.length) {
    if (beforeLines[i] === afterLines[j]) {
      i += 1
      j += 1
    } else {
      const nextInBefore = beforeLines.indexOf(afterLines[j], i + 1)
      const nextInAfter = afterLines.indexOf(beforeLines[i], j + 1)
      if (nextInAfter === -1) {
        out.push(`- ${beforeLines[i]}`)
        i += 1
      } else if (nextInBefore === -1) {
        out.push(`+ ${afterLines[j]}`)
        j += 1
      } else if (nextInAfter - j <= nextInBefore - i) {
        out.push(`+ ${afterLines[j]}`)
        j += 1
      } else {
        out.push(`- ${beforeLines[i]}`)
        i += 1
      }
    }
  }
  while (i < beforeLines.length) out.push(`- ${beforeLines[i++]}`)
  while (j < afterLines.length) out.push(`+ ${afterLines[j++]}`)
  return out.join('\n')
}

function restore(content) {
  writeFileSync(importMapPath, content)
}
