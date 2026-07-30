import { describe, expect, it } from 'vitest'

import {
  evaluateMunicipalityTriggers,
  getSuggestionPattern,
  isSuggestionSuppressedByDecision,
  shouldEnterSilenceReview,
  SUGGESTION_SUPPRESSION_DAYS,
  suggestionPatternIds,
  suggestionPatterns,
  suggestionPostponeDays,
  type MunicipalityTriggerInput,
  type SuggestionDecisionLike,
  type SuggestionPatternId,
} from '@/lib/suggestionCatalog'

/**
 * A quiet, healthy manutenção município: nothing may fire on it. Every
 * pattern's green case is a minimal deviation from this baseline, so a test
 * that goes red names exactly the condition that broke.
 */
const input = (overrides: Partial<MunicipalityTriggerInput> = {}): MunicipalityTriggerInput => ({
  priority: 'normal',
  engagementLevel: null,
  territorialClass: 'manutencao',
  inCoreBlock: false,
  lqByYear: { 2014: 1, 2018: 1, 2022: 1 },
  ownVotesByYear: { 2014: 900, 2018: 1000, 2022: 1000 },
  projectedValidVotes: 8_000,
  projectedValidVotesCut: 10_000,
  projectedValidVotesUpperCut: 20_000,
  uncapturedFieldVotes: 2_000,
  uncapturedFieldVotesCut: 3_000,
  captureRate2022: 0.2,
  fieldShareOfValid2022: 0.3,
  intraFieldShare2022: 0.1,
  intraFieldShareStateStandard2022: 0.1,
  advisorCount: 1,
  leadershipCount: 2,
  pledgeCount: 3,
  lastSignalAgeDays: 3,
  lastPledgeAgeDays: 3,
  coverageRatio: 0.6,
  coverageDeficit: 400,
  hasAdversarySignal: false,
  hasRecentOrUpcomingActivity: false,
  completedActivityCount: 0,
  ...overrides,
})

const evaluate = (id: SuggestionPatternId, triggerInput: MunicipalityTriggerInput) =>
  getSuggestionPattern(id).evaluate(triggerInput)

describe('suggestionCatalog — catalog integrity', () => {
  it('ships exactly the 8 v1 patterns, in declared id order', () => {
    expect(suggestionPatterns.map((pattern) => pattern.id)).toEqual([...suggestionPatternIds])
  })

  it('every pattern carries complete card copy', () => {
    for (const pattern of suggestionPatterns) {
      expect(pattern.title.trim()).not.toHaveLength(0)
      expect(pattern.probableReading.trim()).not.toHaveLength(0)
      expect(pattern.contraindication.trim()).not.toHaveLength(0)
      expect(pattern.alternativeReadings.length).toBeGreaterThan(0)
      expect(pattern.menu.length).toBeGreaterThan(0)
      const actionIds = pattern.menu.map((action) => action.id)
      expect(new Set(actionIds).size).toBe(actionIds.length)
    }
  })

  it('getSuggestionPattern refuses an unknown id', () => {
    expect(() => getSuggestionPattern('P99' as SuggestionPatternId)).toThrow()
  })
})

