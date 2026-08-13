#!/usr/bin/env node
/**
 * check-changelog-append-only — CI guard (OPS44): the aggregated changelog
 * must never lose an existing line, and docs/changelog/ entries are
 * additions-only. Legitimate restorations (D8 pattern) and header rewrites
 * escape via the documented `changelog-rewrite:` token in the PR body.
 *
 * Paths from git diff (merge-base…HEAD); body from PR_BODY env or `gh pr
 * view` when PR_NUMBER is set. The escape is honored only when the diff
 * actually touches the aggregate or docs/changelog/, and only as a
 * standalone line (never the PR template's own checkbox text).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  assertChangelogAppendOnly,
  CHANGELOG_AGGREGATE,
  CHANGELOG_DIR,
  CHANGELOG_REWRITE_ESCAPE_RE,
} from './lib/changelog.mjs'

const base = `origin/${process.env.GITHUB_BASE_REF ?? 'main'}`

function die(message) {
  console.error(`[check-changelog-append-only] ${message}`)
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

function listChangedPaths() {
  const raw = execFileSync(
    'git',
    ['diff', '--name-status', `${mergeBase}...HEAD`, '--', CHANGELOG_AGGREGATE, CHANGELOG_DIR],
    { encoding: 'utf8' },
  )

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
  if (!prNumber) return ''

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

const diffLines = listChangedPaths()
if (diffLines.length === 0) {
  console.log('[check-changelog-append-only] ok — no changelog diff')
  process.exit(0)
}

// R (rename): status + old path + new path — use the new path.
const changelogDiff = diffLines.map((line) => {
  const [status, ...rest] = line.split('\t')
  return { status, path: status.startsWith('R') ? rest[rest.length - 1] : rest.join('\t') }
})

const body = readPrBody()
if (CHANGELOG_REWRITE_ESCAPE_RE.test(body)) {
  console.log('[check-changelog-append-only] ok — changelog-rewrite escape in PR body')
  process.exit(0)
}

function blob(ref, path) {
  return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' })
}

const aggregateDiff = changelogDiff.filter(({ path }) => path === CHANGELOG_AGGREGATE)
const oldAggregate = aggregateDiff.length > 0 ? blob(mergeBase, CHANGELOG_AGGREGATE) : ''
const newAggregate =
  aggregateDiff.length > 0 ? readFileSync(join(process.cwd(), CHANGELOG_AGGREGATE), 'utf8') : ''

const result = assertChangelogAppendOnly({
  oldAggregate,
  newAggregate,
  changelogDiff: changelogDiff.filter(({ path }) => path.startsWith(`${CHANGELOG_DIR}/`)),
})

if (!result.ok) {
  die(result.message)
}

console.log('[check-changelog-append-only] ok — changelog is append-only')
