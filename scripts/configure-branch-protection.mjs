/**
 * Drift repair for branch protection (main-only) — Forgejo. Idempotent: reads
 * the existing rules and creates / updates / no-ops (never duplicates).
 *
 *   pnpm configure:branch-protection           # apply
 *   pnpm configure:branch-protection -- --dry-run
 *
 * main: required status check `CI (PR) / checks*` (the ci-pr cascade rollup —
 * OPS61: Forgejo matches the contexts as globs against the real status
 * contexts like `CI (PR) / checks (pull_request)`, so the old literal `checks`
 * would match nothing), strict=false, 0 reviews. Feature PRs auto-merge when
 * that context is green; the server rule is the final defense against merges
 * before the cascade settles (the waitForChecks rollup gate is the client
 * half).
 * (migration-lock removed 2026-08-12 — see ci-pr.yml header.)
 */

import { parseArgs } from './lib/agent-forgejo.mjs'
import { DESIRED_RULE, planBranchProtectionRule } from './lib/branch-protection.mjs'
import { createApi } from './lib/forgejo-api.mjs'

const { flags } = parseArgs(process.argv.slice(2), new Set())
const dryRun = flags['dry-run'] === true

const api = createApi({})
const repo = process.env.FORGEJO_REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? 'fsolla/teqo'
const ruleName = DESIRED_RULE.rule_name

const existingRules = await api.listBranchProtections()
const existing =
  existingRules.find((rule) => rule.rule_name === ruleName || rule.branch_name === ruleName) ?? null
const { action } = planBranchProtectionRule(existing)

console.log(
  `[configure:branch-protection] repo ${repo}${dryRun ? ' (dry-run)' : ''} — regra "${ruleName}": ${
    action === 'noop'
      ? 'já conforme — nada a fazer'
      : action === 'update'
        ? 'atualizar (drift)'
        : 'criar'
  }`,
)

if (action === 'noop') {
  console.log(`[configure:branch-protection] no-op: ${JSON.stringify(DESIRED_RULE)}`)
  process.exit(0)
}

const payload = { ...DESIRED_RULE, branch_name: ruleName }
const target = action === 'create' ? '/branch_protections' : `/branch_protections/${ruleName}`
const method = action === 'create' ? 'POST' : 'PATCH'

if (dryRun) {
  console.log(`[dry-run] ${method} /repos/${repo}${target} ${JSON.stringify(payload)}`)
  process.exit(0)
}

if (action === 'create') {
  await api.updateBranchProtection(ruleName, payload)
} else {
  await api.editBranchProtection(ruleName, payload)
}

const after = await api.listBranchProtections()
const applied =
  after.find((rule) => rule.rule_name === ruleName || rule.branch_name === ruleName) ?? null
if (!applied) {
  console.error(
    `[configure:branch-protection] FALHOU: ${method} ${target} respondeu mas a regra "${ruleName}" não aparece no servidor.`,
  )
  process.exit(1)
}
console.log(
  `[configure:branch-protection] done — regra verificada no servidor: ${JSON.stringify(applied)}`,
)
