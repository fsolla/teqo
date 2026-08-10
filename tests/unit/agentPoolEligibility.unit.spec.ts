// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildClaimQueue,
  claimQueueEntry,
  claimTargetVerdict,
} from '../../scripts/lib/agent-github.mjs'
import {
  buildPoolQueue,
  isAutonomousClaimable,
  issueHasPlanLink,
  POOL_CIRCUIT_BREAKER_FAILURES,
} from '../../scripts/lib/agent-pool-eligibility.mjs'

type TestIssue = {
  number: number
  title: string
  body: string
  state: string
  createdAt: string
  labels: Array<{ name: string }>
}

const issue = (over: Partial<TestIssue> = {}): TestIssue => ({
  number: 1,
  title: 'Issue de teste',
  body: '',
  state: 'OPEN',
  createdAt: '2026-07-01T00:00:00Z',
  labels: [{ name: 'ready' }, { name: 'prio:P2' }],
  ...over,
})

const entry = (over: Record<string, unknown> = {}) => {
  const { issue: issueOver, ...rest } = over
  return {
    issue: issue((issueOver as Partial<TestIssue>) ?? {}),
    meta: {},
    blockedBy: [],
    priority: 'prio:P2',
    satisfiedWithoutIssue: [],
    ...rest,
  }
}

describe('isAutonomousClaimable', () => {
  it('accepts a plain ready issue', () => {
    expect(isAutonomousClaimable(entry())).toEqual({ ok: true })
  })

  it('rejects a closed issue', () => {
    expect(isAutonomousClaimable(entry({ issue: { state: 'CLOSED' } }))).toEqual({
      ok: false,
      reason: 'not-open',
    })
  })

  it('rejects an issue without the ready label', () => {
    expect(isAutonomousClaimable(entry({ issue: { labels: [{ name: 'prio:P2' }] } }))).toEqual({
      ok: false,
      reason: 'not-ready',
    })
  })

  it.each(['in-progress', 'blocked', 'done', 'in-prod'])(
    'rejects when the state label %s coexists with ready (stale double label)',
    (stateLabel) => {
      const verdict = isAutonomousClaimable(
        entry({ issue: { labels: [{ name: 'ready' }, { name: stateLabel }] } }),
      )
      expect(verdict).toEqual({ ok: false, reason: 'state-label' })
    },
  )

  it.each(['requirements-changed', 'needs:consent'])(
    'never claims human-gated issues (%s), however ready they look',
    (gateLabel) => {
      const verdict = isAutonomousClaimable(
        entry({
          issue: {
            labels: [{ name: 'ready' }, { name: 'prio:P0' }, { name: gateLabel }],
            body: 'Plano: [`docs/plans/x.md`](docs/plans/x.md)',
          },
        }),
      )
      expect(verdict).toEqual({ ok: false, reason: 'needs-human' })
    },
  )

  it('rejects issues blocked by open deps', () => {
    expect(isAutonomousClaimable(entry({ blockedBy: ['B99'] }))).toEqual({
      ok: false,
      reason: 'blocked-by-deps',
    })
  })

  it('defers migration-touching issues only while a schema PR is open', () => {
    const migrationLabels = [{ name: 'ready' }, { name: 'needs:migration' }]
    expect(
      isAutonomousClaimable(entry({ issue: { labels: migrationLabels } }), {
        migrationBusy: true,
      }),
    ).toEqual({ ok: false, reason: 'migration-busy' })
    expect(
      isAutonomousClaimable(entry({ issue: { labels: migrationLabels } }), {
        migrationBusy: false,
      }),
    ).toEqual({ ok: true })
  })

  it('reads the migration signal from frontmatter serializes too', () => {
    const verdict = isAutonomousClaimable(entry({ meta: { serializes: ['migrations'] } }), {
      migrationBusy: true,
    })
    expect(verdict).toEqual({ ok: false, reason: 'migration-busy' })
  })

  it('applies the circuit breaker at the failure threshold', () => {
    expect(
      isAutonomousClaimable(entry(), { poolFailureCount: POOL_CIRCUIT_BREAKER_FAILURES - 1 }),
    ).toEqual({ ok: true })
    expect(
      isAutonomousClaimable(entry(), { poolFailureCount: POOL_CIRCUIT_BREAKER_FAILURES }),
    ).toEqual({ ok: false, reason: 'circuit-breaker' })
  })
})

describe('buildPoolQueue', () => {
  it('splits eligible/excluded preserving the claim order', () => {
    const first = entry({ issue: { number: 10, title: 'primeira' } })
    const gated = entry({
      issue: { number: 11, labels: [{ name: 'ready' }, { name: 'needs:consent' }] },
    })
    const second = entry({ issue: { number: 12, title: 'segunda' } })
    const { eligible, excluded } = buildPoolQueue([first, gated, second])
    expect(eligible.map((item) => item.entry.issue.number)).toEqual([10, 12])
    expect(excluded).toEqual([{ entry: gated, reason: 'needs-human' }])
  })

  it('flags the missing plan link as a warn, not a blocker', () => {
    const withPlan = entry({ issue: { body: 'Plano: [`docs/plans/x.md`](docs/plans/x.md)' } })
    const withoutPlan = entry({ issue: { number: 2, body: 'sem link' } })
    const { eligible } = buildPoolQueue([withPlan, withoutPlan])
    expect(eligible.map((item) => item.hasPlan)).toEqual([true, false])
  })
})

