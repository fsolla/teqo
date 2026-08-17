/**
 * One-time / drift repair for branch protection (main-only) — Forgejo.
 *
 *   pnpm configure:branch-protection           # apply
 *   pnpm configure:branch-protection -- --dry-run
 *
 * main: required status checks `checks`, strict=false, 0 reviews.
 * Feature PRs auto-merge when that context is green.
 * (migration-lock removed 2026-08-12 — see ci-pr.yml header.)
 */

import { parseArgs } from './lib/agent-forgejo.mjs'
import { createApi } from './lib/forgejo-api.mjs'

const { flags } = parseArgs(process.argv.slice(2), new Set())
const dryRun = flags['dry-run'] === true

const api = createApi({})
const repo = process.env.FORGEJO_REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? 'fsolla/teqo'

const payload = {
  rule_name: 'main',
  enable_status_check: true,
  status_check_contexts: ['checks'],
  enable_push: false,
  required_approvals: 0,
  dismiss_stale_approvals: false,
}

console.log(`[configure:branch-protection] repo ${repo}${dryRun ? ' (dry-run)' : ''}`)

if (dryRun) {
  console.log(`[dry-run] POST /repos/${repo}/branch_protections ${JSON.stringify(payload)}`)
  process.exit(0)
}

await api.updateBranchProtection('main', payload)
console.log('[configure:branch-protection] done (main: checks, strict=false, 0 reviews).')
