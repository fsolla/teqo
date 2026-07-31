#!/usr/bin/env node
/**
 * Canonical push: bootstrap deps/hooks, run gate:push, then push.
 *
 * Does NOT rely on the Husky pre-push hook — `gate:push` runs here on purpose
 * so worktrees/agents without wired hooks still get the ci-pr mirror (incl.
 * format:check). Uses `--no-verify` only because the gate already ran; this is
 * not an escape hatch (`git push --no-verify` without `pnpm push` still is).
 *
 * Humans who prefer `git push` after `pnpm i` still hit `.husky/pre-push`.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ensureRepoDeps } from './ensure-repo-deps.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const runOrDie = (label, command, args) => {
  console.log(`[pnpm push] ▶ ${label}`)
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' })
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

ensureRepoDeps()
runOrDie('gate:push', 'pnpm', ['gate:push'])

const args = process.argv.slice(2)
const result = spawnSync('git', ['push', '--no-verify', ...args], {
  cwd: repoRoot,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
