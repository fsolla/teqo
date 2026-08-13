#!/usr/bin/env node
/**
 * check-docs-conflict-markers — CI guard (OPS44): a PR diff touching
 * markdown/mdc files (docs/, AGENTS.md, .agents/, …) must not commit
 * conflict markers. Extends the OPS41 repo-wide scan
 * (tests/unit/codebaseConventions.unit.spec.ts, which shares the regex via
 * scripts/lib/conflictMarkers.mjs) to docs-only PRs, where the unit suite
 * is skipped (code_mode: none) — the exact class of the OPS41 incident
 * (a marker committed to AGENTS.md at the repo root).
 *
 * Paths from git diff (merge-base…HEAD) filtered to markdown-ish files.
 */
import { execFileSync } from 'node:child_process'

import { findConflictMarkerLines, markdownPathsOf } from './lib/conflictMarkers.mjs'

const base = `origin/${process.env.GITHUB_BASE_REF ?? 'main'}`

function die(message) {
  console.error(`[check-docs-conflict-markers] ${message}`)
  process.exit(1)
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

let mergeBase
try {
  mergeBase = git(['merge-base', 'HEAD', base])
} catch {
  die(`no merge-base with ${base} (shallow clone?)`)
}

const raw = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACMR', `${mergeBase}...HEAD`],
  { encoding: 'utf8' },
)
const changedPaths = raw
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const scannedPaths = markdownPathsOf(changedPaths)
if (scannedPaths.length === 0) {
  console.log('[check-docs-conflict-markers] ok — no markdown changes')
  process.exit(0)
}

const offenders = []
for (const path of scannedPaths) {
  let content
  try {
    content = git(['show', `HEAD:${path}`])
  } catch {
    die(`failed to read HEAD:${path}`)
  }
  for (const { line } of findConflictMarkerLines(content)) {
    offenders.push(`${path}:${line}`)
  }
}

if (offenders.length > 0) {
  die(`marcadores de conflito em markdown:\n  ${offenders.join('\n  ')}`)
}

console.log(`[check-docs-conflict-markers] ok — ${scannedPaths.length} markdown file(s) clean`)
