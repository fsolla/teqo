/**
 * Autonomous-claim eligibility for the agent pool
 * (docs/plans/agent-pool-orchestrator.md §3). Pure — no IO.
 *
 * The pool consumes the SAME queue as `agent:claim` (buildClaimQueue) and then
 * applies stricter, fail-closed predicates: anything that needs a human
 * (`requirements-changed`, `needs:consent`, `blocked`) is out, migration-touching
 * issues wait while a schema PR is open (pool-level serialization — the CI
 * migration-lock was removed 2026-08-12), and an issue the pool already failed
 * twice stays out (circuit breaker — enforced per candidate at claim time,
 * where the comments are already being read).
 */

import { labelNames } from './agent-forgejo.mjs'

export const POOL_CIRCUIT_BREAKER_FAILURES = 2

const EXCLUDED_STATE_LABELS = ['in-progress', 'blocked', 'done', 'in-prod']
export const HUMAN_GATE_LABELS = ['requirements-changed', 'needs:consent']

/**
 * @param {ReturnType<import('./agent-forgejo.mjs').buildClaimQueue>[number]} entry queue entry from buildClaimQueue
 * @param {Object} [options]
 * @param {boolean} [options.migrationBusy]
 * @param {number} [options.poolFailureCount]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export const isAutonomousClaimable = (
  entry,
  { migrationBusy = false, poolFailureCount = 0 } = {},
) => {
  const labels = labelNames(entry.issue)
  if (entry.issue.state !== 'OPEN') return { ok: false, reason: 'not-open' }
  if (!labels.includes('ready')) return { ok: false, reason: 'not-ready' }
  if (EXCLUDED_STATE_LABELS.some((label) => labels.includes(label))) {
    return { ok: false, reason: 'state-label' }
  }
  if (HUMAN_GATE_LABELS.some((label) => labels.includes(label))) {
    return { ok: false, reason: 'needs-human' }
  }
  if ((entry.blockedBy ?? []).length > 0) return { ok: false, reason: 'blocked-by-deps' }
  if (poolFailureCount >= POOL_CIRCUIT_BREAKER_FAILURES) {
    return { ok: false, reason: 'circuit-breaker' }
  }
  const serializes = Array.isArray(entry.meta?.serializes) ? entry.meta.serializes : []
  const touchesSchema = labels.includes('needs:migration') || serializes.includes('migrations')
  if (touchesSchema && migrationBusy) return { ok: false, reason: 'migration-busy' }
  return { ok: true }
}

/** Plan link is a preference for claim/pool status (warn), never a claim blocker.
 *  Promote-to-ready (`canPromotePlanIssue`) requires the link — different concern. */
export const issueHasPlanLink = (issue) => /docs\/plans\//.test(issue?.body ?? '')

/**
 * Splits the claim queue into pool-eligible entries (order preserved — the
 * claim order IS the spawn order) and exclusions with their reason.
 *
 * @param {ReturnType<import('./agent-forgejo.mjs').buildClaimQueue>} claimQueue
 * @param {Object} [options]
 * @param {boolean} [options.migrationBusy]
 * @param {Map<number, number>} [options.failureCountsByIssue]
 */
export const buildPoolQueue = (
  claimQueue,
  { migrationBusy = false, failureCountsByIssue = new Map() } = {},
) => {
  const eligible = []
  const excluded = []
  for (const entry of claimQueue) {
    const verdict = isAutonomousClaimable(entry, {
      migrationBusy,
      poolFailureCount: failureCountsByIssue.get(entry.issue.number) ?? 0,
    })
    if (verdict.ok) {
      eligible.push({ entry, hasPlan: issueHasPlanLink(entry.issue) })
    } else {
      excluded.push({ entry, reason: verdict.reason })
    }
  }
  return { eligible, excluded }
}
