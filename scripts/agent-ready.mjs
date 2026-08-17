/**
 * `pnpm agent:ready` — flip plan-issue Issues from `blocked` → `ready` after
 * the intention plan is on `main` (OPS17 Passo 6). Idempotent per issue.
 *
 *   pnpm agent:ready -- --issue 292
 *   pnpm agent:ready -- --issue 292,293
 *
 * Fail-closed via `canPromotePlanIssue`: open + `blocked` + `docs/plans/` link,
 * and not `needs:consent` / `requirements-changed` / `in-progress`|`done`|`in-prod`.
 * Idempotent skip when already `ready`. Product-blocked Issues without a plan
 * link stay for human triage.
 */

import { dieAgent, parseArgs, setLabels } from './lib/agent-forgejo.mjs'
import { canPromotePlanIssue } from './lib/agent-plan-lifecycle.mjs'
import { forgejoApi as api } from './lib/forgejo-api.mjs'

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
  const issue = await api.getIssue(number)
  const verdict = canPromotePlanIssue(issue)
  if (!verdict.ok) {
    if (verdict.reason === 'already-ready') {
      console.log(`[agent:ready] #${number} already ready — skip`)
      continue
    }
    die(`#${number} cannot mark ready (${verdict.reason}).`)
  }

  await setLabels(number, { add: ['ready'], remove: ['blocked'] })
  await api.addComment(
    number,
    'Promovido a `ready`: plano de intenção em `main` (ciclo OPS17 — `pnpm agent:ready`).',
  )
  console.log(`[agent:ready] #${number} blocked → ready`)
}