describe('P1 — reduto dormente ou ameaçado', () => {
  const reduto = (overrides: Partial<MunicipalityTriggerInput> = {}) =>
    input({
      territorialClass: 'reduto',
      inCoreBlock: true,
      lqByYear: { 2014: 2.5, 2018: 2.6, 2022: 2.4 },
      ...overrides,
    })

  it('fires at level 3 on a dormant core reduto', () => {
    const triggered = evaluate('P1', reduto({ lastSignalAgeDays: 30 }))
    expect(triggered).toMatchObject({ patternId: 'P1', triageLevel: 3 })
    expect(triggered?.factors.join(' ')).toContain('30 dias')
  })

  it('never-signaled counts as dormant', () => {
    expect(evaluate('P1', reduto({ lastSignalAgeDays: null }))?.triageLevel).toBe(3)
  })

  it('escalates to level 1 on any adversary signal — presence reads as confirmed', () => {
    expect(evaluate('P1', reduto({ hasAdversarySignal: true }))?.triageLevel).toBe(1)
  })

  it('fires on a 2018→2022 vote drop even with a fresh signal', () => {
    const triggered = evaluate(
      'P1',
      reduto({ ownVotesByYear: { 2018: 1000, 2022: 800 }, lastSignalAgeDays: 2 }),
    )
    expect(triggered?.triageLevel).toBe(3)
    expect(triggered?.factors.join(' ')).toContain('2018')
  })

  it('stays silent when the reduto is watched: fresh signal or agenda in the window', () => {
    expect(evaluate('P1', reduto({ lastSignalAgeDays: 5 }))).toBeNull()
    expect(
      evaluate('P1', reduto({ lastSignalAgeDays: 30, hasRecentOrUpcomingActivity: true })),
    ).toBeNull()
  })

  it('requires the core block — a trophy reduto outside it is P10 territory, not P1', () => {
    expect(evaluate('P1', reduto({ inCoreBlock: false, lastSignalAgeDays: 30 }))).toBeNull()
  })
})

describe('P2 — ataque: campo forte, captura baixa', () => {
  const attack = (overrides: Partial<MunicipalityTriggerInput> = {}) =>
    input({
      territorialClass: 'expansao',
      uncapturedFieldVotes: 5_000,
      projectedValidVotes: 12_000,
      ...overrides,
    })

  it('fires at level 4 on a big open-field município', () => {
    expect(evaluate('P2', attack())).toMatchObject({ patternId: 'P2', triageLevel: 4 })
  })

  it('yields to P3 when a correligionário holds the campo', () => {
    const held = attack({
      fieldShareOfValid2022: 0.5,
      intraFieldShare2022: 0.03,
      intraFieldShareStateStandard2022: 0.1,
    })
    expect(evaluate('P2', held)).toBeNull()
    expect(evaluate('P3', held)).toMatchObject({ patternId: 'P3', triageLevel: 4 })
  })

  it('yields to K-B when the series says perdida', () => {
    const lost = attack({
      captureRate2022: 0.01,
      lqByYear: { 2014: 0.3, 2018: 0.2, 2022: 0.25 },
    })
    expect(evaluate('P2', lost)).toBeNull()
    expect(evaluate('K-B', lost)).toMatchObject({ patternId: 'K-B', triageLevel: 5 })
  })

  it('needs volume and open field', () => {
    expect(evaluate('P2', attack({ projectedValidVotes: 5_000 }))).toBeNull()
    expect(evaluate('P2', attack({ uncapturedFieldVotes: 1_000 }))).toBeNull()
  })
})

describe('P3 — correligionário na frente', () => {
  const held = (overrides: Partial<MunicipalityTriggerInput> = {}) =>
    input({
      fieldShareOfValid2022: 0.5,
      intraFieldShare2022: 0.04,
      intraFieldShareStateStandard2022: 0.1,
      projectedValidVotes: 12_000,
      ...overrides,
    })

  it('fires when the campo is strong and the own intra-field slice is far below standard', () => {
    expect(evaluate('P3', held())).toMatchObject({ patternId: 'P3', triageLevel: 4 })
  })

  it('stays silent below the volume cut or without the campo', () => {
    expect(evaluate('P3', held({ projectedValidVotes: 5_000 }))).toBeNull()
    expect(evaluate('P3', held({ fieldShareOfValid2022: 0.2 }))).toBeNull()
    expect(evaluate('P3', held({ intraFieldShare2022: 0.09 }))).toBeNull()
  })

  it('tolerates missing artifact cells', () => {
    expect(evaluate('P3', held({ intraFieldShareStateStandard2022: null }))).toBeNull()
  })
})

