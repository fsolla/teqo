import { describe, expect, it } from 'vitest'

import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import {
  allocateHitBudget,
  buildHomeSearchGroupHitCounts,
  HOME_SEARCH_HIT_BUDGET,
  sliceHomeSearchMunicipalityGroup,
} from '@/lib/homeSearchHitBudget'

const baseResponse = (
  overrides: Partial<HomeSearchSuccessResponse> = {},
): HomeSearchSuccessResponse => ({
  status: 'success',
  resultKind: 'search',
  municipalities: [],
  territories: [],
  advisors: [],
  leaderships: [],
  stateDeputies: [],
  activities: [],
  demands: [],
  ...overrides,
})

describe('allocateHitBudget', () => {
  it('gives municipalities priority over secondary groups', () => {
    const counts = buildHomeSearchGroupHitCounts(
      baseResponse({
        municipalities: Array.from({ length: 10 }, (_, index) => ({
          kind: 'municipality' as const,
          slug: `m-${index}`,
          name: `M${index}`,
          region: 'R',
          priority: null,
          votePosition2022: null,
        })),
        demands: Array.from({ length: 10 }, (_, index) => ({
          id: index,
          slug: `d-${index}`,
          title: `Demand ${index}`,
          secondary: 'x',
        })),
      }),
    )

    const limits = allocateHitBudget(counts, 8)

    expect(limits.municipalities).toBe(8)
    expect(limits.demands).toBe(0)
  })

  it('fills secondary groups in display order when budget remains', () => {
    const counts = buildHomeSearchGroupHitCounts(
      baseResponse({
        municipalities: [
          {
            kind: 'municipality',
            slug: 'cairu',
            name: 'Cairu',
            region: 'Recôncavo',
            priority: null,
            votePosition2022: null,
          },
        ],
        leaderships: [
          {
            kind: 'leadership',
            id: 1,
            name: 'Leader A',
            phone: null,
            municipalitiesSummary: 'Cairu',
          },
          {
            kind: 'leadership',
            id: 2,
            name: 'Leader B',
            phone: null,
            municipalitiesSummary: 'Salvador',
          },
        ],
        demands: [
          { id: 1, slug: 'd-1', title: 'Demand 1', secondary: 'x' },
          { id: 2, slug: 'd-2', title: 'Demand 2', secondary: 'x' },
        ],
      }),
    )

    const limits = allocateHitBudget(counts, 4)

    expect(limits.municipalities).toBe(1)
    expect(limits.leaderships).toBe(2)
    expect(limits.demands).toBe(1)
    expect(limits.advisors).toBe(0)
  })

  it('counts territories toward the municipality group in search mode', () => {
    const counts = buildHomeSearchGroupHitCounts(
      baseResponse({
        municipalities: [],
        territories: [
          { kind: 'territory', region: 'Recôncavo', votes2022: 1000 },
          { kind: 'territory', region: 'Sertão', votes2022: 500 },
        ],
      }),
    )

    const limits = allocateHitBudget(counts, HOME_SEARCH_HIT_BUDGET.mobile)

    expect(counts.municipalities).toBe(2)
    expect(limits.municipalities).toBe(2)
  })
})

describe('sliceHomeSearchMunicipalityGroup', () => {
  it('slices municipalities before territories within the shared limit', () => {
    const municipalities = [
      {
        kind: 'municipality' as const,
        slug: 'a',
        name: 'A',
        region: 'R',
        priority: null,
        votePosition2022: null,
      },
      {
        kind: 'municipality' as const,
        slug: 'b',
        name: 'B',
        region: 'R',
        priority: null,
        votePosition2022: null,
      },
    ]
    const territories = [{ kind: 'territory' as const, region: 'TI', votes2022: 1 }]

    const sliced = sliceHomeSearchMunicipalityGroup(municipalities, territories, 2, true)

    expect(sliced.municipalities).toHaveLength(2)
    expect(sliced.territories).toHaveLength(0)
  })

  it('uses remaining slots for territories after municipalities', () => {
    const municipalities = [
      {
        kind: 'municipality' as const,
        slug: 'a',
        name: 'A',
        region: 'R',
        priority: null,
        votePosition2022: null,
      },
    ]
    const territories = [
      { kind: 'territory' as const, region: 'TI 1', votes2022: 1 },
      { kind: 'territory' as const, region: 'TI 2', votes2022: 2 },
    ]

    const sliced = sliceHomeSearchMunicipalityGroup(municipalities, territories, 3, true)

    expect(sliced.municipalities).toHaveLength(1)
    expect(sliced.territories).toHaveLength(2)
  })
})
