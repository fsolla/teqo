#!/usr/bin/env node
/**
 * Wrapper for `payload generate:importmap` that always injects dummy S3_*
 * envs (when unset) so the generated importMap carries the
 * S3ClientUploadHandler entry — regenerating without the S3_* envs silently
 * orphans it and the admin goes blank in production (class
 * OPS69/OPS72/OPS73). Dummy values are fine: the generator only iterates the
 * config, it never connects to the bucket.
 */
import { spawnSync } from 'node:child_process'

import { S3_STORAGE_ENV_KEYS } from './lib/importMapContract.mjs'

const DUMMY = {
  S3_BUCKET: 'dev-dummy-bucket',
  S3_ENDPOINT: 'http://127.0.0.1:3900',
  S3_ACCESS_KEY_ID: 'dev-dummy-access-key',
  S3_SECRET_ACCESS_KEY: 'dev-dummy-secret-key',
}

const env = {
  ...process.env,
  // Same NODE_OPTIONS as before — the payload CLI loads server-only modules.
  NODE_OPTIONS: '--no-deprecation --conditions=react-server',
  ...Object.fromEntries(
    S3_STORAGE_ENV_KEYS.map((key) => [key, process.env[key]?.trim() || DUMMY[key]]),
  ),
}

const result = spawnSync('payload', ['generate:importmap'], {
  stdio: 'inherit',
  env,
})

process.exit(result.status ?? 1)
