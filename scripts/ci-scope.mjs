#!/usr/bin/env node
/**
 * ci-scope — single classifier for PR step-level skips. Prints JSON:
 * { base, code, build, test, e2e } where each of code/build/test/e2e is the
 * classify* / selectE2eSpecs result. Used by the `scope` step (id: scope) in
 * ci-pr.yml — its outputs drive `if:` on the heavy steps.
 *
 * e2e modes (OPS86): none | selected | curated | unmapped-risk — the PR CI
 * gates the e2e step on `selected || curated` and fails closed on
 * `unmapped-risk`; the full suite stays in the deploy verify.
 *
 * Base ref: $GITHUB_BASE_REF (PR target) or origin/main locally.
 */
import { execFileSync } from 'node:child_process'

import { E2E_AFFECTED_MANIFEST, E2E_CURATED_SPECS } from './lib/e2e-affected-manifest.mjs'
import {
  classifyBuildScope,
  classifyStaticScope,
  classifyTestScope,
  selectE2eSpecs,
} from './lib/test-affected-core.mjs'

const base = `origin/${process.env.GITHUB_BASE_REF ?? 'main'}`

let mergeBase
try {
  mergeBase = execFileSync('git', ['merge-base', 'HEAD', base], { encoding: 'utf8' }).trim()
} catch {
  const full = {
    mode: 'full',
    reason: `no merge-base with ${base} (shallow clone?)`,
  }
  console.log(
    JSON.stringify({
      base,
      code: { mode: 'code', reason: full.reason },
      build: { mode: 'build', reason: full.reason },
      test: { ...full },
      // The PR can never run e2e full — without a merge-base the safest
      // never-zero answer is the curated cross-section (OPS86).
      e2e: { mode: 'curated', specs: [...E2E_CURATED_SPECS], reason: full.reason, unmapped: [] },
    }),
  )
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

const e2e = selectE2eSpecs(files, E2E_AFFECTED_MANIFEST)
if (e2e.unmapped.length > 0) {
  const label =
    e2e.mode === 'unmapped-risk'
      ? '[ci-scope] RISK-AREA paths with no e2e manifest mapping (CI will fail closed):'
      : '[ci-scope] src/ paths with no e2e manifest mapping (selection may not cover them):'
  console.error(`${label}\n  ${e2e.unmapped.join('\n  ')}`)
}

console.log(
  JSON.stringify({
    base,
    code: classifyStaticScope(files),
    build: classifyBuildScope(files),
    test: classifyTestScope(files),
    e2e,
  }),
)
