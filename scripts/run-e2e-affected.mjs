#!/usr/bin/env node
/**
 * run-e2e-affected — local mirror of the CI (PR) e2e job:
 *   1. `e2e-affected.mjs` picks full vs manifest-selected vs skip (same base ref).
 *   2. migrate + db:seed:minimal when anything would run.
 *   3. optional production build into `.next-e2e` when `E2E_PROD=1`.
 *   4. `pnpm test:e2e` (set `CI=1` and `E2E_PROD=1` together for prod mode).
 *
 * Extra Playwright args after `--` are forwarded (e.g. a single spec while debugging).
 *
 *   GITHUB_BASE_REF=stage node scripts/run-e2e-affected.mjs
 *   pnpm test:e2e:affected -- tests/e2e/campaignHomeActions.e2e.spec.ts
 */
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const passthroughIndex = process.argv.indexOf('--')
const passthroughArgs = passthroughIndex === -1 ? [] : process.argv.slice(passthroughIndex + 1)

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

const playwrightArgs = ['test:e2e']
if (scope.mode === 'selected' && scope.specs.length > 0) {
  for (const name of scope.specs) {
    playwrightArgs.push(`tests/e2e/${name}.e2e.spec.ts`)
  }
}
playwrightArgs.push(...passthroughArgs)

run('pnpm', playwrightArgs, {
  ...(process.env.E2E_PROD === '1' ? { CI: '1', E2E_PROD: '1' } : {}),
})
