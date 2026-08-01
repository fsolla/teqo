/**
 * One-time / drift repair for branch protection (main-only).
 *
 *   pnpm configure:branch-protection           # apply
 *   pnpm configure:branch-protection -- --dry-run
 *
 * main: required checks `checks` + `migration-lock`, strict=false, 0 reviews.
 * Feature PRs auto-merge when those contexts are green.
 */

import { execFileSync } from 'node:child_process'

import { parseArgs } from './lib/agent-github.mjs'

const { flags } = parseArgs(process.argv.slice(2), new Set())
const dryRun = flags['dry-run'] === true

const repo = execFileSync(
  'gh',
  ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
  {
    encoding: 'utf8',
  },
).trim()

const ghApiJson = (method, path, body) => {
  const payload = JSON.stringify(body)
  if (dryRun) {
    console.log(`[dry-run] gh api -X ${method} ${path} ${payload}`)
    return
  }
  execFileSync('gh', ['api', '-X', method, path, '--input', '-'], {
    input: payload,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}

console.log(`[configure:branch-protection] repo ${repo}${dryRun ? ' (dry-run)' : ''}`)

ghApiJson('PUT', `repos/${repo}/branches/main/protection`, {
  required_status_checks: {
    strict: false,
    contexts: ['checks', 'migration-lock'],
  },
  enforce_admins: false,
  required_pull_request_reviews: {
    required_approving_review_count: 0,
  },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false,
})

console.log(
  '[configure:branch-protection] done (main: checks + migration-lock, strict=false, 0 reviews).',
)
