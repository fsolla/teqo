#!/usr/bin/env node
/**
 * Idempotent bootstrap for worktrees/clones before hooks or gate scripts run.
 * Installs deps when `node_modules` is missing/stale and wires Husky hooks.
 *
 * Used by `.husky/pre-push` and `pnpm push` — no imports from `scripts/lib/`
 * (those need `node_modules` first).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const runOrDie = (label, command, args) => {
  console.log(`[ensure-deps] ${label}`)
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' })
  if ((result.status ?? 1) !== 0) {
    console.error(`[ensure-deps] failed: ${command} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

const needsInstall = () => {
  const nodeModules = path.join(repoRoot, 'node_modules')
  const lockfile = path.join(repoRoot, 'pnpm-lock.yaml')
  if (!existsSync(nodeModules) || !existsSync(path.join(nodeModules, '.pnpm'))) return true
  if (!existsSync(path.join(nodeModules, '.bin', 'prettier'))) return true
  if (!existsSync(lockfile)) return false
  return statSync(lockfile).mtimeMs > statSync(nodeModules).mtimeMs
}

const huskyHooksMissing = () => {
  try {
    const hooksPath = execFileSync('git', ['config', 'core.hooksPath'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim()
    return !hooksPath.includes('husky')
  } catch {
    return true
  }
}

export const ensureRepoDeps = () => {
  if (needsInstall()) {
    runOrDie('pnpm install --frozen-lockfile', 'pnpm', ['install', '--frozen-lockfile'])
  }
  if (huskyHooksMissing()) {
    runOrDie('pnpm run prepare (husky)', 'pnpm', ['run', 'prepare'])
  }
}

if (process.argv[1]?.endsWith('ensure-repo-deps.mjs')) {
  ensureRepoDeps()
}
