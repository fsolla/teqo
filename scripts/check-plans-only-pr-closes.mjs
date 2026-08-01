#!/usr/bin/env node
/**
 * check-plans-only-pr-closes — CI guard: plans-only PRs must not close Issues via body keywords.
 * Paths from git diff (merge-base…HEAD); body from PR_BODY env or `gh pr view` when PR_NUMBER is set.
 */
import { execFileSync } from 'node:child_process'

import { assertPlansOnlyPrAllowsBody } from './lib/plansOnlyClosesGuard.mjs'

const base = `origin/${process.env.GITHUB_BASE_REF ?? 'main'}`

function die(message) {
  console.error(`[check-plans-only-pr-closes] ${message}`)
  process.exit(1)
}

function listChangedPaths() {
  let mergeBase
  try {
    mergeBase = execFileSync('git', ['merge-base', 'HEAD', base], { encoding: 'utf8' }).trim()
  } catch {
    die(`no merge-base with ${base} (shallow clone?)`)
  }

  const raw = execFileSync('git', ['diff', '--name-only', `${mergeBase}...HEAD`], {
    encoding: 'utf8',
  })

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function readPrBody() {
  if (process.env.PR_BODY !== undefined) {
    return process.env.PR_BODY
  }

  const prNumber = process.env.PR_NUMBER ?? process.env.GITHUB_PR_NUMBER
  if (!prNumber) {
    return ''
  }

  try {
    const json = execFileSync('gh', ['pr', 'view', String(prNumber), '--json', 'body'], {
      encoding: 'utf8',
    })
    const parsed = JSON.parse(json)
    return typeof parsed.body === 'string' ? parsed.body : ''
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    die(`failed to read PR #${prNumber} body via gh: ${detail}`)
  }
}

const paths = listChangedPaths()
const body = readPrBody()
const result = assertPlansOnlyPrAllowsBody({ paths, body })

if (!result.ok) {
  die(result.message)
}

if (paths.length > 0 && paths.every((path) => path.startsWith('docs/plans/'))) {
  console.log('[check-plans-only-pr-closes] ok — plans-only diff without closing keywords')
} else {
  console.log('[check-plans-only-pr-closes] ok — not a plans-only diff (skipped)')
}
