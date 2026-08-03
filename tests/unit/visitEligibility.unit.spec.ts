import { describe, expect, it } from 'vitest'

import { CALENDAR_PHASE_ANCHORS, CALENDAR_PHASES } from '@/lib/visitPlannerAnchors'
import type { MunicipalityGoalCoverage } from '@/utilities/municipality/goalCoverage'
import type { MunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import {
  calendarPhaseLabels,
  calendarPhaseVisitProduct,
  evaluateVisitEligibility,
  formatVisitEligibilitySummary,
  resolveCalendarPhase,
  VISIT_CONDITIONS,
  VISIT_CONTRAINDICATIONS,
  visitConditionLabels,
  visitContraindicationLabels,
  type VisitConditionId,
  type VisitEligibilityInput,
} from '@/utilities/visit/visitEligibility'
import {
  compareVisitCandidates,
  composeTourSuggestion,
  resolveTourStopRole,
  TOUR_MAX_SATELLITES,
  tourSuggestionSlugs,
  type VisitCandidateViewModel,
} from '@/utilities/visit/visitPlannerViews'

/** An eligible município: all five conditions met, no contraindication. */
const input = (overrides: Partial<VisitEligibilityInput> = {}): VisitEligibilityInput => ({
  projectedValidVotes: 20_000,
  projectedValidVotesCut: 10_000,
  coverageDeficit: 500,
  uncapturedFieldVotes: 4_000,
  uncapturedFieldVotesCut: 3_000,
  advisorCount: 1,
  leadershipCount: 2,
  pledgeCount: 3,
  linkedStateDeputyCount: 1,
  politicalTrend: 'favoravel',
  territorialClass: 'manutencao',
  territoryStopPeerCount: 4,
  ...overrides,
})

const conditionById = (
  result: ReturnType<typeof evaluateVisitEligibility>,
  id: VisitConditionId,
) => {
  const condition = result.conditions.find((entry) => entry.id === id)
  if (!condition) throw new Error(`Condição ausente: ${id}`)
  return condition
}

describe('evaluateVisitEligibility', () => {
  it('returns the five conditions, in reading order, with a visible reason each', () => {
    const result = evaluateVisitEligibility(input())
    expect(result.conditions.map((condition) => condition.id)).toEqual([...VISIT_CONDITIONS])
    expect(result.metCount).toBe(5)
    expect(result.contraindication).toBeNull()
    // The reason is what the UI renders — never an empty string behind a ✓.
    for (const condition of result.conditions) expect(condition.detail.length).toBeGreaterThan(0)
  })

  it('reads volume against the catalog median, not an absolute vote count', () => {
    expect(conditionById(evaluateVisitEligibility(input()), 'volume').met).toBe(true)
    // At the cut is enough; a hair below is not.
    expect(
      conditionById(evaluateVisitEligibility(input({ projectedValidVotes: 10_000 })), 'volume').met,
    ).toBe(true)
    expect(
      conditionById(evaluateVisitEligibility(input({ projectedValidVotes: 9_999 })), 'volume').met,
    ).toBe(false)
  })

  it('accepts headroom from an uncovered goal OR from uncaptured field votes', () => {
    const goalCovered = input({ coverageDeficit: -200 })
    expect(conditionById(evaluateVisitEligibility(goalCovered), 'headroom').met).toBe(true)

    const noRoom = input({ coverageDeficit: -200, uncapturedFieldVotes: 100 })
    const headroom = conditionById(evaluateVisitEligibility(noRoom), 'headroom')
    expect(headroom.met).toBe(false)
    expect(headroom.detail).toContain('Meta coberta')
  })

  it('requires BOTH an advisor and someone on the ground for rede', () => {
    expect(conditionById(evaluateVisitEligibility(input({ advisorCount: 0 })), 'rede').met).toBe(
      false,
    )
    expect(
      conditionById(evaluateVisitEligibility(input({ leadershipCount: 0, pledgeCount: 0 })), 'rede')
        .met,
    ).toBe(false)
    // A pledge with no leadership still counts as someone to receive.
    expect(conditionById(evaluateVisitEligibility(input({ leadershipCount: 0 })), 'rede').met).toBe(
      true,
    )
  })

  it('treats an unrecorded political trend as unknown, not as a green light', () => {
    const unknown = input({ linkedStateDeputyCount: 0, politicalTrend: null })
    const janela = conditionById(evaluateVisitEligibility(unknown), 'janela')
    expect(janela.met).toBe(false)
    expect(janela.detail).toContain('não registrada')

    // A linked dobradinha carries the window on its own, even with a bad trend.
    expect(
      conditionById(evaluateVisitEligibility(input({ politicalTrend: 'desfavoravel' })), 'janela')
        .met,
    ).toBe(true)
    expect(
      conditionById(
        evaluateVisitEligibility(
          input({ linkedStateDeputyCount: 0, politicalTrend: 'desfavoravel' }),
        ),
        'janela',
      ).met,
    ).toBe(false)
  })

  it('reads encaixe as another stop in the same identity territory', () => {
    const alone = evaluateVisitEligibility(input({ territoryStopPeerCount: 0 }))
    expect(conditionById(alone, 'encaixe').met).toBe(false)
    expect(conditionById(alone, 'encaixe').detail).toContain('uma parada só')
    expect(alone.metCount).toBe(4)
  })

  it('contraindicates "perdida" only when a weak class meets an empty network', () => {
    const weakWithNetwork = evaluateVisitEligibility(input({ territorialClass: 'sem_base' }))
    expect(weakWithNetwork.contraindication).toBeNull()

    const weakAlone = evaluateVisitEligibility(
      input({ territorialClass: 'sem_base', leadershipCount: 0, pledgeCount: 0 }),
    )
    expect(weakAlone.contraindication?.id).toBe('perdida')
    expect(weakAlone.contraindication?.counterOffer.length).toBeGreaterThan(0)

    const marginalAlone = evaluateVisitEligibility(
      input({ territorialClass: 'marginal', leadershipCount: 0, pledgeCount: 0 }),
    )
    expect(marginalAlone.contraindication?.id).toBe('perdida')
  })

  it('contraindicates "sem_rede" when the class is fine but nobody can receive', () => {
    const result = evaluateVisitEligibility(input({ leadershipCount: 0, pledgeCount: 0 }))
    expect(result.contraindication?.id).toBe('sem_rede')
    expect(result.contraindication?.counterOffer).toContain('coordenador')
  })

  it('contraindicates "no_teto" when the goal is covered and the field is exhausted', () => {
    const result = evaluateVisitEligibility(
      input({ coverageDeficit: -1_000, uncapturedFieldVotes: 0 }),
    )
    expect(result.contraindication?.id).toBe('no_teto')
  })
})

describe('resolveCalendarPhase', () => {
  /** Noon in Bahia (UTC−3) on a civil date, so the instant is unambiguous. */
  const bahiaNoon = (civilDate: string): Date => new Date(`${civilDate}T15:00:00.000Z`)

  it('labels the phases of the 2026 calendar', () => {
    expect(resolveCalendarPhase(bahiaNoon('2026-07-27'))).toBe('construcao')
    expect(resolveCalendarPhase(bahiaNoon('2026-09-01'))).toBe('consolidacao')
    expect(resolveCalendarPhase(bahiaNoon(CALENDAR_PHASE_ANCHORS.electionDay))).toBe('ativacao')
  })

  it('turns the phase at midnight in Bahia, not in UTC', () => {
    // 03:00 UTC on the anchor day is still the previous day in Bahia (UTC−3).
    expect(resolveCalendarPhase(new Date('2026-08-16T02:59:00.000Z'))).toBe('construcao')
    expect(resolveCalendarPhase(new Date('2026-08-16T03:00:00.000Z'))).toBe('consolidacao')
    expect(resolveCalendarPhase(new Date('2026-09-28T02:59:00.000Z'))).toBe('consolidacao')
    expect(resolveCalendarPhase(new Date('2026-09-28T03:00:00.000Z'))).toBe('ativacao')
  })
})

describe('visit planner copy', () => {
  it('names every calendar phase and every condition', () => {
    for (const phase of CALENDAR_PHASES) {
      expect(calendarPhaseLabels[phase].length).toBeGreaterThan(0)
      expect(calendarPhaseVisitProduct[phase].length).toBeGreaterThan(0)
    }
    for (const condition of VISIT_CONDITIONS) {
      expect(visitConditionLabels[condition].length).toBeGreaterThan(0)
    }
  })

  it('names every contraindication', () => {
    for (const contraindication of VISIT_CONTRAINDICATIONS) {
      expect(visitContraindicationLabels[contraindication].length).toBeGreaterThan(0)
    }
  })
})

describe('formatVisitEligibilitySummary', () => {
  it('reads eligible when all five conditions are met', () => {
    const summary = formatVisitEligibilitySummary(evaluateVisitEligibility(input()))
    expect(summary).toEqual({
      eligible: true,
      headline: 'Elegível',
      detail: 'As cinco condições estão atendidas.',
    })
  })

  it('reads not eligible with the contraindication headline when one fires', () => {
    const summary = formatVisitEligibilitySummary(
      evaluateVisitEligibility(
        input({ leadershipCount: 0, pledgeCount: 0, territorialClass: 'sem_base' }),
      ),
    )
    expect(summary.eligible).toBe(false)
    expect(summary.headline).toBe('Não elegível')
    expect(summary.detail).toBe(visitContraindicationLabels.perdida)
  })

  it('names the first unmet condition when there is no contraindication', () => {
    const summary = formatVisitEligibilitySummary(
      evaluateVisitEligibility(
        input({ projectedValidVotes: 1_000, projectedValidVotesCut: 10_000 }),
      ),
    )
    expect(summary.eligible).toBe(false)
    expect(summary.detail).toContain(visitConditionLabels.volume)
  })
})

type CandidateOverrides = {
  slug: string
  name?: string
  metConditions?: number
  committed?: number
  deficit?: number
  goal?: number
  leadershipCount?: number
  pledgeCount?: number
  territorialClass?: MunicipalityTerritorialClass
}

/**
 * `metCount` is produced by the evaluator, never hand-set: the comparator has
 * to keep agreeing with the checklist. `metConditions` picks how many of the
 * five to satisfy, from the cheapest knobs.
 */
const candidate = ({
  slug,
  name = slug,
  metConditions = 5,
  committed = 100,
  deficit = 100,
  goal = 200,
  leadershipCount = 2,
  pledgeCount = 2,
  territorialClass = 'manutencao',
}: CandidateOverrides): VisitCandidateViewModel => {
  const coverage: MunicipalityGoalCoverage = {
    goal,
    committed,
    coverageRatio: goal > 0 ? committed / goal : null,
    deficit,
  }

  return {
    id: slug.length,
    slug,
    name,
    region: 'Metropolitano de Salvador',
    priority: null,
    eligibility: evaluateVisitEligibility({
      projectedValidVotes: metConditions >= 1 ? 20_000 : 1_000,
      projectedValidVotesCut: 10_000,
      coverageDeficit: metConditions >= 2 ? 500 : -500,
      uncapturedFieldVotes: metConditions >= 2 ? 5_000 : 0,
      uncapturedFieldVotesCut: 3_000,
      advisorCount: metConditions >= 3 ? 1 : 0,
      leadershipCount,
      pledgeCount,
      linkedStateDeputyCount: metConditions >= 4 ? 1 : 0,
      politicalTrend: metConditions >= 4 ? 'favoravel' : null,
      territorialClass,
      territoryStopPeerCount: metConditions >= 5 ? 3 : 0,
    }),
    coverage,
    territorialClass,
    leadershipCount,
    pledgeCount,
    advisorCount: metConditions >= 3 ? 1 : 0,
  }
}

describe('compareVisitCandidates', () => {
  it('orders by conditions met first, then by the votes still missing', () => {
    const ordered = [
      candidate({ slug: 'baixa', metConditions: 2, deficit: 9_000 }),
      candidate({ slug: 'alta-deficit-baixo', metConditions: 5, deficit: 10 }),
      candidate({ slug: 'alta-deficit-alto', metConditions: 5, deficit: 5_000 }),
    ].sort(compareVisitCandidates)

    // A big deficit never buys a place ahead of a município that clears more
    // conditions — the checklist is a gate, the deficit only breaks ties in it.
    expect(ordered.map((entry) => entry.slug)).toEqual([
      'alta-deficit-alto',
      'alta-deficit-baixo',
      'baixa',
    ])
  })

  it('falls back to the pt-BR name so the order is stable', () => {
    const ordered = [
      candidate({ slug: 'b', name: 'Óbidos' }),
      candidate({ slug: 'a', name: 'Ibicaraí' }),
    ].sort(compareVisitCandidates)

    expect(ordered.map((entry) => entry.name)).toEqual(['Ibicaraí', 'Óbidos'])
  })
})

describe('composeTourSuggestion', () => {
  it('anchors on the largest committed stock, not on the most conditions met', () => {
    const suggestion = composeTourSuggestion([
      candidate({ slug: 'estoque', committed: 5_000, metConditions: 3 }),
      candidate({ slug: 'checklist', committed: 100, metConditions: 5 }),
    ])

    expect(suggestion.anchorSlug).toBe('estoque')
    expect(suggestion.satelliteSlugs).toEqual(['checklist'])
  })

  it('caps the satellites and keeps them in queue order', () => {
    const suggestion = composeTourSuggestion([
      candidate({ slug: 'ancora', committed: 9_000 }),
      candidate({ slug: 's1', deficit: 4_000 }),
      candidate({ slug: 's2', deficit: 3_000 }),
      candidate({ slug: 's3', deficit: 2_000 }),
      candidate({ slug: 's4', deficit: 1_000 }),
    ])

    expect(suggestion.satelliteSlugs).toHaveLength(TOUR_MAX_SATELLITES)
    expect(suggestion.satelliteSlugs).toEqual(['s1', 's2', 's3'])
  })

  it('never proposes a stop with nobody to receive the candidate', () => {
    const suggestion = composeTourSuggestion([
      candidate({ slug: 'com-rede', committed: 500 }),
      candidate({ slug: 'sem-rede', committed: 9_000, leadershipCount: 0, pledgeCount: 0 }),
    ])

    expect(suggestion.anchorSlug).toBe('com-rede')
    expect(suggestion.satelliteSlugs).toEqual([])
  })

  it('reserves the seed before filling the satellites, so a small giro still bets', () => {
    // Four receivable municípios and three satellite slots: picking the seed
    // from the leftovers would leave none, and the giro would only repeat the base.
    const suggestion = composeTourSuggestion([
      candidate({ slug: 'ancora', committed: 9_000, deficit: 900 }),
      candidate({ slug: 'satelite', committed: 400, deficit: 700 }),
      candidate({ slug: 'semente', territorialClass: 'expansao', deficit: 8_000 }),
      candidate({ slug: 'semente-menor', territorialClass: 'expansao', deficit: 500 }),
    ])

    expect(suggestion.seedSlug).toBe('semente')
    expect(suggestion.satelliteSlugs).not.toContain('semente')
    expect(tourSuggestionSlugs(suggestion)).toEqual([
      'ancora',
      'satelite',
      'semente-menor',
      'semente',
    ])
    expect(resolveTourStopRole('ancora', suggestion)).toBe('ancora')
    expect(resolveTourStopRole('semente', suggestion)).toBe('semente')
    expect(resolveTourStopRole('satelite', suggestion)).toBe('satelite')
    expect(resolveTourStopRole('fora', suggestion)).toBeNull()
  })

  it('returns an empty suggestion when the territory has nowhere to stop', () => {
    const suggestion = composeTourSuggestion([
      candidate({ slug: 'vazio', leadershipCount: 0, pledgeCount: 0 }),
    ])

    expect(suggestion).toEqual({ anchorSlug: null, satelliteSlugs: [], seedSlug: null })
    expect(tourSuggestionSlugs(suggestion)).toEqual([])
  })
})
