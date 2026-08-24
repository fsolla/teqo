#!/usr/bin/env node
/**
 * run-e2e-affected — local mirror of the CI (PR) e2e job:
 *   1. `e2e-affected.mjs` picks the scope vs the same base ref.
 *   2. migrate + db:seed:minimal when anything would run.
 *   3. optional production build into `.next-e2e` when `E2E_PROD=1`.
 *   4. `pnpm test:e2e` (set `CI=1` and `E2E_PROD=1` together for prod mode).
 *
 * Mode behavior (OPS86):
 *   - selected → run the mapped specs (filtered, `--no-deps`).
 *   - curated (high-risk) → run the FULL suite locally — the local contract
 *     from OPS72 stays: local high-risk = full; the CI runs only the curated
 *     cross-section, and the deploy verify runs full before publishing.
 *   - unmapped-risk → SOFT locally (a debugging tool never gates): print the
 *     file list and run the curated cross-section with a warning. The CI
 *     fails closed on this mode.
 *   - full (no merge-base fallback) → run the full suite.
 *
 * Extra Playwright args are forwarded verbatim (e.g. a single spec while
 * debugging): pnpm consumes the first `--` separator, so the script only ever
 * strips a leading `--` left by direct `node scripts/...` invocations
 * (S6-FOLLOWUP). Flag values like `-g grade` pass through untouched.
 *
 * Filtered runs get `--no-deps` (S6-FOLLOWUP): in dev mode the project
 * dependency chain drags every dependency project's files into a selected run
 * via buildProjectsClosure; --no-deps disables that closure. Full runs keep
 * the dev chain (OPS34 prewarm ordering).
 *
 *   GITHUB_BASE_REF=stage node scripts/run-e2e-affected.mjs
 *   pnpm test:e2e:affected -- tests/e2e/campaignHomeActions.e2e.spec.ts
 */
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { E2E_CURATED_SPECS } from './lib/e2e-affected-manifest.mjs'
import { buildPlaywrightE2eArgs, parsePassthroughArgs } from './lib/playwright-e2e-args.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const passthroughArgs = parsePassthroughArgs(process.argv)

const scopeRaw = execFileSync('node', ['scripts/e2e-affected.mjs'], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: process.env,
})
const scope = JSON.parse(scopeRaw.trim())

console.log(`[e2e:affected] ${scope.reason} (base ${scope.base})`)

if (scope.mode === 'none') {
  console.log('[e2e:affected] Nothing to run for this diff.')
  process.exit(0)
}

if (scope.mode === 'unmapped-risk') {
  console.warn(
    `[e2e:affected] ⚠ RISK-AREA files without a manifest mapping (CI FAILS closed on this; running the curated set locally):\n  ${scope.unmapped.join('\n  ')}`,
  )
}

const run = (command, args, env = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('pnpm', ['migrate'])
run('pnpm', ['db:seed:minimal'])
if (process.env.E2E_PROD === '1') {
  run('pnpm', ['build'], { NEXT_DIST_DIR: '.next-e2e' })
}

const curatedSpecPaths = E2E_CURATED_SPECS.map((name) => `tests/e2e/${name}.e2e.spec.ts`)
const scopeSpecPaths =
  scope.mode === 'selected'
    ? scope.specs.map((name) => `tests/e2e/${name}.e2e.spec.ts`)
    : scope.mode === 'unmapped-risk'
      ? curatedSpecPaths
      : [] // curated/full → run the whole suite locally
const playwrightArgs = buildPlaywrightE2eArgs({
  scopeSpecPaths,
  passthroughArgs,
})

run('pnpm', playwrightArgs, {
  ...(process.env.E2E_PROD === '1' ? { CI: '1', E2E_PROD: '1' } : {}),
})
