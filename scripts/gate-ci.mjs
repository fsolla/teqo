#!/usr/bin/env node
/**
 * Local mirror of `.github/workflows/ci-pr.yml` (serial): static checks always;
 * unit/int/e2e follow the same blast-radius selection as CI (`test-affected.mjs`,
 * `e2e-affected.mjs` vs `origin/stage`). Build always runs. `migration-lock` is
 * GitHub-only.
 *
 * Requires local Postgres with `teqo_test` when tests or build run.
 * Escape hatch: `git push --no-verify`.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse as parseEnv } from 'dotenv'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readTestEnv = () => {
  try {
    return parseEnv(readFileSync(path.join(repoRoot, '.env.test'), 'utf8'))
  } catch {
    return {}
  }
}

const testEnv = readTestEnv()

/** Env for migrate / seed / build — matches ci-pr.yml service Postgres. */
const dbEnv = {
  ...process.env,
  DATABASE_URL: testEnv.DATABASE_URL ?? 'postgresql://teqo:teqo@localhost:5432/teqo_test',
  PAYLOAD_SECRET: testEnv.PAYLOAD_SECRET ?? 'test-only-secret-not-used-in-production',
  NEXT_PUBLIC_SITE_URL: testEnv.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
}

const readJsonScript = (script) => {
  const raw = execFileSync('node', [script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  })
  return JSON.parse(raw.trim())
}

const run = (label, command, args, env = process.env) => {
  console.log(`\n[gate:ci] ▶ ${label}`)
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  })
  if (result.status !== 0) {
    console.error(`\n[gate:ci] ✗ ${label} failed (exit ${result.status ?? 1})`)
    process.exit(result.status ?? 1)
  }
}

const testScope = readJsonScript('scripts/test-affected.mjs')
const e2eScope = readJsonScript('scripts/e2e-affected.mjs')

console.log(`[gate:ci] vitest: ${testScope.mode} — ${testScope.reason} (base ${testScope.base})`)
console.log(`[gate:ci] e2e: ${e2eScope.mode} — ${e2eScope.reason} (base ${e2eScope.base})`)
if (e2eScope.unmapped?.length > 0) {
  console.error(
    `[gate:ci] e2e unmapped src/ paths:\n  ${e2eScope.unmapped.join('\n  ')}`,
  )
}

run('preflight (db:doctor)', 'pnpm', ['db:doctor'])
run('lint', 'pnpm', ['lint'])
run('format:check', 'pnpm', ['format:check'])
run('typecheck', 'pnpm', ['typecheck'])
run('knip', 'pnpm', ['exec', 'knip'])
run('check:cycles', 'pnpm', ['check:cycles'])

if (testScope.mode === 'full') {
  run('test:unit (full)', 'pnpm', ['test:unit'])
} else if (testScope.mode === 'changed') {
  run('test:unit (changed)', 'pnpm', [
    'test:unit',
    '--',
    '--changed',
    testScope.base,
    '--passWithNoTests',
  ])
} else {
  console.log('\n[gate:ci] ⊘ test:unit skipped (no src/tests blast radius)')
}

if (testScope.mode !== 'none') {
  run('migrate', 'pnpm', ['migrate'], dbEnv)
  run('db:seed:minimal', 'pnpm', ['db:seed:minimal'], dbEnv)
  if (testScope.mode === 'full') {
    run('test:int (full)', 'pnpm', ['test:int'])
  } else {
    run('test:int (changed)', 'pnpm', [
      'test:int',
      '--',
      '--changed',
      testScope.base,
      '--passWithNoTests',
    ])
  }
} else {
  console.log('\n[gate:ci] ⊘ test:int skipped (no src/tests blast radius)')
}

run('build', 'pnpm', ['build'], dbEnv)

if (e2eScope.mode === 'none') {
  console.log('\n[gate:ci] ⊘ e2e skipped (no e2e blast radius)')
} else {
  run('playwright install chromium', 'pnpm', ['exec', 'playwright', 'install', 'chromium'])
  run('e2e migrate', 'pnpm', ['migrate'], dbEnv)
  run('e2e seed:minimal', 'pnpm', ['db:seed:minimal'], dbEnv)
  run('e2e build', 'pnpm', ['build'], { ...dbEnv, NEXT_DIST_DIR: '.next/e2e' })

  const e2eEnv = { ...dbEnv, E2E_PROD: '1', CI: '1', NEXT_DIST_DIR: '.next/e2e' }
  if (e2eScope.mode === 'full') {
    run('test:e2e (full)', 'pnpm', ['test:e2e'], e2eEnv)
  } else {
    const specPaths = e2eScope.specs.map((name) => `tests/e2e/${name}.e2e.spec.ts`)
    run(`test:e2e (selected: ${e2eScope.specs.join(', ')})`, 'pnpm', ['test:e2e', '--', ...specPaths], e2eEnv)
  }
}

console.log('\n[gate:ci] ✓ all checks passed (ci-pr mirror, affected scope)')
