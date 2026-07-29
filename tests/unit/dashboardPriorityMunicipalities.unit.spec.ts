import { describe, expect, it } from 'vitest'

import type { VoteEstimateScenario } from '@/lib/voteEstimate'
import type { Municipality } from '@/payload-types'
import {
  DASHBOARD_PRIORITY_SAMPLE_LIMIT,
  pickDashboardPriorityMunicipalities,
} from '@/utilities/dashboardPriorityMunicipalities'
import type { MunicipalityGoalCoverage } from '@/utilities/municipality/goalCoverage'
import { stub } from '../helpers/stub'

const centralCoverage = (goal: number, committed: number): MunicipalityGoalCoverage => ({
  goal,
  committed,
  coverageRatio: goal > 0 ? committed / goal : null,
  deficit: goal - committed,
})

const coverageMap = (
  entries: Array<[number, MunicipalityGoalCoverage]>,
): Map<number, Record<VoteEstimateScenario, MunicipalityGoalCoverage>> =>
  new Map(
    entries.map(([id, central]) => [
      id,
      {
        pessimistic: centralCoverage(0, 0),
        central,
        optimistic: centralCoverage(0, 0),
      },
    ]),
  )

const municipality = (id: number, slug: string, priority: Municipality['priority']): Municipality =>
  stub<Municipality>({
    id,
    name: slug,
    slug,
    priority,
  })

describe('pickDashboardPriorityMunicipalities', () => {
  it('orders alta by central deficit desc and caps at the sample limit', () => {
    const municipalities = [
      municipality(1, 'alpha', 'alta'),
      municipality(2, 'beta', 'alta'),
      municipality(3, 'gamma', 'alta'),
      municipality(4, 'delta', 'alta'),
      municipality(5, 'epsilon', 'alta'),
      municipality(6, 'zeta', 'alta'),
      municipality(7, 'eta', 'alta'),
      municipality(8, 'theta', 'alta'),
      municipality(9, 'iota', 'alta'),
      municipality(10, 'kappa', 'alta'),
      municipality(11, 'normal', 'normal'),
    ]

    const coverageByMunicipalityID = coverageMap([
      [1, centralCoverage(100, 10)],
      [2, centralCoverage(100, 20)],
      [3, centralCoverage(100, 30)],
      [4, centralCoverage(100, 40)],
      [5, centralCoverage(100, 50)],
      [6, centralCoverage(100, 60)],
      [7, centralCoverage(100, 70)],
      [8, centralCoverage(100, 80)],
      [9, centralCoverage(100, 90)],
      [10, centralCoverage(100, 95)],
      [11, centralCoverage(500, 0)],
    ])

    const { municipalities: result, highPriorityCount } = pickDashboardPriorityMunicipalities(
      municipalities,
      coverageByMunicipalityID,
    )

    expect(highPriorityCount).toBe(10)
    expect(result).toHaveLength(DASHBOARD_PRIORITY_SAMPLE_LIMIT)
    expect(result.map((m) => m.slug)).toEqual([
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
      'eta',
      'theta',
    ])
  })

  it('sends municipalities without a positive goal to the end', () => {
    const municipalities = [
      municipality(1, 'with-goal', 'alta'),
      municipality(2, 'no-goal', 'alta'),
      municipality(3, 'missing-coverage', 'alta'),
    ]

    const coverageByMunicipalityID = coverageMap([
      [1, centralCoverage(100, 50)],
      [2, centralCoverage(0, 0)],
    ])

    const { municipalities: result } = pickDashboardPriorityMunicipalities(
      municipalities,
      coverageByMunicipalityID,
      3,
    )

    expect(result.map((m) => m.slug)).toEqual(['with-goal', 'missing-coverage', 'no-goal'])
  })
})
