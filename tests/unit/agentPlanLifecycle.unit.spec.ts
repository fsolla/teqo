// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  canPromotePlanIssue,
  parseRelatedIssueNumbers,
  resolveRegisterStateLabel,
} from '../../scripts/lib/agent-plan-lifecycle.mjs'

type TestIssue = {
  number: number
  title: string
  body: string
  state: string
  labels: Array<{ name: string }>
}

const issue = (over: Partial<TestIssue> = {}): TestIssue => ({
  number: 1,
  title: 'Issue de teste',
  body: 'Plano: [`docs/plans/x.md`](docs/plans/x.md)',
  state: 'OPEN',
  labels: [{ name: 'blocked' }, { name: 'prio:P2' }],
  ...over,
})

describe('resolveRegisterStateLabel', () => {
  it('keeps chores without a plan as ready', () => {
    expect(resolveRegisterStateLabel({ hasPlan: false })).toBe('ready')
  })

  it('starts plan-linked issues as blocked (OPS17)', () => {
    expect(resolveRegisterStateLabel({ hasPlan: true })).toBe('blocked')
  })

  it('honors explicit --blocked even without a plan', () => {
    expect(resolveRegisterStateLabel({ hasPlan: false, explicitBlocked: true })).toBe('blocked')
  })

  it('stays blocked when both --plan and --blocked are set', () => {
    expect(resolveRegisterStateLabel({ hasPlan: true, explicitBlocked: true })).toBe('blocked')
  })
})

describe('canPromotePlanIssue', () => {
  it('accepts an open blocked issue with a docs/plans/ link', () => {
    expect(canPromotePlanIssue(issue())).toEqual({ ok: true })
  })

  it('rejects closed issues', () => {
    expect(canPromotePlanIssue(issue({ state: 'CLOSED' }))).toEqual({
      ok: false,
      reason: 'not-open',
    })
  })

  it('rejects issues that are not blocked', () => {
    expect(canPromotePlanIssue(issue({ labels: [{ name: 'prio:P2' }] }))).toEqual({
      ok: false,
      reason: 'not-blocked',
    })
  })

  it('reports already-ready when ready without blocked (idempotent skip)', () => {
    expect(canPromotePlanIssue(issue({ labels: [{ name: 'ready' }] }))).toEqual({
      ok: false,
      reason: 'already-ready',
    })
  })

  it.each(['in-progress', 'done', 'in-prod'])(
    'rejects when %s coexists with blocked',
    (stateLabel) => {
      expect(
        canPromotePlanIssue(issue({ labels: [{ name: 'blocked' }, { name: stateLabel }] })),
      ).toEqual({ ok: false, reason: 'state-label' })
    },
  )

  it('rejects human-gated blocked issues even when they link a plan', () => {
    expect(
      canPromotePlanIssue(
        issue({
          labels: [{ name: 'blocked' }, { name: 'needs:consent' }],
        }),
      ),
    ).toEqual({ ok: false, reason: 'needs-human' })
  })

  it('rejects blocked issues without a plan link (product block, not awaiting plan)', () => {
    expect(canPromotePlanIssue(issue({ body: 'bloqueio jurídico' }))).toEqual({
      ok: false,
      reason: 'no-plan-link',
    })
  })
})

describe('parseRelatedIssueNumbers', () => {
  it('extracts Related #N case-insensitively and dedupes', () => {
    expect(parseRelatedIssueNumbers('Related #296\nrelated #296 and RELATED #301')).toEqual([
      296, 301,
    ])
  })

  it('does not match closing keywords (Closes/Fixes/Resolves)', () => {
    expect(parseRelatedIssueNumbers('Closes #10\nFixes #11\nResolves #12\nRelated #296')).toEqual([
      296,
    ])
  })

  it('rejects hyphenated compounds and Related without whitespace', () => {
    expect(parseRelatedIssueNumbers('non-related #5 and Related#296')).toEqual([])
  })

  it('accepts markdown list form', () => {
    expect(parseRelatedIssueNumbers('- Related #296\n- Related #301')).toEqual([296, 301])
  })

  it('returns empty for missing/blank bodies', () => {
    expect(parseRelatedIssueNumbers(undefined)).toEqual([])
    expect(parseRelatedIssueNumbers('')).toEqual([])
    expect(parseRelatedIssueNumbers('no refs here')).toEqual([])
  })
})
