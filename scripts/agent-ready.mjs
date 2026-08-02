/**
 * `pnpm agent:ready` — flip plan-issue Issues from `blocked` → `ready` after
 * the intention plan is on `main` (OPS17 Passo 6). Idempotent per issue.
 *
 *   pnpm agent:ready -- --issue 292
 *   pnpm agent:ready -- --issue 292,293
 *
 * Fail-closed: only Issues that are open, labeled `blocked`, and link
 * `docs/plans/` in the body. Does not promote product-blocked Issues without
 * a plan link (those stay for human triage).
 */

import { dieAgent, gh, ghJson, labelNames, parseArgs, setLabels } from './lib/agent-github.mjs'
import { canPromotePlanIssue } from './lib/agent-plan-lifecycle.mjs'

const die = dieAgent('ready')
const { flags } = parseArgs(process.argv.slice(2), new Set(['issue']))

if (!flags.issue) {
  die('Usage: pnpm agent:ready -- --issue <N[,N…]>')
}

const numbers = String(flags.issue)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    if (!/^\d+$/.test(value)) die(`Invalid issue number "${value}".`)
    return Number(value)
  })

if (numbers.length === 0) die('Usage: pnpm agent:ready -- --issue <N[,N…]>')

for (const number of numbers) {
  const issue = ghJson([
    'issue',
    'view',
    String(number),
    '--json',
    'number,title,body,state,labels',
  ])
  const verdict = canPromotePlanIssue(issue)
  if (!verdict.ok) {
    if (verdict.reason === 'not-blocked' && labelNames(issue).includes('ready')) {
      console.log(`[agent:ready] #${number} already ready — skip`)
      continue
    }
    die(`#${number} cannot mark ready (${verdict.reason}).`)
  }

  setLabels(number, { add: ['ready'], remove: ['blocked'] })
  gh([
    'issue',
    'comment',
    String(number),
    '--body',
    'Promovido a `ready`: plano de intenção em `main` (ciclo OPS17 — `pnpm agent:ready`).',
  ])
  console.log(`[agent:ready] #${number} blocked → ready`)
}
