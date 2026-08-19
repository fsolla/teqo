#!/usr/bin/env node
/**
 * Local mirror of `.github/workflows/ci-pr.yml` (serial): phase-1 cheap checks,
 * then phase-2 expensive (int/build). e2e is NOT part of the local mirror
* (OPS59 + OPS72): the PR CI runs only the e2e blast radius (mode `selected`,
 * never `full`), the deploy `verify` job runs the full suite before
 * publishing, and the local affected run is a skill step (discretionary):
 * `pnpm test:e2e:affected`.
 * Docs guards (OPS63): the `docs-guards` checks (changelog append-only,
 * aggregate sync, conflict markers) also run here — cheap git diffs, same
 * scripts the CI job runs (the `changelog-rewrite:` escape stays CI-only,
 * PR body).
 * Skips align with `scripts/ci-scope.mjs` (`origin/main` by default).
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
    `[gate:ci] scope base=${scope.base} code=${scope.code.mode} build=${scope.build.mode} test=${scope.test.mode} e2e=${scope.e2e.mode} (e2e not in this gate — OPS72; local affected is a skill step)`,
  )

  // --- Phase 1 (cheap) ---
  run('check-test-locations', 'node', ['scripts/check-test-locations.mjs'])
  run('lint', 'pnpm', ['lint'])
  run('format:check', 'pnpm', ['format:check'])

  // --- Docs guards (OPS63): same checks as the CI `docs-guards` job ---
  run('docs-guards (changelog append-only)', 'node', ['scripts/check-changelog-append-only.mjs'])
  run('docs-guards (aggregate sync)', 'node', ['scripts/build-changelog.mjs', '--check'])
  run('docs-guards (conflict markers)', 'node', ['scripts/check-docs-conflict-markers.mjs'])

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
  const needsDb = scope.test.mode !== 'none' || scope.build.mode !== 'none'
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
    console.log('\n[gate:ci] ⊘ e2e: CI will skip (no e2e blast radius)')
  } else if (scope.e2e.mode === 'selected') {
    console.log(
      `\n[gate:ci] ▶ e2e: CI runs the blast radius (${scope.e2e.specs.join(', ')}) — not in this gate (OPS72); full lives in deploy verify`,
    )
  } else {
    console.log(
      '\n[gate:ci] ▶ e2e: diff is high-risk (full mode) — no e2e in this PR by design (OPS72); run `pnpm test:e2e:affected` locally; deploy verify runs full before publishing',
    )
  }

  console.log(
    '\n[gate:ci] ✓ all checks passed (ci-pr mirror: docs guards local — OPS63; e2e: local affected is a skill step — OPS72)',
  )
}

await main()
