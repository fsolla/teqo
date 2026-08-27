#!/usr/bin/env node
/**
 * Predev hook: generate importMap if missing or stale (OPS99).
 *
 * The importMap is now a build artifact, not committed to git. This script
 * ensures it exists before `pnpm dev` starts, using dummy S3_* envs.
 *
 * Checks if the file exists and is newer than payload.config.ts.
 * If missing or stale, regenerates with dummy S3_* envs.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const importMapPath = path.join(repoRoot, 'src/app/(payload)/admin/importMap.js')
const payloadConfigPath = path.join(repoRoot, 'payload.config.ts')

// Dummy S3_* envs for generation (same as Dockerfile and CI guard)
const DUMMY_S3_ENV = {
  S3_BUCKET: 'dev-dummy',
  S3_ENDPOINT: 'http://127.0.0.1:3900',
  S3_ACCESS_KEY_ID: 'dev-dummy',
  S3_SECRET_ACCESS_KEY: 'dev-dummy',
}

function needsRegeneration() {
  if (!existsSync(importMapPath)) return true
  if (!existsSync(payloadConfigPath)) return false

  const importMapMtime = statSync(importMapPath).mtimeMs
  const configMtime = statSync(payloadConfigPath).mtimeMs
  return configMtime > importMapMtime
}

function generateImportMap() {
  console.log('[predev-importmap] generating importMap with dummy S3_* envs...')
  const env = {
    ...process.env,
    NODE_OPTIONS: '--no-deprecation --conditions=react-server',
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'dev-secret',
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dev:dev@127.0.0.1:5432/teqo',
    ...DUMMY_S3_ENV,
  }

  try {
    execFileSync('pnpm', ['exec', 'payload', 'generate:importmap'], {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
    })
    console.log('[predev-importmap] importMap generated successfully')
  } catch (_error) {
    console.error('[predev-importmap] failed to generate importMap')
    process.exit(1)
  }
}

if (needsRegeneration()) {
  generateImportMap()
} else {
  console.log('[predev-importmap] importMap is up to date')
}
