#!/usr/bin/env node
/**
 * measure-e2e-family (OPS87) — reproducible per-family e2e timing, the tool
 * behind the pyramid's acceptance criterion: "tempo browser vs tempo HTTP,
 * medido de verdade, nunca estimativa".
 *
 * Runs the given specs against the PRODUCTION build with `--reporter=json`
 * and prints one table per spec file: per-test durations plus totals. Dev
 * mode is refused on purpose — cold webpack compiles pollute the comparativo
 * (OPS34 measured it), and the deploy gate itself runs the prod build.
 *
 *   NEXT_DIST_DIR=.next-e2e pnpm build   # once, before the first run
 *   node scripts/measure-e2e-family.mjs tests/e2e/campaignConcepts.e2e.spec.ts \
 *       tests/e2e/campaignPeopleHttp.e2e.spec.ts
 *
 * Args accept full repo-relative spec paths or bare family names
 * (`campaignPeople` → `tests/e2e/campaignPeople.e2e.spec.ts`).
 *
 * Protocol (impl plan Decisão 3): same machine, same `PLAYWRIGHT_WORKERS`
 * (default 2), baseline colhido ANTES de editar os specs; a tabela alimenta o
 * changelog do item. Durations come from Playwright's own JSON report
 * (`suites[].specs[].tests[].results[].duration`, ms) — wall time per test
 * including fixture time, never an estimate.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const usage = () => {
  console.error(
    [
      'usage: node scripts/measure-e2e-family.mjs <spec...>',
      '  spec — repo-relative spec path or bare family name (campaignPeople).',
      'requires: E2E_PROD=1 and an existing production build in .next-e2e',
      '  (NEXT_DIST_DIR=.next-e2e pnpm build).',
    ].join('\n'),
  )
  process.exit(2)
}

const args = process.argv.slice(2)
if (args.length === 0) usage()

const specPaths = args.map((arg) => (arg.includes('/') ? arg : `tests/e2e/${arg}.e2e.spec.ts`))
for (const specPath of specPaths) {
  if (!existsSync(path.join(repoRoot, specPath))) {
    console.error(`[measure] spec not found: ${specPath}`)
    usage()
  }
}

if (process.env.E2E_PROD !== '1') {
  console.error(
    '[measure] refusing dev-mode measurement — cold compiles pollute the timing. Run with E2E_PROD=1.',
  )
  process.exit(2)
}
if (!existsSync(path.join(repoRoot, '.next-e2e'))) {
  console.error(
    '[measure] no production build in .next-e2e — run `NEXT_DIST_DIR=.next-e2e pnpm build` first.',
  )
  process.exit(2)
}

const workers = process.env.PLAYWRIGHT_WORKERS ?? '2'
console.log(`[measure] prod build, workers=${workers}, specs: ${specPaths.length}`)

const result = spawnSync('pnpm', ['test:e2e', '--no-deps', '--reporter=json', '--', ...specPaths], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: { ...process.env, E2E_PROD: '1', PLAYWRIGHT_WORKERS: workers },
  maxBuffer: 64 * 1024 * 1024,
})

if (result.status !== 0) {
  console.error(`[measure] playwright exited ${result.status}`)
  console.error(result.stderr ?? '')
  console.error((result.stdout ?? '').slice(-4000))
  process.exit(result.status ?? 1)
}

// `pnpm` echoes its script banner to stdout before Playwright's JSON report.
// The report object opens with the `config` key — anchor on it instead of the
// first `{`, so a stray brace in a banner line cannot corrupt the slice.
const jsonStart = result.stdout.indexOf('{"config"')
if (jsonStart === -1) {
  console.error('[measure] playwright produced no JSON report on stdout')
  process.exit(2)
}
const report = JSON.parse(result.stdout.slice(jsonStart))

/**
 * JSON reporter shape (Playwright 1.5x): describe-level suites carry `file`
 * and `specs[]`; a spec IS one test — `spec.title` names it and
 * `spec.tests[].results[].duration` holds the retry-run wall times (ms).
 * Describe suites share the same `file`, so entries are merged per file.
 * @returns {Array<{ file: string, ok: boolean, tests: Array<{ title: string, duration: number }> }>}
 */
const collectSpecs = (suite) => {
  const found = []
  if (suite.file && suite.specs?.length) {
    found.push({
      file: suite.file,
      ok: suite.specs.every((spec) => spec.ok),
      tests: suite.specs.map((spec) => ({
        title: spec.title,
        duration: spec.tests.reduce(
          (sum, test) => sum + test.results.reduce((acc, entry) => acc + (entry.duration ?? 0), 0),
          0,
        ),
      })),
    })
  }
  for (const child of suite.suites ?? []) found.push(...collectSpecs(child))
  return found
}

const families = new Map()
for (const entry of collectSpecs({ suites: report.suites })) {
  const family = families.get(entry.file) ?? { file: entry.file, ok: true, tests: [] }
  family.ok = family.ok && entry.ok
  family.tests.push(...entry.tests)
  families.set(entry.file, family)
}
const fmt = (ms) => `${(ms / 1000).toFixed(1)}s`
let grandTotal = 0
for (const family of families.values()) {
  const total = family.tests.reduce((sum, test) => sum + test.duration, 0)
  grandTotal += total
  console.log(
    `\n${family.file} — ${family.tests.length} tests, ${fmt(total)}${family.ok ? '' : ' (FAILED)'}`,
  )
  for (const test of family.tests) console.log(`  ${fmt(test.duration).padStart(6)}  ${test.title}`)
}
console.log(`\nTOTAL: ${fmt(grandTotal)} across ${families.size} spec file(s)`)