describe('P5 — expansão acima do padrão', () => {
  it('fires on a rising LQ series', () => {
    const triggered = evaluate('P5', input({ lqByYear: { 2014: 0.5, 2018: 0.8, 2022: 1.2 } }))
    expect(triggered).toMatchObject({ patternId: 'P5', triageLevel: 4 })
    expect(triggered?.factors.join(' ')).toContain('2014')
  })

  it('fires on coverage above 100%', () => {
    expect(evaluate('P5', input({ coverageRatio: 1.2 }))?.triageLevel).toBe(4)
  })

  it('demands real growth, not monotonic noise', () => {
    expect(evaluate('P5', input({ lqByYear: { 2014: 1, 2018: 1.05, 2022: 1.1 } }))).toBeNull()
  })

  it('never fires on sem_base', () => {
    expect(evaluate('P5', input({ territorialClass: 'sem_base', coverageRatio: 1.2 }))).toBeNull()
  })
})

describe('P6 — município grande sem rede', () => {
  const orphan = (overrides: Partial<MunicipalityTriggerInput> = {}) =>
    input({
      projectedValidVotes: 25_000,
      leadershipCount: 0,
      advisorCount: 0,
      pledgeCount: 0,
      ...overrides,
    })

  it('fires at level 5 without prioritization and 3 with it', () => {
    expect(evaluate('P6', orphan())?.triageLevel).toBe(5)
    expect(evaluate('P6', orphan({ priority: 'alta' }))?.triageLevel).toBe(3)
    expect(evaluate('P6', orphan({ engagementLevel: 'n2' }))?.triageLevel).toBe(3)
  })

  it('any network kills the trigger', () => {
    expect(evaluate('P6', orphan({ leadershipCount: 1 }))).toBeNull()
    expect(evaluate('P6', orphan({ advisorCount: 1 }))).toBeNull()
    expect(evaluate('P6', orphan({ pledgeCount: 1 }))).toBeNull()
  })

  it('requires the upper quartile', () => {
    expect(evaluate('P6', orphan({ projectedValidVotes: 15_000 }))).toBeNull()
  })
})

describe('P7 — pledges estagnados vs. meta', () => {
  const stagnant = (overrides: Partial<MunicipalityTriggerInput> = {}) =>
    input({ priority: 'alta', lastPledgeAgeDays: 25, ...overrides })

  it('fires at level 5 on a prioritized município with a registering-but-stale network', () => {
    expect(evaluate('P7', stagnant())).toMatchObject({ patternId: 'P7', triageLevel: 5 })
  })

  it('prioritization can come from the engagement level', () => {
    expect(evaluate('P7', stagnant({ priority: 'normal', engagementLevel: 'n3' }))).not.toBeNull()
    expect(evaluate('P7', stagnant({ priority: 'normal' }))).toBeNull()
  })

  it('hands the case to K-A when there was recorded effort in the cycle', () => {
    expect(evaluate('P7', stagnant({ completedActivityCount: 1 }))).toBeNull()
  })

  it('needs pledges to exist, be stale, and coverage to be short', () => {
    expect(evaluate('P7', stagnant({ pledgeCount: 0 }))).toBeNull()
    expect(evaluate('P7', stagnant({ lastPledgeAgeDays: 10 }))).toBeNull()
    expect(evaluate('P7', stagnant({ coverageRatio: 1.1 }))).toBeNull()
  })
})

describe('K-A — não responde a investimento', () => {
  const invested = (overrides: Partial<MunicipalityTriggerInput> = {}) =>
    input({ completedActivityCount: 2, lastPledgeAgeDays: 30, ...overrides })

  it('fires when effort was recorded and pledges did not move', () => {
    expect(evaluate('K-A', invested())).toMatchObject({ patternId: 'K-A', triageLevel: 5 })
  })

  it('a município that never pledged despite effort also fires', () => {
    const triggered = evaluate('K-A', invested({ lastPledgeAgeDays: null }))
    expect(triggered?.factors.join(' ')).toContain('Nenhum pledge')
  })

  it('recent pledge movement or met coverage silences it', () => {
    expect(evaluate('K-A', invested({ lastPledgeAgeDays: 10 }))).toBeNull()
    expect(evaluate('K-A', invested({ coverageRatio: 1.05 }))).toBeNull()
    expect(evaluate('K-A', invested({ completedActivityCount: 0 }))).toBeNull()
  })
})

