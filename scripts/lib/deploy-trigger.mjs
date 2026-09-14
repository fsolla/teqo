/**
 * Pure decision logic for the automatic deploy trigger (OPS104), consumed by
 * `scripts/deploy-preflight.mjs` (trigger 1) and `scripts/deploy-requeue.mjs`
 * (trigger 2). Unit-tested in tests/unit/deployTrigger.unit.spec.ts.
 *
 * Product decisions locked in the OPS104 gate (2026-09-14):
 * - Only `queued`/`in_progress` runs count as an active deploy. A run
 *   `waiting` on the production environment approval does NOT block: a merge
 *   in that window starts a new run and both stay pending for the human.
 * - A manual `workflow_dispatch` is always the deliberate act — the guard is
 *   push-only (the workflow skips the step on dispatch).
 * - Trigger 2 only dispatches when `main` really advanced; the same SHA
 *   (idempotent re-dispatch) is a no-op.
 */

/** Only these run statuses count as an active deploy in the trigger-1 guard. */
export const ACTIVE_RUN_STATUSES = new Set(['queued', 'in_progress'])

/**
 * Trigger 1 guard: should this push start the deploy run?
 *
 * @param {{
 *   eventName?: string,
 *   currentRunId?: string | number | null,
 *   runs?: Array<{ id: string | number, status?: string }>,
 * }} [input]
 * @returns {{ shouldDeploy: boolean, reason: 'dispatch-manual' | 'deploy-ativo' | 'sem-deploy-ativo', activeRunIds: Array<string | number> }}
 */
export const decidePreflight = ({ eventName, currentRunId, runs = [] } = {}) => {
  if (eventName !== 'push') {
    return { shouldDeploy: true, reason: 'dispatch-manual', activeRunIds: [] }
  }
  const activeRunIds = runs
    .filter((run) => ACTIVE_RUN_STATUSES.has(run?.status))
    .filter((run) => String(run.id) !== String(currentRunId))
    .map((run) => run.id)
  if (activeRunIds.length > 0) {
    return { shouldDeploy: false, reason: 'deploy-ativo', activeRunIds }
  }
  return { shouldDeploy: true, reason: 'sem-deploy-ativo', activeRunIds: [] }
}

/**
 * Trigger 2 verdict: did `main` advance past the run's SHA?
 * A missing SHA yields `sha-ausente` — the CLI treats it as an error
 * (fail-red), never as a silent no-op.
 *
 * @param {{ runSha?: string | null, headSha?: string | null }} [input]
 * @returns {{ dispatch: boolean, reason: 'sha-ausente' | 'head-atual' | 'head-avancou' }}
 */
export const decideRequeue = ({ runSha, headSha } = {}) => {
  if (!runSha || !headSha) return { dispatch: false, reason: 'sha-ausente' }
  if (runSha === headSha) return { dispatch: false, reason: 'head-atual' }
  return { dispatch: true, reason: 'head-avancou' }
}
