#!/usr/bin/env node
/**
 * check-test-locations — always-on guard against misplaced *.spec|*.test files
 * that the affected classifier would miss (false-green skip). Walks the repo
 * (ignoring node_modules, .git, build artifacts) and fails if any spec/test
 * file lives outside the three canonical trees.
 *
 * Pure predicates live in scripts/lib/test-affected-core.mjs; this CLI is the
 * fs walk used by the lint job and by ciSkipInvariants.
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { findMisplacedSpecPaths } from './lib/test-affected-core.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const IGNORE_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'playwright-report',
  'test-results',
  '.playwright-cli',
  '.aider.tags.cache.v4',
  'data',
])

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.test') {
      if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue
      if (entry.isDirectory() && entry.name !== '.github' && entry.name !== '.agents') continue
    }
    if (IGNORE_DIRS.has(entry.name)) continue
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(absolute, out)
      continue
    }
    if (entry.isFile()) {
      out.push(path.relative(repoRoot, absolute).split(path.sep).join('/'))
    }
  }
  return out
}

export function collectRepoRelativeFiles(root = repoRoot) {
  return walk(root)
}

export function checkTestLocations(root = repoRoot) {
  const files = collectRepoRelativeFiles(root)
  return findMisplacedSpecPaths(files)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const misplaced = checkTestLocations()
  if (misplaced.length > 0) {
    console.error(
      `[check-test-locations] misplaced spec/test files (must live under tests/{unit,int,e2e} with the canonical suffix):\n  ${misplaced.join('\n  ')}`,
    )
    process.exit(1)
  }
  console.log('[check-test-locations] ok — all specs in canonical trees')
}
