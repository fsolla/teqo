/**
 * One-time / drift repair for branch protection aligned with auto-promote + parallel agents.
 *
 *   pnpm configure:branch-protection           # apply
 *   pnpm configure:branch-protection -- --dry-run
 *
 * Changes:
 *   - stage: strict=false (allow merge without being up-to-date; conflicts still block)
 *   - main: required_approving_review_count=0 (auto-promote replaces human review)
 *
 * Auto-promote still needs secrets.PROMOTE_GITHUB_TOKEN (admin PAT) on the repo if
 * GITHUB_TOKEN cannot bypass main protection — see docs/AGENT-OPS.md.
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

ghApiJson('PATCH', `repos/${repo}/branches/stage/protection/required_status_checks`, {
  strict: false,
  contexts: ['checks', 'migration-lock'],
})

ghApiJson('PATCH', `repos/${repo}/branches/main/protection/required_pull_request_reviews`, {
  required_approving_review_count: 0,
})

console.log('[configure:branch-protection] done.')
