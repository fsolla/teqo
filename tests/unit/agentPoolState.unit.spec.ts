// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  classifyPoolClaim,
  computeSpawnPlan,
  countPoolFailures,
  decidePoolAutoStop,
  formatPoolEvent,
  parsePoolConfig,
  parsePoolEvents,
  POOL_CLAIM_CLASS,
  POOL_DEFAULT_MAX_SLOTS,
  POOL_HARD_MAX_SLOTS,
  POOL_SPAWN_GRACE_MS,
  POOL_VARIABLE_NAMES,
  reconcilePoolClaims,
} from '../../scripts/lib/agent-pool-state.mjs'

const comment = (body: string, createdAt = '2026-07-30T12:00:00Z') => ({ body, createdAt })

describe('parsePoolConfig', () => {
  it('defaults to a disabled pool with the default slot count', () => {
    expect(parsePoolConfig({})).toEqual({
      enabled: false,
      maxSlots: POOL_DEFAULT_MAX_SLOTS,
      paused: false,
      startedAt: null,
      startedBy: null,
    })
  })

  it('reads the enabled/paused flags as strict true strings', () => {
    const config = parsePoolConfig({
      [POOL_VARIABLE_NAMES.enabled]: 'true',
      [POOL_VARIABLE_NAMES.paused]: 'true',
      [POOL_VARIABLE_NAMES.startedAt]: '2026-07-30T00:00:00Z',
      [POOL_VARIABLE_NAMES.startedBy]: 'fsolla',
    })
    expect(config.enabled).toBe(true)
    expect(config.paused).toBe(true)
    expect(config.startedAt).toBe('2026-07-30T00:00:00Z')
    expect(config.startedBy).toBe('fsolla')
  })

  it('clamps maxSlots into 1..POOL_HARD_MAX_SLOTS and falls back on garbage', () => {
    expect(parsePoolConfig({ [POOL_VARIABLE_NAMES.maxSlots]: '0' }).maxSlots).toBe(1)
    expect(parsePoolConfig({ [POOL_VARIABLE_NAMES.maxSlots]: '99' }).maxSlots).toBe(
      POOL_HARD_MAX_SLOTS,
    )
    expect(parsePoolConfig({ [POOL_VARIABLE_NAMES.maxSlots]: 'cinco' }).maxSlots).toBe(
      POOL_DEFAULT_MAX_SLOTS,
    )
  })
})

describe('pool-worker event markers', () => {
  it('round-trips events through format/parse', () => {
    const marker = formatPoolEvent({ event: 'claim', tick: '2026-07-30T12:00:00Z', worker: 'abc' })
    const events = parsePoolEvents([comment(`Claimed pelo pool. ${marker}`)])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      v: 1,
      event: 'claim',
      tick: '2026-07-30T12:00:00Z',
      worker: 'abc',
      commentAt: '2026-07-30T12:00:00Z',
    })
  })

  it('parses several markers across comments and ignores noise', () => {
    const events = parsePoolEvents([
      comment('comentário humano sem marcador'),
      comment(
        `${formatPoolEvent({ event: 'claim' })} texto ${formatPoolEvent({ event: 'spawn', agentId: 'bc-1' })}`,
      ),
      comment('<!-- pool-worker {malformed -->'),
      comment(''),
    ])
    expect(events.map((event) => event.event)).toEqual(['claim', 'spawn'])
  })

  it('counts failure events for the circuit breaker', () => {
    const events = parsePoolEvents([
      comment(formatPoolEvent({ event: 'failure', reason: 'run-error' })),
      comment(formatPoolEvent({ event: 'spawn' })),
      comment(formatPoolEvent({ event: 'failure', reason: 'spawn-missing' })),
    ])
    expect(countPoolFailures(events)).toBe(2)
  })
})

