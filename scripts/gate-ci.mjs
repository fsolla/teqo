#!/usr/bin/env node
/**
 * Local mirror of `.github/workflows/ci-pr.yml` (serial): phase-1 cheap checks,
 * then phase-2 expensive (int/build/e2e). Skips align with `scripts/ci-scope.mjs`
 * (`origin/main` by default). `migration-lock` is GitHub-only.
 *
 * Preflight checks only `teqo_test` (ci-pr never touches the dev DB). Escape
 * during pipeline cutover: `git push --no-verify` (documented in AGENT-OPS).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse as parseEnv } from 'dotenv'

import { diagnoseDatabaseTarget } from './db-doctor.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readTestEnv = () => {
  // `.env.test.local` (per-worktree, gitignored, written by `pnpm worktree next`)
  // wins over the committed `.env.test`, mirroring vitest.setup.ts.
  const layered = {}
  for (const name of ['.env.test', '.env.test.local']) {
    try {
      Object.assign(layered, parseEnv(readFileSync(path.join(repoRoot, name), 'utf8')))
    } catch {
      // file missing — fine
    }
  }
  return layered
}

const testEnv = readTestEnv()

/** Env for migrate / seed / build — matches ci-pr.yml service Postgres. */
const dbEnv = {
  ...process.env,
  DATABASE_URL:
    testEnv.TEQO_TEST_DATABASE_URL ??
    testEnv.DATABASE_URL ??
    'postgresql://teqo:teqo@localhost:5432/teqo_test',
  PAYLOAD_SECRET: testEnv.PAYLOAD_SECRET ?? 'test-only-secret-not-used-in-production',
  NEXT_PUBLIC_SITE_URL: testEnv.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
}

const readJsonScript = (script) => {
  const raw = execFileSync('node', [script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  })
  return JSON.parse(raw.trim().split('\n').filter(Boolean).at(-1))
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

const main = async () => {
  const scope = readJsonScript('scripts/ci-scope.mjs')

  console.log(
    `[gate:ci] scope base=${scope.base} code=${scope.code.mode} build=${scope.build.mode} test=${scope.test.mode} e2e=${scope.e2e.mode}`,
  )
  if (scope.e2e.unmapped?.length > 0) {
    console.error(`[gate:ci] e2e unmapped src/ paths:\n  ${scope.e2e.unmapped.join('\n  ')}`)
  }

  // --- Phase 1 (cheap) ---
  run('check-test-locations', 'node', ['scripts/check-test-locations.mjs'])
  run('lint', 'pnpm', ['lint'])
  run('format:check', 'pnpm', ['format:check'])

  if (scope.code.mode === 'none') {
    console.log('\n[gate:ci] ⊘ typecheck/knip/cycles skipped (no code surface)')
  } else {
    run('typecheck', 'pnpm', ['typecheck'])
    run('knip', 'pnpm', ['knip'])
    run('check:cycles', 'pnpm', ['check:cycles'])
  }

  if (scope.test.mode === 'full') {
    run('test:unit (full)', 'pnpm', ['test:unit'])
  } else if (scope.test.mode === 'changed') {
    run('test:unit (changed)', 'pnpm', [
      'test:unit',
      '--',
      '--changed',
      scope.base,
      '--passWithNoTests',
    ])
  } else {
    console.log('\n[gate:ci] ⊘ test:unit skipped (no src/tests blast radius)')
  }

  // --- Phase 2 (expensive) — only when phase 1 would have been green ---
  const needsDb =
    scope.test.mode !== 'none' || scope.build.mode !== 'none' || scope.e2e.mode !== 'none'
  if (needsDb) {
    console.log('\n[gate:ci] ▶ preflight (teqo_test)')
    const dbOk = await diagnoseDatabaseTarget({
      label: 'test',
      databaseUrl: dbEnv.DATABASE_URL,
    })
    if (!dbOk) {
      console.error('\n[gate:ci] ✗ preflight (teqo_test) failed — run `pnpm db:start`')
      process.exit(1)
    }
  }

  if (scope.test.mode !== 'none') {
    run('migrate', 'pnpm', ['migrate'], dbEnv)
    run('db:seed:minimal', 'pnpm', ['db:seed:minimal'], dbEnv)
    if (scope.test.mode === 'full') {
      run('test:int (full)', 'pnpm', ['test:int'])
    } else {
      run('test:int (changed)', 'pnpm', [
        'test:int',
        '--',
        '--changed',
        scope.base,
        '--passWithNoTests',
      ])
    }
  } else {
    console.log('\n[gate:ci] ⊘ test:int skipped (no src/tests blast radius)')
  }

  if (scope.build.mode === 'none') {
    console.log('\n[gate:ci] ⊘ build skipped (no build surface)')
  } else {
    run('build', 'pnpm', ['build'], dbEnv)
  }

  if (scope.e2e.mode === 'none') {
    console.log('\n[gate:ci] ⊘ e2e skipped (no e2e blast radius)')
  } else {
    run('playwright install chromium', 'pnpm', ['exec', 'playwright', 'install', 'chromium'])
    run('e2e migrate', 'pnpm', ['migrate'], dbEnv)
    run('e2e seed:minimal', 'pnpm', ['db:seed:minimal'], dbEnv)
    run('e2e build', 'pnpm', ['build'], { ...dbEnv, NEXT_DIST_DIR: '.next/e2e' })

    const e2eEnv = { ...dbEnv, E2E_PROD: '1', CI: '1', NEXT_DIST_DIR: '.next/e2e' }
    if (scope.e2e.mode === 'full') {
      run('test:e2e (full)', 'pnpm', ['test:e2e'], e2eEnv)
    } else {
      const specPaths = scope.e2e.specs.map((name) => `tests/e2e/${name}.e2e.spec.ts`)
      run(
        `test:e2e (selected: ${scope.e2e.specs.join(', ')})`,
        'pnpm',
        ['test:e2e', '--', ...specPaths],
        e2eEnv,
      )
    }
  }

  console.log('\n[gate:ci] ✓ all checks passed (ci-pr mirror, cascade + affected scope)')
}

await main()
