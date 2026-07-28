import { describe, expect, it } from 'vitest'

import {
  ENGAGEMENT_LEVEL_RULES,
  engagementLevelRank,
  engagementLevels,
  getEngagementLevelViolations,
  isEngagementLevel,
  type EngagementLevel,
  type EngagementLevelViolationId,
} from '@/lib/engagementLevel'

const NOW = new Date('2026-07-27T12:00:00.000Z')

const daysBefore = (days: number): string =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

const violationIds = (input: {
  from: EngagementLevel | null
  to: EngagementLevel
  levelChangedAt?: string | null
  triangulatedShock?: boolean
}): EngagementLevelViolationId[] =>
  getEngagementLevelViolations({
    from: input.from,
    to: input.to,
    levelChangedAt: input.levelChangedAt ?? null,
    now: NOW,
    triangulatedShock: input.triangulatedShock ?? false,
  }).map((violation) => violation.id)

describe('engagement ladder', () => {
  it('ranks the levels in ladder order', () => {
    expect(engagementLevels.map((level) => engagementLevelRank[level])).toEqual([0, 1, 2, 3, 4])
  })

  it('recognizes only the five levels', () => {
    expect(engagementLevels.every(isEngagementLevel)).toBe(true)
    expect(isEngagementLevel('n5')).toBe(false)
    expect(isEngagementLevel(null)).toBe(false)
    expect(isEngagementLevel(2)).toBe(false)
  })
})

describe('engagement level movement rules', () => {
  it('treats the first level as a starting point, not a movement', () => {
    expect(violationIds({ from: null, to: 'n4' })).toEqual([])
  })

  it('allows a single-step movement outside the protection window', () => {
    expect(violationIds({ from: 'n2', to: 'n3', levelChangedAt: daysBefore(60) })).toEqual([])
  })

  it('holds a two-level jump unless a triangulated shock is declared', () => {
    const levelChangedAt = daysBefore(60)
    expect(violationIds({ from: 'n1', to: 'n3', levelChangedAt })).toEqual(['salto-de-dois-niveis'])
    expect(violationIds({ from: 'n1', to: 'n3', levelChangedAt, triangulatedShock: true })).toEqual(
      [],
    )
  })

  it('protects a fresh level from being undone, but only downwards', () => {
    const levelChangedAt = daysBefore(ENGAGEMENT_LEVEL_RULES.protectionWindowDays - 1)
    expect(violationIds({ from: 'n3', to: 'n2', levelChangedAt })).toContain('janela-de-protecao')
    expect(violationIds({ from: 'n3', to: 'n4', levelChangedAt })).not.toContain(
      'janela-de-protecao',
    )
  })

  it('lets a rebaixamento through once the window closed and the month turned', () => {
    expect(violationIds({ from: 'n3', to: 'n2', levelChangedAt: daysBefore(40) })).toEqual([])
  })

  it('counts by calendar month, so a movement early in the month still blocks a second one', () => {
    // 26 days is past the 21-day protection window, and the month rule is what
    // is left holding it — the two rules are not the same rule.
    expect(
      violationIds({ from: 'n2', to: 'n1', levelChangedAt: '2026-07-01T09:00:00.000Z' }),
    ).toEqual(['dois-movimentos-no-mes'])
    expect(
      violationIds({ from: 'n2', to: 'n1', levelChangedAt: '2026-06-30T09:00:00.000Z' }),
    ).toEqual([])
  })

  it('reports every reason at once so the coordinator overrides them knowingly', () => {
    expect(violationIds({ from: 'n4', to: 'n2', levelChangedAt: daysBefore(2) })).toEqual([
      'salto-de-dois-niveis',
      'janela-de-protecao',
      'dois-movimentos-no-mes',
    ])
  })

  it('ignores a movement to the level already recorded', () => {
    expect(violationIds({ from: 'n2', to: 'n2', levelChangedAt: daysBefore(1) })).toEqual([])
  })

  it('survives an unparseable stored timestamp instead of inventing a violation', () => {
    expect(violationIds({ from: 'n2', to: 'n1', levelChangedAt: 'nao-e-uma-data' })).toEqual([])
  })
})