describe('K-B — perdida vestida de oportunidade', () => {
  const mirage = (overrides: Partial<MunicipalityTriggerInput> = {}) =>
    input({
      territorialClass: 'marginal',
      uncapturedFieldVotes: 5_000,
      captureRate2022: 0.01,
      lqByYear: { 2014: 0.3, 2018: 0.2, 2022: 0.25 },
      ...overrides,
    })

  it('fires at level 5 on apparent headroom with a minimal-capture series', () => {
    expect(evaluate('K-B', mirage())).toMatchObject({ patternId: 'K-B', triageLevel: 5 })
  })

  it('a single strong year in the series breaks the "perdida" reading', () => {
    expect(evaluate('K-B', mirage({ lqByYear: { 2014: 0.3, 2018: 1.4, 2022: 0.25 } }))).toBeNull()
  })

  it('capture above minimal or no headroom silences it', () => {
    expect(evaluate('K-B', mirage({ captureRate2022: 0.05 }))).toBeNull()
    expect(evaluate('K-B', mirage({ uncapturedFieldVotes: 1_000 }))).toBeNull()
  })

  it('yields to P3 when the campo itself holds the município', () => {
    expect(
      evaluate(
        'K-B',
        mirage({
          fieldShareOfValid2022: 0.5,
          intraFieldShare2022: 0.03,
          intraFieldShareStateStandard2022: 0.1,
        }),
      ),
    ).toBeNull()
  })
})

describe('evaluateMunicipalityTriggers — ordering and silence', () => {
  it('returns triggered patterns sorted by triage level', () => {
    const triggered = evaluateMunicipalityTriggers(
      input({
        territorialClass: 'reduto',
        inCoreBlock: true,
        lqByYear: { 2014: 2.5, 2018: 2.6, 2022: 2.4 },
        hasAdversarySignal: true,
        coverageRatio: 1.2,
      }),
    )
    expect(triggered.map((entry) => entry.patternId)).toEqual(['P1', 'P5'])
    expect(triggered[0]?.triageLevel).toBe(1)
  })

  it('returns nothing on the healthy baseline', () => {
    expect(evaluateMunicipalityTriggers(input())).toEqual([])
  })

  it('silence review needs prioritization, no triggers and a silent month', () => {
    expect(shouldEnterSilenceReview(input({ priority: 'alta', lastSignalAgeDays: 35 }), 0)).toBe(
      true,
    )
    expect(shouldEnterSilenceReview(input({ priority: 'alta', lastSignalAgeDays: null }), 0)).toBe(
      true,
    )
    expect(
      shouldEnterSilenceReview(input({ engagementLevel: 'n2', lastSignalAgeDays: 40 }), 0),
    ).toBe(true)
    expect(shouldEnterSilenceReview(input({ priority: 'alta', lastSignalAgeDays: 10 }), 0)).toBe(
      false,
    )
    expect(shouldEnterSilenceReview(input({ priority: 'alta', lastSignalAgeDays: 35 }), 1)).toBe(
      false,
    )
    expect(shouldEnterSilenceReview(input({ lastSignalAgeDays: 35 }), 0)).toBe(false)
  })

  it('postpone durations: 7 days for urgent levels, 14 for optimization levels', () => {
    expect(suggestionPostponeDays(1)).toBe(7)
    expect(suggestionPostponeDays(3)).toBe(7)
    expect(suggestionPostponeDays(4)).toBe(14)
    expect(suggestionPostponeDays(5)).toBe(14)
  })

  it('suppression windows exist for both terminal outcomes', () => {
    expect(SUGGESTION_SUPPRESSION_DAYS.aceita).toBeGreaterThan(0)
    expect(SUGGESTION_SUPPRESSION_DAYS.descarta).toBeGreaterThan(0)
  })
})

