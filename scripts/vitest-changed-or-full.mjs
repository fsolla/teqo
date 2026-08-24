#!/usr/bin/env node
/**
 * vitest-changed-or-full (OPS86) — the CI/gate `changed` unit/int steps must
 * never run zero tests in silence: `vitest run --changed <base>
 * --passWithNoTests` exits green with zero executions when the diff touches
 * no spec file. This wrapper lists the changed specs first
 * (`vitest list --changed <base> --json`) and falls back to the FULL suite
 * when the selection is empty. Full unit is cheap; full int is rare (only
 * when src/tests changed yet no int spec depends on them).
 *
 * Usage: node scripts/vitest-changed-or-full.mjs --suite unit|int --base <git-ref>
 * Exit code is the test run's — the wrapper never turns red into green.
 *
 * The env/config pairs mirror the `test:unit` / `test:int` package.json
 * scripts; keep them in sync (both are pinned by ciSkipInvariants).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SUITES = {
  unit: {
    config: './vitest.unit.config.mts',
    runScript: 'test:unit',
    // Same invalid URL as the `test:unit` script: unit specs must not touch a DB.
    env: { DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/unit_tests_must_not_connect' },
  },
  int: {
    config: './vitest.config.mts',
    runScript: 'test:int',
    env: {},
  },
}

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--suite') args.suite = process.argv[++i]
  else if (process.argv[i] === '--base') args.base = process.argv[++i]
  else throw new Error(`unknown arg: ${process.argv[i]}`)
}
if (!args.suite || !SUITES[args.suite] || !args.base) {
  throw new Error('usage: vitest-changed-or-full.mjs --suite unit|int --base <git-ref>')
}
const suite = SUITES[args.suite]

const listResult = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'list', '--config', suite.config, '--changed', args.base, '--json'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...suite.env, NODE_OPTIONS: '--no-deprecation' },
  },
)
if (listResult.status !== 0) {
  console.error(`[vitest-changed-or-full] ✗ vitest list failed (exit ${listResult.status ?? 1})`)
  process.exit(listResult.status ?? 1)
}
const changedSpecs = JSON.parse(listResult.stdout)

const run = (label, argv, env = process.env) => {
  console.log(`\n[vitest-changed-or-full] ▶ ${args.suite} ${label}`)
  const result = spawnSync('pnpm', argv, { cwd: repoRoot, stdio: 'inherit', env })
  process.exit(result.status ?? 1)
}

if (changedSpecs.length === 0) {
  console.log(
    `[vitest-changed-or-full] --changed ${args.base} selected zero ${args.suite} specs — running the FULL suite (never green with 0 tests, OPS86)`,
  )
  run('(full fallback)', [suite.runScript])
} else {
  console.log(
    `[vitest-changed-or-full] ${changedSpecs.length} ${args.suite} spec(s) changed — running the selection`,
  )
  run('(changed)', [suite.runScript, '--', '--changed', args.base, '--passWithNoTests'])
}
