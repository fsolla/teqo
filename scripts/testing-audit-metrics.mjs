#!/usr/bin/env node
/**
 * testing-audit-metrics (OPS96) — the cheap-metrics tool behind /testing-audit:
 * per-layer portrait of the suite from native reporters, nothing third-party.
 *
 *   node scripts/testing-audit-metrics.mjs unit|int [--top N]
 *   node scripts/testing-audit-metrics.mjs e2e-inventory
 *
 * unit/int: spawns `pnpm test:<layer> --reporter=json` (the package scripts
 * carry their own env guards — invalid DATABASE_URL for unit, .env.test.local
 * worktree DB for int), parses the JSON payload and prints totals plus a
 * slowest-files markdown table for the audit report. The runner's exit code
 * propagates: a red suite still prints its portrait, then fails.
 * e2e-inventory: static count of describe/test blocks per spec file — durations
 * are deliberately absent because running Playwright overnight is forbidden.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_TOP,
  inventoryE2ESource,
  ms,
  parseVitestStdout,
  renderE2EInventoryTable,
  renderSlowestFilesTable,
  summarizeVitestReport,
} from './lib/testing-audit-metrics-core.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const E2E_DIR = 'tests/e2e'

const usage = () => {
  console.error('usage: node scripts/testing-audit-metrics.mjs <unit|int|e2e-inventory> [--top N]')
  process.exit(2)
}

const args = process.argv.slice(2)
const mode = args.find((arg) => !arg.startsWith('--'))
if (mode !== 'unit' && mode !== 'int' && mode !== 'e2e-inventory') usage()
const topFlag = args.indexOf('--top')
const top = topFlag === -1 ? DEFAULT_TOP : Number(args[topFlag + 1])
if (!Number.isInteger(top) || top <= 0) usage()

const runVitestLayer = async (layer) => {
  console.log(`[metrics] rodando pnpm test:${layer} --reporter=json …`)
  const result = spawnSync('pnpm', [`test:${layer}`, '--reporter=json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  let report
  try {
    report = parseVitestStdout(result.stdout ?? '')
  } catch (error) {
    console.error(`[metrics] ${error instanceof Error ? error.message : error}`)
    if (result.status !== 0) {
      console.error((result.stderr ?? '').slice(-4000))
      process.exit(result.status)
    }
    process.exit(2)
  }
  const summary = summarizeVitestReport(report)
  console.log(
    `\n## ${layer} — ${summary.totals.files} arquivos / ${summary.totals.tests} testes` +
      ` (${summary.totals.failedTests} falhas) / parede dos arquivos ${ms(summary.totals.durationMs)}\n`,
  )
  console.log(renderSlowestFilesTable(summary, { top }))
  if (result.status !== 0) process.exit(result.status)
}

const runE2EInventory = () => {
  const dir = path.join(repoRoot, E2E_DIR)
  const rows = readdirSync(dir)
    .filter((name) => name.endsWith('.spec.ts'))
    .sort()
    .map((name) =>
      inventoryE2ESource({
        file: `${E2E_DIR}/${name}`,
        content: readFileSync(path.join(dir, name), 'utf8'),
      }),
    )
  const totalTests = rows.reduce((sum, row) => sum + row.tests, 0)
  console.log(`\n## e2e (inventário estático) — ${rows.length} arquivos / ${totalTests} testes\n`)
  console.log(renderE2EInventoryTable(rows))
}

if (mode === 'e2e-inventory') runE2EInventory()
else await runVitestLayer(mode)
