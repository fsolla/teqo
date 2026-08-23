/**
 * Pure pool-state helpers for the agent pool supervisor
 * (docs/plans/agent-pool-orchestrator.md §2). No IO — the gh wrappers live in
 * agent-pool-forgejo.mjs and the Cursor REST client in agent-pool-cursor.mjs.
 *
 * State model: scalar config lives in GitHub repo variables; the dynamic view
 * (who is active) is DERIVED from two sources of truth — pool-worker event
 * markers in issue comments and Cursor run statuses — never persisted, so it
 * cannot drift from reality.
 */

export const POOL_VARIABLE_NAMES = {
  enabled: 'POOL_ENABLED',
  maxSlots: 'POOL_MAX_SLOTS',
  paused: 'POOL_PAUSED',
  startedAt: 'POOL_STARTED_AT',
  startedBy: 'POOL_STARTED_BY',
}

export const POOL_DEFAULT_MAX_SLOTS = 5
// Operator ceiling for POOL_MAX_SLOTS (parsePoolConfig clamps into 1..this).
// Cursor plan concurrency can be lower — spawn fails closed with the API limit.
export const POOL_HARD_MAX_SLOTS = 12

/**
 * @param {Record<string, string | undefined>} [vars] raw `gh api` variable map
 * @returns {{ enabled: boolean, maxSlots: number, paused: boolean, startedAt: string | null, startedBy: string | null }}
 */
export const parsePoolConfig = (vars = {}) => {
  const rawSlots = Number.parseInt(vars[POOL_VARIABLE_NAMES.maxSlots] ?? '', 10)
  return {
    enabled: vars[POOL_VARIABLE_NAMES.enabled] === 'true',
    maxSlots: Number.isFinite(rawSlots)
      ? Math.min(Math.max(rawSlots, 1), POOL_HARD_MAX_SLOTS)
      : POOL_DEFAULT_MAX_SLOTS,
    paused: vars[POOL_VARIABLE_NAMES.paused] === 'true',
    startedAt: vars[POOL_VARIABLE_NAMES.startedAt] || null,
    startedBy: vars[POOL_VARIABLE_NAMES.startedBy] || null,
  }
}

// --- pool-worker event markers (machine-readable HTML comments on issues) ---

const POOL_EVENT_PATTERN = /<!-- pool-worker (\{[^]*?\}) -->/g

/**
 * @typedef {{ event: string, tick?: string, commentAt?: string | null, agentId?: string, runId?: string, reason?: string, worker?: string, v?: number }} PoolEvent
 * @param {Record<string, unknown>} event
 * @returns {string}
 */
export const formatPoolEvent = (event) =>
  `<!-- pool-worker ${JSON.stringify({ v: 1, ...event })} -->`

/**
 * Parse every pool-worker marker across an issue's comments, oldest first.
 * @param {Array<{ body?: string, createdAt?: string }> | undefined} [comments]
 * @returns {PoolEvent[]}
 */
export const parsePoolEvents = (comments = []) => {
  const events = []
  for (const comment of comments ?? []) {
    const body = comment?.body
    if (!body) continue
    for (const match of body.matchAll(POOL_EVENT_PATTERN)) {
      try {
        const parsed = JSON.parse(match[1])
        if (parsed && typeof parsed.event === 'string') {
          events.push({ ...parsed, commentAt: comment.createdAt ?? null })
        }
      } catch {
        // Hand-edited / malformed marker: ignore it, never crash a tick.
      }
    }
  }
  return events
}

/** @param {PoolEvent[]} events */
export const countPoolFailures = (events) =>
  events.filter((event) => event.event === 'failure').length

// --- claim classification (occupied vs freed vs failed) ---

const TERMINAL_RUN_STATUSES = new Set(['FINISHED', 'ERROR', 'CANCELLED', 'EXPIRED'])

export const POOL_CLAIM_CLASS = {
  occupiedRunning: 'occupied-running',
  occupiedBooting: 'occupied-booting',
  occupiedAutoMerge: 'occupied-auto-merge',
  freed: 'freed',
  failed: 'failed',
}

export const POOL_OCCUPIED_CLASSES = new Set([
  POOL_CLAIM_CLASS.occupiedRunning,
  POOL_CLAIM_CLASS.occupiedBooting,
  POOL_CLAIM_CLASS.occupiedAutoMerge,
])