describe('issueHasPlanLink', () => {
  it('matches docs/plans/ references in the body', () => {
    expect(issueHasPlanLink(issue({ body: 'ver docs/plans/foo.md' }))).toBe(true)
    expect(issueHasPlanLink(issue({ body: 'nada' }))).toBe(false)
  })
})

describe('buildClaimQueue parity (shared with agent:claim)', () => {
  const byId = new Map<string, TestIssue>([
    ['B1', issue({ number: 101, state: 'CLOSED', labels: [{ name: 'done' }] })],
    ['B2', issue({ number: 102, labels: [{ name: 'in-progress' }] })],
  ])
  const fm = (depends: string[]) => `---\nid: BX\ndepends: [${depends.join(', ')}]\n---\nspec`

  it('orders by prio then oldest, and treats deps without an issue as satisfied', () => {
    const p2Old = issue({ number: 1, createdAt: '2026-07-01T00:00:00Z', body: fm(['B9']) })
    const p0 = issue({
      number: 2,
      createdAt: '2026-07-03T00:00:00Z',
      labels: [{ name: 'ready' }, { name: 'prio:P0' }],
    })
    const p2New = issue({ number: 3, createdAt: '2026-07-02T00:00:00Z' })
    const queue = buildClaimQueue([p2New, p2Old, p0], byId)
    expect(queue.map((item) => item.issue.number)).toEqual([2, 1, 3])
    expect(queue[1]!.satisfiedWithoutIssue).toEqual(['B9'])
  })

  it('filters issues whose deps are not done/closed/in-prod', () => {
    const blocked = issue({ number: 1, body: fm(['B2']) })
    const free = issue({ number: 2, body: fm(['B1']) })
    const queue = buildClaimQueue([blocked, free], byId)
    expect(queue.map((item) => item.issue.number)).toEqual([2])
  })
})

describe('claimQueueEntry (single-issue shape for `worktree next --issue` reopen)', () => {
  const byId = new Map<string, TestIssue>([
    ['B1', issue({ number: 101, state: 'CLOSED', labels: [{ name: 'done' }] })],
    ['B2', issue({ number: 102, labels: [{ name: 'in-progress' }] })],
  ])
  const fm = (depends: string[]) => `---\nid: BX\ndepends: [${depends.join(', ')}]\n---\nspec`

  it('derives the same entry shape as buildClaimQueue for one issue', () => {
    const target = issue({ number: 7, body: fm(['B1']), labels: [{ name: 'in-progress' }] })
    const entry = claimQueueEntry(target, byId)
    expect(entry.issue.number).toBe(7)
    expect(entry.meta).toEqual({ id: 'BX', depends: ['B1'] })
    expect(entry.priority).toBe('prio:P2')
    expect(entry.satisfiedWithoutIssue).toEqual([])
    expect(entry.blockedBy).toEqual([])
  })

  it('does NOT re-filter by deps — reopening is about the session, not the queue', () => {
    const target = issue({ number: 7, body: fm(['B2']) })
    const entry = claimQueueEntry(target, byId)
    expect(entry.blockedBy).toEqual(['B2'])
  })

  it('defaults the priority from the prio label, like the queue does', () => {
    const target = issue({
      number: 7,
      labels: [{ name: 'in-progress' }, { name: 'prio:P0' }],
    })
    expect(claimQueueEntry(target, byId).priority).toBe('prio:P0')
  })

  it('surfaces satisfied deps without an issue (brief deps line)', () => {
    const target = issue({ number: 8, body: fm(['B9']) })
    expect(claimQueueEntry(target, byId).satisfiedWithoutIssue).toEqual(['B9'])
  })
})

describe('claimTargetVerdict (`worktree next --issue` target decision)', () => {
  it('reopens an in-progress issue — no claim', () => {
    expect(claimTargetVerdict(issue({ labels: [{ name: 'in-progress' }] }))).toEqual({
      kind: 'reopen',
    })
  })

  it('claims a ready issue', () => {
    expect(claimTargetVerdict(issue({ labels: [{ name: 'ready' }] }))).toEqual({ kind: 'claim' })
  })

  it('rejects a closed issue', () => {
    const verdict = claimTargetVerdict(issue({ state: 'CLOSED', labels: [{ name: 'ready' }] }))
    expect(verdict).toEqual({ kind: 'error', message: expect.stringContaining('não está aberta') })
  })

  it('rejects an issue with neither ready nor in-progress', () => {
    const verdict = claimTargetVerdict(issue({ labels: [{ name: 'blocked' }] }))
    expect(verdict).toEqual({ kind: 'error', message: expect.stringContaining('não é claimável') })
  })

  it('in-progress wins over a stale ready double label (reopen, not re-claim)', () => {
    expect(
      claimTargetVerdict(issue({ labels: [{ name: 'ready' }, { name: 'in-progress' }] })),
    ).toEqual({ kind: 'reopen' })
  })
})
