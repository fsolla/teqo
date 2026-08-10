#!/usr/bin/env node
/**
 * ci-scope — single classifier for PR job-level skips. Prints JSON:
 * { base, code, build, test, e2e } where each of code/build/test/e2e is the
 * classify* / selectE2eSpecs result. Used by the `scope` job in ci-pr.yml.
 *
 * Base ref: $GITHUB_BASE_REF (PR target) or origin/main locally.
 */
import { execFileSync } from 'node:child_process'

import { E2E_AFFECTED_MANIFEST } from './lib/e2e-affected-manifest.mjs'
import {
  classifyBuildScope,
  classifyStaticScope,
  classifyTestScope,
  e2eShardConfig,
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
      e2e: { mode: 'full', specs: [], reason: full.reason, unmapped: [] },
      // The scope job always reads e2e_shards.matrix/total — keep the fallback
      // total (ci-pr.yml's fromJson must never receive a null/empty matrix).
      e2e_shards: e2eShardConfig('full'),
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
  console.error(
    `[ci-scope] src/ paths with no e2e manifest mapping:\n  ${e2e.unmapped.join('\n  ')}`,
  )
}

console.log(
  JSON.stringify({
    base,
    code: classifyStaticScope(files),
    build: classifyBuildScope(files),
    test: classifyTestScope(files),
    e2e,
    e2e_shards: e2eShardConfig(e2e.mode),
  }),
)