/**
 * Partition classified claims for the tick: failures to reconcile (blocked +
 * archive), freed slots (merge done — archive the agent), and actives still
 * occupying a slot (the gap math input).
 *
 * @param {Array<{ classification: { class: string } | null }>} claims
 * @returns {{ failures: Array<any>, freed: Array<any>, active: Array<any> }}
 */
export const reconcilePoolClaims = (claims) => {
  const failures = []
  const freed = []
  const active = []
  for (const claim of claims) {
    const cls = claim.classification?.class
    if (cls === POOL_CLAIM_CLASS.failed) failures.push(claim)
    else if (cls === POOL_CLAIM_CLASS.freed) freed.push(claim)
    else if (cls && POOL_OCCUPIED_CLASSES.has(cls)) active.push(claim)
  }
  return { failures, freed, active }
}

// A claim without a spawn event is only suspicious after the boot window —
// the worker takes minutes to come up (environment install), so a fresh claim
// is "booting", not lost.
export const POOL_SPAWN_GRACE_MS = 15 * 60 * 1000

/**
 * Classify one pool-claimed issue. Returns null when the issue was not claimed
 * by the pool (no claim marker) — those belong to humans/manual agents and the
 * pool never touches them.
 *
 * Occupied means "from the claim to the merge in stage (or a documented
 * terminal failure)" — a terminal run with an open PR is still occupied
 * (auto-merge finishes the job hands-off), per the plan's slot definition.
 *
 * @param {Object} options
 * @param {PoolEvent[]} options.events
 * @param {boolean} [options.issueDone]
 * @param {boolean} [options.hasOpenPr]
 * @param {string | null} [options.runStatus]
 * @param {number} [options.now]
 * @returns {{ class: string, reason?: string, agentId?: string | null, runId?: string | null } | null}
 */
export const classifyPoolClaim = ({
  events,
  issueDone = false,
  hasOpenPr = false,
  runStatus = null,
  now = Date.now(),
}) => {
  const claims = events.filter((event) => event.event === 'claim')
  if (claims.length === 0) return null
  if (issueDone) return { class: POOL_CLAIM_CLASS.freed }

  const spawn = events.find((event) => event.event === 'spawn')
  if (!spawn) {
    const latest = claims[claims.length - 1]
    const claimedAtMs = Date.parse(latest.tick ?? latest.commentAt ?? '')
    const ageMs = Number.isFinite(claimedAtMs) ? now - claimedAtMs : Number.POSITIVE_INFINITY
    return ageMs < POOL_SPAWN_GRACE_MS
      ? { class: POOL_CLAIM_CLASS.occupiedBooting, agentId: null }
      : { class: POOL_CLAIM_CLASS.failed, reason: 'spawn-missing', agentId: null }
  }

  if (runStatus && TERMINAL_RUN_STATUSES.has(runStatus)) {
    if (hasOpenPr) {
      return { class: POOL_CLAIM_CLASS.occupiedAutoMerge, agentId: spawn.agentId ?? null }
    }
    return {
      class: POOL_CLAIM_CLASS.failed,
      reason: `run-${runStatus.toLowerCase()}`,
      agentId: spawn.agentId ?? null,
    }
  }
  return {
    class: POOL_CLAIM_CLASS.occupiedRunning,
    agentId: spawn.agentId ?? null,
    runId: spawn.runId ?? null,
  }
}

// --- spawn plan / auto-stop ---

/**
 * @param {Object} options
 * @param {unknown[]} options.eligible
 * @param {number} options.activeCount
 * @param {number} options.maxSlots
 */
export const computeSpawnPlan = ({ eligible, activeCount, maxSlots }) => {
  const gap = Math.max(0, maxSlots - activeCount)
  return { gap, toSpawn: eligible.slice(0, gap) }
}

/**
 * The pool switches itself off only when the eligible queue is drained AND no
 * worker is active — except when the only exclusions are `migration-busy`,
 * which is transient (the schema PR will merge and the queue re-opens).
 *
 * @param {Object} options
 * @param {number} options.eligibleCount
 * @param {number} options.activeCount
 * @param {string[]} [options.excludedReasons]
 */
export const decidePoolAutoStop = ({ eligibleCount, activeCount, excludedReasons = [] }) =>
  eligibleCount === 0 && activeCount === 0 && !excludedReasons.includes('migration-busy')