describe('classifyPoolClaim', () => {
  const claimEvent = { event: 'claim', tick: '2026-07-30T12:00:00Z', commentAt: null }
  const spawnEvent = { event: 'spawn', agentId: 'bc-1', runId: 'run-1', commentAt: null }
  const now = Date.parse('2026-07-30T12:05:00Z')

  it('returns null for issues the pool never claimed (human-owned)', () => {
    expect(classifyPoolClaim({ events: [], now })).toBeNull()
  })

  it('frees the slot once the issue is done (CI flipped on stage merge)', () => {
    expect(classifyPoolClaim({ events: [claimEvent], issueDone: true, now })).toEqual({
      class: POOL_CLAIM_CLASS.freed,
    })
  })

  it('treats a fresh claim without spawn as booting, and a stale one as failed', () => {
    expect(classifyPoolClaim({ events: [claimEvent], now })).toEqual({
      class: POOL_CLAIM_CLASS.occupiedBooting,
      agentId: null,
    })
    const staleNow = now + POOL_SPAWN_GRACE_MS + 1
    expect(classifyPoolClaim({ events: [claimEvent], now: staleNow })).toEqual({
      class: POOL_CLAIM_CLASS.failed,
      reason: 'spawn-missing',
      agentId: null,
    })
  })

  it('keeps the slot occupied while the run is live', () => {
    expect(
      classifyPoolClaim({ events: [claimEvent, spawnEvent], runStatus: 'RUNNING', now }),
    ).toEqual({
      class: POOL_CLAIM_CLASS.occupiedRunning,
      agentId: 'bc-1',
      runId: 'run-1',
    })
  })

  it('stays occupied past a terminal run when the PR is still open (auto-merge)', () => {
    expect(
      classifyPoolClaim({
        events: [claimEvent, spawnEvent],
        runStatus: 'FINISHED',
        hasOpenPr: true,
        now,
      }),
    ).toEqual({ class: POOL_CLAIM_CLASS.occupiedAutoMerge, agentId: 'bc-1' })
  })

  it('fails terminally when the run ended without a PR and the issue is not done', () => {
    expect(
      classifyPoolClaim({ events: [claimEvent, spawnEvent], runStatus: 'ERROR', now }),
    ).toEqual({ class: POOL_CLAIM_CLASS.failed, reason: 'run-error', agentId: 'bc-1' })
    expect(
      classifyPoolClaim({ events: [claimEvent, spawnEvent], runStatus: 'FINISHED', now }),
    ).toEqual({ class: POOL_CLAIM_CLASS.failed, reason: 'run-finished', agentId: 'bc-1' })
  })
})

describe('reconcilePoolClaims', () => {
  const withClass = (cls: string | null) => ({ classification: cls ? { class: cls } : null })

  it('partitions failures, freed and actives for the tick', () => {
    const claims = [
      withClass(POOL_CLAIM_CLASS.failed),
      withClass(POOL_CLAIM_CLASS.freed),
      withClass(POOL_CLAIM_CLASS.occupiedRunning),
      withClass(POOL_CLAIM_CLASS.occupiedBooting),
      withClass(POOL_CLAIM_CLASS.occupiedAutoMerge),
      withClass(null), // not pool-owned
    ]
    const { failures, freed, active } = reconcilePoolClaims(claims)
    expect(failures).toHaveLength(1)
    expect(freed).toHaveLength(1)
    expect(active).toHaveLength(3)
  })

  it('yields empty partitions when nothing is claimed', () => {
    expect(reconcilePoolClaims([])).toEqual({ failures: [], freed: [], active: [] })
  })
})

describe('computeSpawnPlan', () => {
  const eligible = [{ entry: { issue: { number: 1 } } }, { entry: { issue: { number: 2 } } }]

  it('spawns up to the gap between actives and maxSlots', () => {
    const plan = computeSpawnPlan({ eligible, activeCount: 3, maxSlots: 5 })
    expect(plan.gap).toBe(2)
    expect(plan.toSpawn).toHaveLength(2)
  })

  it('never spawns past the cap, however long the queue', () => {
    const plan = computeSpawnPlan({ eligible, activeCount: 5, maxSlots: 5 })
    expect(plan.gap).toBe(0)
    expect(plan.toSpawn).toHaveLength(0)
  })
})

describe('decidePoolAutoStop', () => {
  it('stops only when the queue drained and nothing is active', () => {
    expect(decidePoolAutoStop({ eligibleCount: 0, activeCount: 0 })).toBe(true)
    expect(decidePoolAutoStop({ eligibleCount: 2, activeCount: 0 })).toBe(false)
    expect(decidePoolAutoStop({ eligibleCount: 0, activeCount: 1 })).toBe(false)
  })

  it('does not stop when exclusions are only the transient migration-busy', () => {
    expect(
      decidePoolAutoStop({
        eligibleCount: 0,
        activeCount: 0,
        excludedReasons: ['migration-busy'],
      }),
    ).toBe(false)
    expect(
      decidePoolAutoStop({
        eligibleCount: 0,
        activeCount: 0,
        excludedReasons: ['needs-human'],
      }),
    ).toBe(true)
  })
})
