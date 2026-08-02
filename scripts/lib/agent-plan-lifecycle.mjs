/**
 * Plan-issue lifecycle helpers (OPS17): register with `--plan` starts non-claimable;
 * promote to `ready` only after the intention plan is on `main`.
 *
 * Pure — no IO. Used by `agent-register` / `agent-ready` and pinned by unit tests.
 */

import { HUMAN_GATE_LABELS, issueHasPlanLink } from './agent-pool-eligibility.mjs'
import { labelNames } from './agent-github.mjs'

/**
 * Initial state label for a newly registered issue.
 *
 * @param {{ hasPlan: boolean, explicitBlocked?: boolean }} options
 * @returns {'ready' | 'blocked'}
 */
export const resolveRegisterStateLabel = ({ hasPlan, explicitBlocked = false }) => {
  if (explicitBlocked || hasPlan) return 'blocked'
  return 'ready'
}

const TERMINAL_OR_ACTIVE = ['in-progress', 'done', 'in-prod']

/**
 * Whether an issue is waiting for its intention plan on `main` and may be
 * flipped `blocked` → `ready` by `agent:ready` (or the OPS18 Action).
 *
 * @param {{ state?: string, body?: string, labels?: Array<{ name: string }> }} issue
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export const canPromotePlanIssue = (issue) => {
  if ((issue?.state ?? 'OPEN') !== 'OPEN') return { ok: false, reason: 'not-open' }
  const labels = labelNames(issue ?? { labels: [] })
  if (!labels.includes('blocked')) return { ok: false, reason: 'not-blocked' }
  if (TERMINAL_OR_ACTIVE.some((label) => labels.includes(label))) {
    return { ok: false, reason: 'state-label' }
  }
  if (HUMAN_GATE_LABELS.some((label) => labels.includes(label))) {
    return { ok: false, reason: 'needs-human' }
  }
  if (!issueHasPlanLink(issue)) return { ok: false, reason: 'no-plan-link' }
  return { ok: true }
}
