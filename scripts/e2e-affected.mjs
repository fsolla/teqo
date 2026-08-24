#!/usr/bin/env node
/**
 * e2e-affected (OPS5) — decides the Playwright scope for a PR diff via the
 * curated manifest and prints JSON on stdout:
 * { mode, specs, reason, unmapped, base }.
 *
 *   mode=selected      → run tests/e2e/<name>.e2e.spec.ts for each name in `specs`
 *   mode=curated       → high-risk diff; the local runner treats it as full
 *   mode=unmapped-risk → risk-area files without a manifest entry (CI fails
 *                        closed; the local runner warns and runs the curated set)
 *   mode=none          → skip e2e for this diff
 *   mode=full          → only the no-merge-base fallback (local) — run everything
 *
 * `unmapped` src/ files go to stderr as a warning — never a failure here (the
 * CI scope step is the gate; e2e is a thin layer over int).
 */
import { execFileSync } from 'node:child_process'

import { E2E_AFFECTED_MANIFEST } from './lib/e2e-affected-manifest.mjs'
import { selectE2eSpecs } from './lib/test-affected-core.mjs'

const base = `origin/${process.env.GITHUB_BASE_REF ?? 'main'}`

let mergeBase
try {
  mergeBase = execFileSync('git', ['merge-base', 'HEAD', base], { encoding: 'utf8' }).trim()
} catch {
  const result = {
    mode: 'full',
    specs: [],
    reason: `no merge-base with ${base} (shallow clone?)`,
    unmapped: [],
    base,
  }
  console.log(JSON.stringify(result))
  process.exit(0)
}

const raw = execFileSync('git', ['diff', '--name-status', `${mergeBase}...HEAD`], {
  encoding: 'utf8',
})
const files = raw
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [status, path] = line.split('\t')
    return { status, path }
  })

const result = { ...selectE2eSpecs(files, E2E_AFFECTED_MANIFEST), base }
if (result.unmapped.length > 0) {
  console.error(
    `[e2e-affected] src/ paths with no manifest mapping:\n  ${result.unmapped.join('\n  ')}`,
  )
}
console.log(JSON.stringify(result))
