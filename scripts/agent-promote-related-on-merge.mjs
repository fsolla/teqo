/**
 * OPS18 safety net — on PR merge to `main`, promote plan-issue Issues cited as
 * `Related #N` from `blocked` → `ready` when they are still awaiting a plan.
 *
 * Soft-skip (never fail the workflow) when an issue is already ready, product-
 * blocked without a plan link, gated by needs:*, or otherwise ineligible.
 * Idempotent with `pnpm agent:ready`.
 *
 *   node scripts/agent-promote-related-on-merge.mjs --pr 123
 *
 * Env: GH_TOKEN (Actions), GITHUB_REPOSITORY (optional — gh uses default remote).
 */

import { dieAgent, gh, ghJson, labelNames, parseArgs, setLabels } from './lib/agent-github.mjs'
import { canPromotePlanIssue, parseRelatedIssueNumbers } from './lib/agent-plan-lifecycle.mjs'

const die = dieAgent('promote-related-on-merge')
const { flags } = parseArgs(process.argv.slice(2), new Set(['pr']))

if (!flags.pr || !/^\d+$/.test(String(flags.pr))) {
  die('Usage: node scripts/agent-promote-related-on-merge.mjs --pr <N>')
}

const prNumber = Number(flags.pr)
const pr = ghJson(['pr', 'view', String(prNumber), '--json', 'body,number,url'])
const numbers = parseRelatedIssueNumbers(pr.body)

if (numbers.length === 0) {
  console.log(`[agent:promote-related] PR #${prNumber}: no Related #N — nothing to do`)
  process.exit(0)
}

console.log(
  `[agent:promote-related] PR #${prNumber}: Related → ${numbers.map((n) => `#${n}`).join(', ')}`,
)

for (const number of numbers) {
  let issue
  try {
    issue = ghJson([
      'issue',
      'view',
      String(number),
      '--json',
      'number,title,body,state,labels',
    ])
  } catch (error) {
    console.log(
      `[agent:promote-related] #${number}: skip (issue view failed: ${
        error instanceof Error ? error.message : String(error)
      })`,
    )
    continue
  }

  const verdict = canPromotePlanIssue(issue)
  if (!verdict.ok) {
    if (verdict.reason === 'not-blocked' && labelNames(issue).includes('ready')) {
      console.log(`[agent:promote-related] #${number}: already ready — skip`)
      continue
    }
    console.log(`[agent:promote-related] #${number}: skip (${verdict.reason})`)
    continue
  }

  setLabels(number, { add: ['ready'], remove: ['blocked'] })
  gh([
    'issue',
    'comment',
    String(number),
    '--body',
    `Promovido a \`ready\` via Action OPS18 — plano de intenção em \`main\` (PR #${prNumber} com \`Related #${number}\`).`,
  ])
  console.log(`[agent:promote-related] #${number}: blocked → ready`)
}
