// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildPanelViewModel,
  issueAction,
  issueState,
  planLabel,
  toJsonPayload,
  visibleWindow,
} from '../../scripts/lib/issues-panel.mjs'

const issue = (over: Record<string, unknown> = {}) => ({
  number: 999,
  title: 'Test',
  body: '---\nid: TEST999\n---\nPlano: [`docs/plans/test999.md`](docs/plans/test999.md)\n',
  state: 'OPEN',
  createdAt: '2026-09-15T10:00:00.000Z',
  labels: [{ name: 'ready', color: '' }],
  ...over,
})

describe('planLabel (OPS109)', () => {
  it('says sem plano when both plans are null', () => {
    expect(planLabel({ plan: { intention: null, impl: null } })).toBe('sem plano')
  })

  it('says sem plano when intention path is null and impl path is null', () => {
    expect(
      planLabel({
        plan: {
          intention: { path: null, exists: false, classification: 'none' },
          impl: { path: null, exists: false, classification: 'none' },
        },
      }),
    ).toBe('sem plano')
  })

  it('shows the intention status when the intention exists but impl is missing', () => {
    expect(
      planLabel({
        plan: {
          intention: {
            path: 'docs/plans/test.md',
            exists: true,
            classification: 'aprovado',
            status: { raw: 'aprovado', classification: 'aprovado' },
          },
          impl: {
            path: 'docs/plans/test-impl.md',
            exists: false,
            classification: 'não criado',
            status: null,
          },
        },
      }),
    ).toBe('intenção: aprovado')
  })

  it('prefers the impl when it exists', () => {
    expect(
      planLabel({
        plan: {
          intention: {
            path: 'docs/plans/test.md',
            exists: true,
            classification: 'aprovado',
            status: { raw: 'aprovado', classification: 'aprovado' },
          },
          impl: {
            path: 'docs/plans/test-impl.md',
            exists: true,
            classification: 'andou',
            status: { raw: 'em execução', classification: 'andou' },
          },
        },
      }),
    ).toBe('impl em execução')
  })
})

describe('issueAction (OPS109 — blocked wins)', () => {
  it('says travada when blocked label is present even if plan is aguardando', () => {
    expect(
      issueAction({
        state: 'blocked',
        plan: { intention: { classification: 'aguardando' }, impl: null },
        blockedBy: [],
      }),
    ).toBe('travada')
  })
})

describe('issueState (OPS109 — closed issues)', () => {
  it('returns done for closed issues even when the label still says in-progress', () => {
    expect(
      issueState(issue({ state: 'CLOSED', labels: [{ name: 'in-progress', color: '' }] })),
    ).toBe('done')
  })

  it('returns in-prod for closed in-prod issues', () => {
    expect(issueState(issue({ state: 'CLOSED', labels: [{ name: 'in-prod', color: '' }] }))).toBe(
      'in-prod',
    )
  })
})

describe('visibleWindow (OPS109 — list scroll math)', () => {
  it('returns the whole list when it fits', () => {
    expect(visibleWindow({ count: 7, cursor: 3, capacity: 10 })).toEqual({ start: 0, end: 7 })
  })

  it('keeps the cursor centered in a long list', () => {
    expect(visibleWindow({ count: 100, cursor: 50, capacity: 10 })).toEqual({
      start: 45,
      end: 55,
    })
  })

  it('clamps at the top and the bottom', () => {
    expect(visibleWindow({ count: 100, cursor: 0, capacity: 10 })).toEqual({ start: 0, end: 10 })
    expect(visibleWindow({ count: 100, cursor: 99, capacity: 10 })).toEqual({
      start: 90,
      end: 100,
    })
  })

  it('never slices the cursor out at the window edges', () => {
    const { start, end } = visibleWindow({ count: 23, cursor: 22, capacity: 4 })
    expect(start).toBeLessThanOrEqual(22)
    expect(end).toBeGreaterThan(22)
    expect(end - start).toBe(4)
  })

  it('degrades to a single row for an empty or zero capacity', () => {
    expect(visibleWindow({ count: 0, cursor: 0, capacity: 0 })).toEqual({ start: 0, end: 0 })
    expect(visibleWindow({ count: 5, cursor: 2, capacity: 0 })).toEqual({ start: 2, end: 3 })
  })
})

describe('toJsonPayload / buildPanelViewModel (OPS109 — no regressions)', () => {
  it('marks a missing impl as não criado in the JSON contract', () => {
    const model = buildPanelViewModel({
      issues: [
        issue({
          number: 999,
          body: '---\nid: TEST999\n---\nPlano: [`docs/plans/test999.md`](docs/plans/test999.md)',
        }),
      ],
      plansByNumber: new Map([
        [999, { intention: 'Status: aprovado\n', impl: null, uiDraft: false }],
      ]),
      limit: 200,
    })
    const payload = toJsonPayload(model)
    const row = payload.rows[0]
    expect(row.plan.intention).toMatchObject({ classification: 'aprovado', status: 'aprovado' })
    expect(row.plan.impl).toMatchObject({ exists: false, classification: 'não criado' })
  })
})
