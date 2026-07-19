import { describe, expect, it } from 'vitest'

import { nucleusCreateSchema } from '@/lib/schemas/nucleus'
import { buildNucleusListWhere, parseNucleusListParams } from '@/utilities/nucleusUi'
import { toNucleusDetailViewModel } from '@/utilities/nucleusViewModels'
import {
  aggregateVoteGoals,
  countHighPriorityNuclei,
  getVoteGoalsOrderViolation,
  sumVoteGoals,
  voteGoalProgressPercent,
} from '@/utilities/voteGoals'

describe('vote goals schema and aggregates', () => {
  it('accepts ordered vote goals and priority on create', () => {
    const parsed = nucleusCreateSchema.parse({
      name: 'Núcleo Metas',
      cities: ['Salvador'],
      organizationKind: 'territorial',
      voteGoals: { good: 1000, regular: 800, minimum: 500 },
      priority: 'alta',
    })

    expect(parsed.voteGoals).toEqual({ good: 1000, regular: 800, minimum: 500 })
    expect(parsed.priority).toBe('alta')
  })

  it('rejects vote goals that break Bom ≥ Regular ≥ Mínimo', () => {
    const result = nucleusCreateSchema.safeParse({
      name: 'Núcleo inválido',
      cities: ['Salvador'],
      organizationKind: 'territorial',
      voteGoals: { good: 100, regular: 200 },
    })

    expect(result.success).toBe(false)
  })

  it('filters list results by alta priority', () => {
    expect(parseNucleusListParams({ priority: 'alta' })).toEqual({ page: 1, priority: 'alta' })
    expect(buildNucleusListWhere({ page: 1, priority: 'alta' })).toEqual({
      and: [{ status: { equals: 'ativo' } }, { priority: { equals: 'alta' } }],
    })
  })

  it('aggregates vote goals and counts high-priority nuclei', () => {
    const nuclei = [
      {
        voteGoals: { good: 1000, regular: 800, minimum: 500 },
        priority: 'alta' as const,
      },
      {
        voteGoals: { good: 200, regular: 150, minimum: 100 },
        priority: 'normal' as const,
      },
    ]

    expect(aggregateVoteGoals(nuclei)).toEqual({
      good: 1200,
      regular: 950,
      minimum: 600,
      highPriorityCount: 1,
    })
    expect(sumVoteGoals(nuclei)).toEqual({ good: 1200, regular: 950, minimum: 600 })
    expect(countHighPriorityNuclei(nuclei)).toBe(1)
    expect(voteGoalProgressPercent(400, 800)).toBe(50)
    expect(voteGoalProgressPercent(null, 800)).toBeNull()
  })

  it('flags vote goal order violations on sparse inputs', () => {
    expect(getVoteGoalsOrderViolation({ good: 100, regular: 200 })).toBe('regular')
    expect(getVoteGoalsOrderViolation({ regular: 50, minimum: 100 })).toBe('minimum')
    expect(getVoteGoalsOrderViolation({ good: 100, minimum: 200 })).toBe('minimum')
    expect(getVoteGoalsOrderViolation({ good: 100, regular: 80 })).toBeNull()
  })

  it('exposes vote goals to lideranca but omits staff-only strategy notes', () => {
    const view = toNucleusDetailViewModel(
      {
        id: 1,
        name: 'Núcleo',
        slug: 'nucleo',
        status: 'ativo',
        cities: ['Salvador'],
        regions: ['Metropolitano de Salvador'],
        organizationKind: 'territorial',
        tseZones: [],
        voteGoals: { good: 100, regular: 80, minimum: 50 },
        priority: 'alta',
        dobradinhaNotes: 'Negociação em curso',
        nextSteps: 'Visitar prefeito',
        strengths: [{ text: 'Sigiloso' }],
        updatedAt: '',
        createdAt: '',
      },
      'lideranca',
    )

    expect(view.voteGoals).toEqual({ good: 100, regular: 80, minimum: 50 })
    expect(view.priority).toBe('alta')
    expect(JSON.stringify(view.tabs)).not.toContain('Negociação em curso')
    expect(JSON.stringify(view.tabs)).not.toContain('Visitar prefeito')
    expect(JSON.stringify(view.tabs)).not.toContain('Sigiloso')
  })
})