describe('isSuggestionSuppressedByDecision — churn windows (§6.4)', () => {
  const now = new Date('2026-07-28T12:00:00.000Z')
  const daysAgo = (days: number): string =>
    new Date(now.getTime() - days * 86_400_000).toISOString()
  const decision = (overrides: Partial<SuggestionDecisionLike>): SuggestionDecisionLike => ({
    outcome: 'descarta',
    createdAt: daysAgo(1),
    snapshot: { triageLevel: 5 },
    ...overrides,
  })

  it('a dismissal suppresses inside its window and expires after it', () => {
    expect(isSuggestionSuppressedByDecision(decision({}), { triageLevel: 5 }, now)).toBe(true)
    expect(
      isSuggestionSuppressedByDecision(
        decision({ createdAt: daysAgo(SUGGESTION_SUPPRESSION_DAYS.descarta + 1) }),
        { triageLevel: 5 },
        now,
      ),
    ).toBe(false)
  })

  it('an acceptance suppresses for its own, shorter window', () => {
    expect(
      isSuggestionSuppressedByDecision(
        decision({ outcome: 'aceita', createdAt: daysAgo(7) }),
        {
          triageLevel: 4,
        },
        now,
      ),
    ).toBe(true)
    expect(
      isSuggestionSuppressedByDecision(
        decision({ outcome: 'aceita', createdAt: daysAgo(SUGGESTION_SUPPRESSION_DAYS.aceita + 1) }),
        { triageLevel: 4 },
        now,
      ),
    ).toBe(false)
  })

  it('a postponement suppresses until its snapshot suppressUntil, then resurfaces', () => {
    const future = new Date(now.getTime() + 86_400_000).toISOString()
    const past = daysAgo(1)
    expect(
      isSuggestionSuppressedByDecision(
        decision({ outcome: 'adiada', snapshot: { triageLevel: 5, suppressUntil: future } }),
        { triageLevel: 5 },
        now,
      ),
    ).toBe(true)
    expect(
      isSuggestionSuppressedByDecision(
        decision({
          outcome: 'adiada',
          createdAt: daysAgo(10),
          snapshot: { triageLevel: 5, suppressUntil: past },
        }),
        { triageLevel: 5 },
        now,
      ),
    ).toBe(false)
  })

  it('a malformed postponement snapshot falls back to the shortest postpone, never forever', () => {
    expect(
      isSuggestionSuppressedByDecision(
        decision({ outcome: 'adiada', createdAt: daysAgo(1), snapshot: null }),
        { triageLevel: 5 },
        now,
      ),
    ).toBe(true)
    expect(
      isSuggestionSuppressedByDecision(
        decision({ outcome: 'adiada', createdAt: daysAgo(8), snapshot: null }),
        { triageLevel: 5 },
        now,
      ),
    ).toBe(false)
  })

  it('a confirmed risk (level 1) pierces a decision recorded at lower urgency', () => {
    const dismissedAtLevel3 = decision({ snapshot: { triageLevel: 3 } })
    expect(isSuggestionSuppressedByDecision(dismissedAtLevel3, { triageLevel: 1 }, now)).toBe(false)
    // Seen and decided AT level 1: the window holds.
    expect(
      isSuggestionSuppressedByDecision(
        decision({ snapshot: { triageLevel: 1 } }),
        {
          triageLevel: 1,
        },
        now,
      ),
    ).toBe(true)
    // Lower-urgency re-trigger of a level-3 dismissal: the window holds too.
    expect(isSuggestionSuppressedByDecision(dismissedAtLevel3, { triageLevel: 3 }, now)).toBe(true)
  })

  it('a level movement (E14) never suppresses a suggestion', () => {
    expect(
      isSuggestionSuppressedByDecision(decision({ outcome: 'movimento' }), { triageLevel: 5 }, now),
    ).toBe(false)
  })
})
