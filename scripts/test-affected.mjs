#!/usr/bin/env node
/**
 * test-affected (OPS5) — decides the vitest scope for a PR diff and prints it
 * as JSON on stdout: { mode, reason, base }.
 *
 *   mode=full    → run the whole suite (high-risk path / new src file)
 *   mode=changed → run `vitest --changed <base>`
 *   mode=none    → nothing to run (docs-only diff); CI skips the step
 *
 * Base ref: $GITHUB_BASE_REF (PR target) or origin/main locally. No DB, no
 * Payload — pure git + the pure core in scripts/lib/test-affected-core.mjs.
 */
import { execFileSync } from 'node:child_process'

import { classifyTestScope } from './lib/test-affected-core.mjs'

const base = `origin/${process.env.GITHUB_BASE_REF ?? 'main'}`

let mergeBase
try {
  mergeBase = execFileSync('git', ['merge-base', 'HEAD', base], { encoding: 'utf8' }).trim()
} catch {
  const result = { mode: 'full', reason: `no merge-base with ${base} (shallow clone?)`, base }
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

console.log(JSON.stringify({ ...classifyTestScope(files), base }))
