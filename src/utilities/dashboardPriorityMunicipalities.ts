import type { VoteEstimateScenario } from '@/lib/voteEstimate'
import type { Municipality } from '@/payload-types'
import {
  centralDeficitSortValue,
  type MunicipalityGoalCoverage,
} from '@/utilities/municipality/goalCoverage'

export const DASHBOARD_PRIORITY_SAMPLE_LIMIT = 8

export type DashboardPriorityMunicipality = {
  name: string
  slug: string
}

export type DashboardPriorityMunicipalitiesPick = {
  highPriorityCount: number
  municipalities: DashboardPriorityMunicipality[]
}

type DashboardPriorityMunicipalitySource = Pick<Municipality, 'id' | 'name' | 'slug' | 'priority'>

const municipalityNameCompare = (
  left: DashboardPriorityMunicipalitySource,
  right: DashboardPriorityMunicipalitySource,
): number => left.name.localeCompare(right.name, 'pt-BR')

/** B20: `priority === 'alta'` sample ordered like E9 `deficit` / `central` desc. */
export const pickDashboardPriorityMunicipalities = (
  municipalities: DashboardPriorityMunicipalitySource[],
  coverageByMunicipalityID: ReadonlyMap<
    number,
    Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  >,
  sampleLimit = DASHBOARD_PRIORITY_SAMPLE_LIMIT,
): DashboardPriorityMunicipalitiesPick => {
  const highPriority = municipalities.filter((municipality) => municipality.priority === 'alta')
  const municipalitiesSample = [...highPriority]
    .sort((left, right) => {
      const leftValue = centralDeficitSortValue(coverageByMunicipalityID.get(left.id)?.central)
      const rightValue = centralDeficitSortValue(coverageByMunicipalityID.get(right.id)?.central)
      if (leftValue === null && rightValue === null) return municipalityNameCompare(left, right)
      if (leftValue === null) return 1
      if (rightValue === null) return -1
      if (leftValue === rightValue) return municipalityNameCompare(left, right)
      return rightValue - leftValue
    })
    .slice(0, sampleLimit)
    .map((municipality) => ({ name: municipality.name, slug: municipality.slug }))

  return { highPriorityCount: highPriority.length, municipalities: municipalitiesSample }
}
